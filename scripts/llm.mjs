#!/usr/bin/env node
/* LLM 客户端（OpenAI 兼容 Chat Completions，零依赖）
   CASE-PIPELINE-SPEC §3。
   引擎：Kimi K3（默认）→ Qwen（DashScope，Kimi 不可用时自动降级）。
   用法：
     import { chatKimi, chatQwen, chatLLM } from './llm.mjs';
   .env：
     KIMI_API_KEY / KIMI_MODEL / KIMI_BASE_URL
     DASHSCOPE_API_KEY（Qwen 用）/ QWEN_MODEL / QWEN_BASE_URL
     LLM_ENGINE = auto | kimi | qwen（默认 auto：先 Kimi，失败切 Qwen） */
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const env = {};
  const p = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(p)) {
    for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (k) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
export const KIMI_API_KEY = process.env.KIMI_API_KEY || env.KIMI_API_KEY || '';
export const KIMI_BASE_URL = (process.env.KIMI_BASE_URL || env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/$/, '');
export const KIMI_MODEL = process.env.KIMI_MODEL || env.KIMI_MODEL || 'kimi-k3';
export const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || env.DASHSCOPE_API_KEY || '';
export const QWEN_BASE_URL = (process.env.QWEN_BASE_URL || env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
export const QWEN_MODEL = process.env.QWEN_MODEL || env.QWEN_MODEL || 'qwen-max';
export const LLM_ENGINE = (process.env.LLM_ENGINE || env.LLM_ENGINE || 'auto').toLowerCase();

async function chatCompletions({ baseUrl, apiKey, model, label, system, user, json, maxTokens, timeoutMs, reasoningEffort }) {
  if (!apiKey) throw new Error(`${label} API Key 未设置（检查 .env）`);
  // DashScope（Qwen）要求 json_object 模式下消息里必须出现 "json" 字样
  if (json && !/json/i.test(`${system} ${user}`)) user = `${user}\n(Respond in valid JSON only.)`;
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
  };
  if (json) body.response_format = { type: 'json_object' };
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${label} API HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error(`${label} 返回空内容`);
  return content;
}

/** 调用 Kimi K3（json=true 强制 json_object；支持 reasoning_effort）。 */
export function chatKimi(opts) {
  return chatCompletions({
    baseUrl: KIMI_BASE_URL, apiKey: KIMI_API_KEY, model: KIMI_MODEL, label: 'Kimi',
    system: opts.system, user: opts.user, json: opts.json ?? true,
    maxTokens: opts.maxTokens ?? 24000, timeoutMs: opts.timeoutMs ?? 10 * 60 * 1000,
    reasoningEffort: opts.reasoningEffort,
  });
}

/** 调用 Qwen（DashScope compatible-mode）。 */
export function chatQwen(opts) {
  return chatCompletions({
    baseUrl: QWEN_BASE_URL, apiKey: DASHSCOPE_API_KEY, model: QWEN_MODEL, label: 'Qwen',
    system: opts.system, user: opts.user, json: opts.json ?? true,
    maxTokens: opts.maxTokens ?? 24000, timeoutMs: opts.timeoutMs ?? 10 * 60 * 1000,
    reasoningEffort: undefined, // qwen-max 不支持该参数
  });
}

/**
 * 统一入口：按 LLM_ENGINE（auto 默认 Kimi 优先）调用，失败自动降级。
 * 返回 { content, engine }。
 */
export async function chatLLM(opts) {
  const order = LLM_ENGINE === 'kimi' ? ['kimi'] : LLM_ENGINE === 'qwen' ? ['qwen'] : ['kimi', 'qwen'];
  const errors = [];
  for (const engine of order) {
    try {
      const content = await (engine === 'kimi' ? chatKimi(opts) : chatQwen(opts));
      return { content, engine };
    } catch (err) {
      errors.push(`${engine}: ${err.message}`);
      if (engine === 'kimi' && order.length > 1) console.warn(`[llm] Kimi 失败，自动切换 Qwen：${err.message}`);
    }
  }
  throw new Error(`LLM 全部失败（${LLM_ENGINE}）：${errors.join(' | ')}`);
}
