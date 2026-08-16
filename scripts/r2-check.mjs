#!/usr/bin/env node
/* 检查 R2 对象是否存在：node scripts/r2-check.mjs <key...> */
import { r2GetObject } from '../comfyui/cloudflareR2/r2.mjs';

const keys = process.argv.slice(2);
if (!keys.length) keys.push('characters/lantern-tricks/jin_logo.png');
for (const key of keys) {
  try {
    const buf = await r2GetObject(key);
    console.log(`${buf ? '存在' : '不存在'}: ${key}${buf ? ` (${buf.length}B)` : ''}`);
  } catch (err) {
    console.log(`错误: ${key} — ${err.message}`);
  }
}
