#!/usr/bin/env node
/* LLM 连通性冒烟测试：
   node scripts/llm-smoke.mjs          # auto：Kimi 优先，失败切 Qwen
   node scripts/llm-smoke.mjs kimi     # 只测 Kimi
   node scripts/llm-smoke.mjs qwen     # 只测 Qwen（DashScope） */
import {
  chatLLM, chatKimi, chatQwen,
  KIMI_MODEL, KIMI_BASE_URL, QWEN_MODEL, QWEN_BASE_URL, LLM_ENGINE,
} from './llm.mjs';

const arg = (process.argv[2] || 'auto').toLowerCase();
const opts = {
  system: 'You are a test harness.',
  user: 'Reply with exactly: {"ok":true}',
  maxTokens: 100,
  timeoutMs: 90000,
  reasoningEffort: 'low',
};

let out;
let engine;
if (arg === 'kimi') {
  out = await chatKimi(opts);
  engine = `kimi (${KIMI_MODEL} @ ${KIMI_BASE_URL})`;
} else if (arg === 'qwen') {
  out = await chatQwen(opts);
  engine = `qwen (${QWEN_MODEL} @ ${QWEN_BASE_URL})`;
} else {
  const r = await chatLLM(opts);
  out = r.content;
  engine = `auto -> ${r.engine}（LLM_ENGINE=${LLM_ENGINE}）`;
}
console.log(`engine: ${engine}`);
console.log(`OUT: ${out.slice(0, 200)}`);
