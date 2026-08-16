#!/usr/bin/env node
/* 人物图像批量生成器（零依赖，Node 22+）
  用法：
     node comfyui/generate.mjs --build-only              # 只生成 workflow JSON，不出图
     node comfyui/generate.mjs                           # 全量生成所有角色（logo + 表情变体）
     node comfyui/generate.mjs --force                   # 强制重出（默认跳过已存在）
     node comfyui/generate.mjs --case jade-pavilion      # 只生成玉簪案
     node comfyui/generate.mjs --char shen               # 只生成沈月娥
     node comfyui/generate.mjs --char shen --variants logo,calm
     node comfyui/generate.mjs --dry-run                 # 只打印将要生成的清单
     node comfyui/generate.mjs --list-models             # 列出 ComfyUI 可用模型 + 就位检查
   输出：public/characters/<caseId>/<charId>_<variant>.png
   出图策略：先 txt2img 生成 logo，再以 logo 为底做 img2img（denoise 0.62）
   派生 calm/uneasy/cornered 等表情变体，保证同一人物脸型一致。
   默认断点续跑：已存在的图自动跳过，只补缺的；重跑不会重复生成。 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { characters, NEGATIVE, buildPrompt, CHECKPOINT_ALIASES } from './config/characters.mjs';
import { isR2Enabled, r2PutObject } from './cloudflareR2/r2.mjs';

const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.join(ROOT, 'public', 'characters');
const WORKFLOW_DIR = path.join(ROOT, 'comfyui', 'workflows');
const UPLOAD_PREFIX = 'whodunit';
const DENOISE = 0.62; // img2img 变体保留人脸的程度
const POLL_MS = 1200;
// M3 18GB + 外置盘 checkpoint：模型载入 + 出图可能 5-8 分钟/张，给足 15 分钟
const TIMEOUT_MS = 15 * 60 * 1000;

function parseArgs(argv) {
  const args = { variants: null, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--build-only') args.buildOnly = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--case') args.caseId = argv[++i];
    else if (a === '--char') args.charId = argv[++i];
    else if (a === '--variants') args.variants = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--denoise') args.denoise = Number(argv[++i]);
    else if (a === '--list-models') args.listModels = true;
  }
  return args;
}

function selectCharacters(args) {
  let list = characters;
  if (args.caseId) list = list.filter((c) => c.caseId === args.caseId);
  if (args.charId) list = list.filter((c) => c.id === args.charId);
  if (!list.length) {
    console.error(`没有匹配的角色（case=${args.caseId || '-'} char=${args.charId || '-'}）`);
    process.exit(1);
  }
  return list;
}

/* ---------- workflow 构造（ComfyUI API 格式） ---------- */
function baseNodes(char) {
  return {
    4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: char.checkpoint } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['4', 1] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: NEGATIVE, clip: ['4', 1] } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  };
}

function txt2imgPrompt(char, variantKey, seed, prefix) {
  const v = char[variantKey] || { seed: 1 };
  return {
    3: {
      class_type: 'KSampler',
      inputs: {
        seed: Number.isInteger(seed) ? seed : v.seed,
        steps: char.steps,
        cfg: char.cfg,
        sampler_name: char.sampler,
        scheduler: char.scheduler,
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    5: { class_type: 'EmptyLatentImage', inputs: { width: char.width, height: char.height, batch_size: 1 } },
    ...baseNodes(char),
    9: { class_type: 'SaveImage', inputs: { filename_prefix: prefix, images: ['8', 0] } },
  };
}

function img2imgPrompt(char, variantKey, sourceImage, prefix) {
  const v = char[variantKey] || { seed: 1 };
  return {
    3: {
      class_type: 'KSampler',
      inputs: {
        seed: v.seed,
        steps: char.steps,
        cfg: char.cfg,
        sampler_name: char.sampler,
        scheduler: char.scheduler,
        denoise: DENOISE,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['11', 0],
      },
    },
    4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: char.checkpoint } },
    5: { class_type: 'EmptyLatentImage', inputs: { width: char.width, height: char.height, batch_size: 1 } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['4', 1] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: NEGATIVE, clip: ['4', 1] } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    9: { class_type: 'SaveImage', inputs: { filename_prefix: prefix, images: ['8', 0] } },
    10: { class_type: 'LoadImage', inputs: { image: sourceImage } },
    11: { class_type: 'VAEEncode', inputs: { pixels: ['10', 0], vae: ['4', 2] } },
  };
}

function fillPrompts(promptObj, char, variantKey) {
  promptObj['6'].inputs.text = buildPrompt(char, variantKey);
  return promptObj;
}

/* ---------- ComfyUI HTTP ---------- */
async function comfyJson(url) {
  const res = await fetch(`${COMFY}${url}`, { method: 'GET' });
  if (!res.ok) throw new Error(`ComfyUI ${url} -> HTTP ${res.status}`);
  return res.json();
}

async function checkComfy() {
  try {
    const stats = await comfyJson('/system_stats');
    console.log(`ComfyUI 在线：${stats.system.comfyui_version} | RAM ${(stats.system.ram_total / 1e9).toFixed(0)}GB`);
  } catch (err) {
    console.error(`连不上 ComfyUI（${COMFY}）：${err.message}\n请先启动 ComfyUI，或设置 COMFY_URL。`);
    process.exit(1);
  }
}

/* ---------- checkpoint 解析（支持配置文件名 ≠ 实际文件名） ----------
   策略：先精确匹配；失败则按 CHECKPOINT_ALIASES 的关键词在 ComfyUI 的
   实际 checkpoint 列表里模糊匹配；仍失败则保留配置名并在运行时报出可下载文件名。 */
async function fetchAvailableCheckpoints() {
  try {
    const info = await comfyJson('/object_info/CheckpointLoaderSimple');
    return info?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
  } catch {
    return [];
  }
}

function resolveCheckpoint(configured, available) {
  if (available.includes(configured)) return { name: configured, mode: 'exact' };
  const patterns = CHECKPOINT_ALIASES[configured] || [];
  for (const p of patterns) {
    const hit = available.find((a) => a.toLowerCase().includes(p.toLowerCase()));
    if (hit) return { name: hit, mode: `fuzzy:${p}` };
  }
  return { name: configured, mode: 'missing' };
}

function printModelStatus(available) {
  const wanted = [...new Set(characters.map((c) => c.checkpoint))];
  console.log('\n模型就位检查（ComfyUI 实际 checkpoint 列表）：');
  for (const w of wanted) {
    const r = resolveCheckpoint(w, available);
    if (r.mode === 'exact') console.log(`  ✓ ${w} — 精确匹配`);
    else if (r.mode.startsWith('fuzzy')) console.log(`  ✓ ${w} → 匹配到实际文件 ${r.name}`);
    else console.log(`  ✗ ${w} — 未找到！请到 Civitai 下载（见 comfyui/README.md）`);
  }
}

async function submitPrompt(promptObj) {
  const clientId = randomUUID();
  const res = await fetch(`${COMFY}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: promptObj, client_id: clientId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`/prompt -> HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`ComfyUI 拒绝：${JSON.stringify(data.error).slice(0, 300)}`);
  return data.prompt_id;
}

async function waitForImage(promptId) {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const hist = await comfyJson(`/history/${promptId}`);
      const entry = hist[promptId];
      if (!entry || !entry.outputs) continue;
      const images = Object.values(entry.outputs).flatMap((o) => o.images || []);
      if (images.length) return images[0];
      if (entry.status && entry.status.status_str === 'error') {
        const msg = entry.status.messages?.map((m) => JSON.stringify(m)).join(' ') || 'generation error';
        throw new Error(`出图失败：${msg.slice(0, 400)}`);
      }
    } catch (err) {
      if (/出图失败/.test(err.message)) throw err;
      // 历史接口偶发未就绪，继续轮询
    }
  }
  // 超时前最后补查一次：ComfyUI 侧可能刚好完成，避免白白重跑
  try {
    const hist = await comfyJson(`/history/${promptId}`);
    const entry = hist[promptId];
    const images = entry ? Object.values(entry.outputs || {}).flatMap((o) => o.images || []) : [];
    if (images.length) return images[0];
  } catch {}
  throw new Error(`出图超时（${TIMEOUT_MS / 1000}s）：${promptId}`);
}

async function downloadImage(img, destPath) {
  const params = new URLSearchParams({ filename: img.filename, type: img.type || 'output' });
  if (img.subfolder) params.set('subfolder', img.subfolder);
  const res = await fetch(`${COMFY}/view?${params}`);
  if (!res.ok) throw new Error(`/view -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  if (isR2Enabled()) {
    try {
      const key = `characters/${path.relative(path.join(ROOT, 'public'), destPath).split(path.sep).join('/')}`;
      await r2PutObject(key, buf, 'image/png');
      console.log(`  R2 ↑ ${key}`);
    } catch (err) {
      console.warn(`  R2 上传失败（本地文件已保留）：${err.message}`);
    }
  }
  return buf;
}

async function uploadImage(buf, name) {
  const fd = new FormData();
  fd.append('image', new Blob([buf], { type: 'image/png' }), name);
  fd.append('type', 'input');
  fd.append('overwrite', 'true');
  const res = await fetch(`${COMFY}/upload/image`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`/upload/image -> HTTP ${res.status}`);
  const data = await res.json();
  return data.name || name;
}

/* ---------- 主流程 ---------- */
function workflowPaths(char, variantKey) {
  const dir = path.join(WORKFLOW_DIR, char.caseId);
  const base = `${char.id}_${variantKey}`;
  return { dir, file: path.join(dir, `${base}.json`), prefix: `${UPLOAD_PREFIX}_${char.caseId}_${base}` };
}

function writeWorkflowJson(char, variantKey, promptObj) {
  const { dir, file } = workflowPaths(char, variantKey);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(promptObj, null, 2) + '\n');
}

async function generateCharacter(char, args) {
  const variants = args.variants && args.variants.length ? args.variants : char.variants;
  if (!variants.includes('logo')) variants.unshift('logo');
  console.log(`\n▶ ${char.name}（${char.role}） checkpoint=${char.checkpoint}`);
  const caseDir = path.join(OUT_DIR, char.caseId);
  let logoBuf = null;
  let logoUploaded = false;
  const logoDest = path.join(caseDir, `${char.id}_logo.png`);

  for (const variantKey of variants) {
    const { file, prefix } = workflowPaths(char, variantKey);
    const dest = path.join(caseDir, `${char.id}_${variantKey}.png`);
    const isLogo = variantKey === 'logo';
    // build-only 总是重建 workflow JSON（供预览/备份）；真正出图时才跳过已存在文件
    if (!args.buildOnly && !args.force && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`  ${variantKey} 已存在 → 跳过`);
      if (isLogo) logoBuf = fs.readFileSync(dest);
      continue;
    }
    // img2img 变体需要 logo 作为 ComfyUI 输入底图：无论 logo 是刚生成还是本地已有，
    // 提交变体前惰性上传一次。
    if (!args.buildOnly && !isLogo && !logoUploaded) {
      if (!logoBuf && fs.existsSync(logoDest) && fs.statSync(logoDest).size > 0) {
        logoBuf = fs.readFileSync(logoDest);
      }
      if (logoBuf) {
        const uploaded = await uploadImage(logoBuf, `${UPLOAD_PREFIX}_${char.id}_logo.png`);
        logoUploaded = true;
        console.log(`  logo 已上传为 ComfyUI 输入：${uploaded}`);
      }
    }
    const promptObj = isLogo
      ? fillPrompts(txt2imgPrompt(char, variantKey, null, prefix), char, variantKey)
      : fillPrompts(img2imgPrompt(char, variantKey, `${UPLOAD_PREFIX}_${char.id}_logo.png`, prefix), char, variantKey);
    writeWorkflowJson(char, variantKey, promptObj);
    if (args.buildOnly) {
      console.log(`  workflow → ${path.relative(ROOT, file)}`);
      continue;
    }

    const promptId = await submitPrompt(promptObj);
    process.stdout.write(`  ${variantKey} … `);
    const t0 = Date.now();
    const img = await waitForImage(promptId);
    const buf = await downloadImage(img, dest);
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`${img.filename} → ${path.relative(ROOT, dest)} (${(buf.length / 1024).toFixed(0)}KB, ${secs}s)`);
    if (isLogo) logoBuf = buf;
  }
}

function writeManifest() {
  const files = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.png$/i.test(entry.name)) files.push(path.relative(path.join(OUT_DIR, '..'), full).split(path.sep).join('/'));
    }
  };
  walk(OUT_DIR);
  files.sort();
  const manifest = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ generatedAt: new Date().toISOString(), count: files.length, files }, null, 2) + '\n');
  return files.length;
}

async function main() {
  const args = parseArgs(process.argv);
  const list = selectCharacters(args);
  console.log(`计划生成 ${list.length} 个角色：${list.map((c) => c.id).join(', ')}`);
  const stats = { failed: [] };
  if (args.dryRun) {
    for (const c of list) {
      const variants = args.variants && args.variants.length ? args.variants : c.variants;
      console.log(`  ${c.name}: ${variants.join(', ')} → public/characters/${c.caseId}/${c.id}_*.png`);
    }
    return;
  }
  if (!args.buildOnly) await checkComfy();
  if (args.listModels) {
    const available = await fetchAvailableCheckpoints();
    console.log('\nComfyUI 全部可用 checkpoint：');
    for (const name of available) console.log(`  ${name}`);
    printModelStatus(available);
    return;
  }
  /* checkpoint 解析：精确 → 别名模糊匹配，配置文件名与实际文件有出入也能自动识别 */
  const available = await fetchAvailableCheckpoints();
  const resolved = new Map();
  for (const c of list) {
    if (!resolved.has(c.checkpoint)) resolved.set(c.checkpoint, resolveCheckpoint(c.checkpoint, available));
    const r = resolved.get(c.checkpoint);
    if (r.mode === 'missing') {
      const tip = args.buildOnly
        ? `（ComfyUI 离线或未下载，workflow 保留配置名 ${r.name}）`
        : `请先下载 ${r.name}（见 comfyui/README.md）`;
      console.warn(`  ⚠ ${c.name}: checkpoint ${r.name} 未找到，${tip}`);
    } else if (r.mode !== 'exact') {
      console.warn(`  ${c.name}: 配置 ${c.checkpoint} → 实际使用 ${r.name}`);
    }
    c.checkpoint = r.name;
  }
  for (const c of list) {
    try {
      await generateCharacter(c, args);
    } catch (err) {
      console.error(`  ✗ ${c.id} 失败：${err.message}`);
      stats.failed.push(`${c.id}: ${err.message}`);
      if (args.charId) process.exit(1);
    }
  }
  const count = writeManifest();
  console.log(`\n完成：${stats.failed.length ? stats.failed.length + ' 个失败，见上' : '全部成功'}；当前共 ${count} 张图像。`);
  console.log('图像输出在 public/characters/（webui 自动读取），清单 public/characters/manifest.json。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
