#!/usr/bin/env node
/* 案件数据校验器（CASE-PIPELINE-SPEC §4.3）
   用法：
     node scripts/validate-cases.mjs            # 校验 data/cases/ 全部案件
     node scripts/validate-cases.mjs <caseId>   # 只校验单个案件
   退出码：0 全部通过；1 存在 error。 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CASES_DIR = path.join(ROOT, 'data', 'cases');

export const VOICE_WHITELIST = new Set([
  'sambert-zhixiang-v1', 'sambert-zhinan-v1', 'sambert-zhichu-v1', 'sambert-zhide-v1',
  'sambert-zhiqi-v1', 'sambert-zhijia-v1', 'sambert-zhiru-v1', 'sambert-zhiqian-v1',
  'sambert-zhiwei-v1', 'sambert-zhilun-v1', 'sambert-zhishuo-v1', 'sambert-zhijing-v1',
  'sambert-zhiting-v1', 'sambert-clara-v1', 'sambert-brian-v1', 'sambert-cally-v1', 'sambert-cindy-v1',
  'sambert-donna-v1', 'sambert-eva-v1', 'sambert-betty-v1', 'sambert-beth-v1',
]);

export const ZH_VOICES = new Set([
  'sambert-zhixiang-v1', 'sambert-zhinan-v1', 'sambert-zhichu-v1', 'sambert-zhide-v1',
  'sambert-zhiqi-v1', 'sambert-zhijia-v1', 'sambert-zhiru-v1', 'sambert-zhiqian-v1',
  'sambert-zhiwei-v1', 'sambert-zhilun-v1', 'sambert-zhishuo-v1', 'sambert-zhijing-v1', 'sambert-zhiting-v1',
]);
export const EN_VOICES = new Set([
  'sambert-brian-v1', 'sambert-cally-v1', 'sambert-cindy-v1', 'sambert-donna-v1',
  'sambert-eva-v1', 'sambert-betty-v1', 'sambert-beth-v1',
]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`JSON 解析失败 ${path.basename(file)}: ${err.message}`);
  }
}

export function loadPack(caseId) {
  const dir = path.join(CASES_DIR, caseId);
  const missing = ['case.json', 'suspects.json', 'clues.json'].filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) return { ok: false, errors: [`缺少文件: ${missing.join(', ')}`], pack: null };
  try {
    return {
      ok: true,
      errors: [],
      pack: {
        case: readJson(path.join(dir, 'case.json')),
        suspects: readJson(path.join(dir, 'suspects.json')),
        clues: readJson(path.join(dir, 'clues.json')),
      },
    };
  } catch (err) {
    return { ok: false, errors: [err.message], pack: null };
  }
}

export function checkPack(pack) {
  const errors = [];
  const warnings = [];
  const { case: c, suspects, clues } = pack || {};
  if (!c || !suspects || !clues) return { ok: false, errors: ['缺少 case/suspects/clues'], warnings: [] };

  for (const k of ['id', 'title', 'lang', 'tagline', 'location', 'time', 'briefing', 'scene',
    'timeline', 'relations', 'questions', 'difficulty', 'estimatedMinutes', 'solution', 'epilogues', 'ranks']) {
    if (c[k] === undefined || c[k] === null || c[k] === '') errors.push(`case.${k} 缺失`);
  }
  if (c.lang !== 'en' && c.lang !== 'zh') errors.push(`case.lang 非法: ${c.lang}`);
  if (!/^[a-z0-9-]+$/.test(c.id || '')) errors.push(`case.id 非法: ${c.id}`);
  for (const k of ['id', 'name', 'age', 'emoji', 'bio']) {
    if (c.victim?.[k] === undefined || c.victim?.[k] === null || c.victim?.[k] === '') errors.push(`victim.${k} 缺失`);
  }

  const suspectIds = suspects.map((s) => s.id);
  if (new Set(suspectIds).size !== suspectIds.length) errors.push('嫌疑人 id 重复');
  if (suspects.length < 3 || suspects.length > 6) warnings.push(`嫌疑人数量 ${suspects.length}（建议 5）`);
  const sNeed = ['id', 'name', 'role', 'emoji', 'age', 'shortBio', 'personality', 'alibi', 'secret', 'guilt', 'revealRules', 'tells', 'voice'];
  suspects.forEach((s, i) => {
    for (const k of sNeed) if (s[k] === undefined || s[k] === null || s[k] === '') errors.push(`suspects[${i}].${k} 缺失`);
    if (s.voice && !VOICE_WHITELIST.has(s.voice)) warnings.push(`suspect ${s.id} voice 不在白名单: ${s.voice}`);
    const langVoices = c.lang === 'zh' ? ZH_VOICES : EN_VOICES;
    if (s.voice && langVoices && !langVoices.has(s.voice)) warnings.push(`suspect ${s.id} voice 与案件语言(${c.lang})不匹配: ${s.voice}`);
    if (s.voiceRate !== undefined && (Number(s.voiceRate) < 0.7 || Number(s.voiceRate) > 1.3)) warnings.push(`suspect ${s.id} voiceRate 异常: ${s.voiceRate}`);
    if (s.voicePitch !== undefined && (Number(s.voicePitch) < 0.8 || Number(s.voicePitch) > 1.25)) warnings.push(`suspect ${s.id} voicePitch 异常: ${s.voicePitch}`);
  });
  const guilty = suspects.filter((s) => s.guilt === true);
  if (guilty.length !== 1) errors.push(`guilt=true 应为恰好 1 人，实际 ${guilty.length}`);

  if (clues.length < 8 || clues.length > 10) warnings.push(`线索数量 ${clues.length}（建议 8-10）`);
  const clueIds = clues.map((x) => x.id);
  if (new Set(clueIds).size !== clueIds.length) errors.push('线索 id 重复');
  clues.forEach((x, i) => {
    for (const k of ['id', 'title', 'description', 'source', 'keywords', 'hint']) {
      if (x[k] === undefined || x[k] === null || x[k] === '') errors.push(`clues[${i}].${k} 缺失`);
    }
    if (!(suspectIds.includes(x.source) || x.source === 'scene')) errors.push(`clues[${i}].source 非法: ${x.source}`);
    if (!Array.isArray(x.keywords) || !x.keywords.length) errors.push(`clues[${i}].keywords 为空`);
  });

  if (!suspectIds.includes(c.solution?.killer)) errors.push(`solution.killer 不在嫌疑人中: ${c.solution?.killer}`);
  for (const k of ['killer', 'killerName', 'weapon', 'motive', 'summary']) {
    if (!c.solution?.[k]) errors.push(`solution.${k} 缺失`);
  }
  for (const k of ['solved_brilliant', 'solved_thin', 'wrong']) {
    if (!c.epilogues?.[k]) errors.push(`epilogues.${k} 缺失`);
  }
  for (const r of c.relations || []) {
    if (!(suspectIds.includes(r.a) || r.a === 'victim')) errors.push(`relations.a 非法: ${r.a}`);
    if (!(suspectIds.includes(r.b) || r.b === 'victim')) errors.push(`relations.b 非法: ${r.b}`);
  }
  if (!Array.isArray(c.timeline) || c.timeline.length < 4) warnings.push('timeline 少于 4 条');
  if (!Array.isArray(c.questions) || c.questions.length < 3) warnings.push('questions 少于 3 条');
  if (!Array.isArray(c.ranks) || c.ranks.length < 3) warnings.push('ranks 少于 3 档');
  return { ok: errors.length === 0, errors, warnings };
}

/* ---- CLI ---- */
function main() {
  const args = process.argv.slice(2);
  const targets = args.length ? args : fs.readdirSync(CASES_DIR).filter((f) => fs.statSync(path.join(CASES_DIR, f)).isDirectory());
  let failed = 0;
  for (const caseId of targets.sort()) {
    const { ok: loaded, errors: loadErr, pack } = loadPack(caseId);
    if (!loaded) {
      failed++;
      console.log(`✗ ${caseId}: ${loadErr.join('; ')}`);
      continue;
    }
    const r = checkPack(pack);
    const w = r.warnings.map((x) => `⚠ ${x}`).join('\n    ');
    if (r.ok) console.log(`✓ ${caseId}${r.warnings.length ? `\n    ${w}` : ''}`);
    else {
      failed++;
      console.log(`✗ ${caseId}: ${r.errors.join('; ')}${r.warnings.length ? `\n    ${w}` : ''}`);
    }
  }
  console.log(failed ? `\n${failed} 个案件未通过` : '\n全部案件通过');
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && process.argv[1].endsWith('validate-cases.mjs')) main();
