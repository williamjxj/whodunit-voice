#!/usr/bin/env node
/* 把 public/characters/ 下已有的出图批量上传到 Cloudflare R2（不必重跑 ComfyUI 出图）。
   用法：
     node comfyui/cloudflareR2/sync.mjs            # 全量上传（PUT 幂等，可重复跑）
     node comfyui/cloudflareR2/sync.mjs --dry-run  # 只打印将要上传的清单
   前置：.env 里 R2_IMAGES_ENABLED=1 且 ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/BUCKET_NAME 齐全。 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isR2Enabled, r2PutObject } from './r2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'public', 'characters');

if (!isR2Enabled()) {
  console.error('R2 未启用：请确认 .env 中 R2_IMAGES_ENABLED=1 且四项凭证齐全');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.png$/i.test(entry.name)) files.push(full);
  }
};
walk(OUT_DIR);
files.sort();

let ok = 0;
let fail = 0;
for (const file of files) {
  const key = path.relative(path.join(ROOT, 'public'), file).split(path.sep).join('/');
  if (dryRun) {
    console.log(key);
    continue;
  }
  try {
    await r2PutObject(key, fs.readFileSync(file), 'image/png');
    console.log(`R2 ↑ ${key}`);
    ok++;
  } catch (err) {
    console.warn(`R2 上传失败：${key} — ${err.message}`);
    fail++;
  }
}
console.log(dryRun ? `\n共 ${files.length} 张（dry-run）` : `\n完成：成功 ${ok}，失败 ${fail}`);