#!/usr/bin/env node
/* 清理 R2 中误传的 characters/characters/** 对象（一次性修复脚本，可安全重复跑） */
import { isR2Enabled, r2DeleteObject } from '../comfyui/cloudflareR2/r2.mjs';

if (!isR2Enabled()) {
  console.error('R2 未启用');
  process.exit(1);
}

const badKeys = [
  'characters/characters/lantern-tricks/jin_logo.png',
  'characters/characters/lantern-tricks/jin_portrait.png',
  'characters/characters/lantern-tricks/liu_logo.png',
  'characters/characters/lantern-tricks/liu_calm.png',
];

for (const key of badKeys) {
  try {
    const existed = await r2DeleteObject(key);
    console.log(`${existed ? 'R2 ✗ 已删除' : 'R2 - 不存在（跳过）'}: ${key}`);
  } catch (err) {
    console.error(`删除失败 ${key}: ${err.message}`);
  }
}
