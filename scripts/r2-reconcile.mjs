#!/usr/bin/env node
/* R2 对账：确保 <caseId> 每个角色变体图都已上传 R2；缺失时从 ComfyUI 输出目录补传。
   用法：
     node scripts/r2-reconcile.mjs                      # 对账三个新案件
     node scripts/r2-reconcile.mjs lantern-tricks       # 只对账一个
   环境：COMFY_OUTPUT_DIR 可覆盖 ComfyUI 输出目录（默认 Pinokio 本机路径）。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { r2GetObject, r2PutObject } from '../comfyui/cloudflareR2/r2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['lantern-tricks', 'grand-theatre', 'halcyon-voyage'];
const COMFY_OUTPUT = process.env.COMFY_OUTPUT_DIR
  || '/Users/william.jiang/Samsung/pinokio/drive/drives/peers/d1779062027621/output';

function expectedVariants(caseId) {
  const dir = path.join(ROOT, 'comfyui', 'workflows', caseId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, '')) // <char>_<variant>
    .sort();
}

async function findInComfyOutput(caseId, name) {
  const files = fs.existsSync(COMFY_OUTPUT)
    ? fs.readdirSync(COMFY_OUTPUT).filter((f) => f.startsWith(`whodunit_${caseId}_${name}_`))
    : [];
  if (!files.length) return null;
  // 取序号最大的（最新的）
  files.sort((a, b) => (Number(a.match(/(\d+)/)?.[1] || 0) - Number(b.match(/(\d+)/)?.[1] || 0)));
  const file = files[files.length - 1];
  return path.join(COMFY_OUTPUT, file);
}

let ok = 0;
let repaired = 0;
let missing = 0;
for (const caseId of CASES) {
  const names = expectedVariants(caseId);
  console.log(`\n[${caseId}] 期望 ${names.length} 张`);
  for (const name of names) {
    const key = `characters/${caseId}/${name}.png`;
    const onR2 = await r2GetObject(key).catch(() => null);
    if (onR2) {
      ok++;
      continue;
    }
    const src = await findInComfyOutput(caseId, name);
    if (src) {
      try {
        await r2PutObject(key, fs.readFileSync(src), 'image/png');
        console.log(`  修复 ↑ ${key}（来自 ${path.basename(src)}）`);
        repaired++;
      } catch (err) {
        console.error(`  补传失败 ${key}: ${err.message}`);
        missing++;
      }
    } else {
      console.error(`  缺失且无 ComfyUI 输出可补: ${key}`);
      missing++;
    }
  }
}
console.log(`\n对账完成：已存在 ${ok}，补传 ${repaired}，仍缺失 ${missing}`);
