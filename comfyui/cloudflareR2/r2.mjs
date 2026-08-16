// r2.mjs — Cloudflare R2 (S3-compatible) client, zero npm dependencies.
// AWS SigV4 ported from rh-comfyui-app/src/lib/r2.ts (hand-rolled, node:crypto only).
// Transport: Node's global fetch (Node >= 18). Env aliases stay compatible with the
// user's other repos (LianHuanAI S3_API / rh-comfyui-app R2_ACCOUNT_ID).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..'); // comfyui/cloudflareR2 -> repo root
const SERVICE = 's3';
const REGION = 'auto';
const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

function readDotEnv() {
  const env = {};
  try {
    const raw = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch { /* .env optional; process env wins anyway */ }
  return env;
}

export function resolvedEnv() {
  return { ...readDotEnv(), ...process.env };
}

export function r2Config(env = resolvedEnv()) {
  const accountId = env.ACCOUNT_ID || env.R2_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || '';
  const s3Api = String(env.S3_API || '');
  let endpoint = String(env.R2_ENDPOINT || '').trim();
  let bucket = String(env.BUCKET_NAME || env.R2_BUCKET_NAME || '').trim();
  if (!endpoint) {
    if (s3Api) endpoint = new URL(s3Api).origin;
    else if (accountId) endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }
  if (!bucket && s3Api) bucket = new URL(s3Api).pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    accessKeyId: String(env.R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: String(env.R2_SECRET_ACCESS_KEY || '').trim(),
    bucket,
  };
}

export function isR2Enabled(env = resolvedEnv()) {
  const cfg = r2Config(env);
  const hasAll = Boolean(cfg.endpoint && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucket);
  if (!hasAll) return false;
  return ENABLED_VALUES.has(String(env.R2_IMAGES_ENABLED ?? '').trim().toLowerCase());
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function signingKey(secret, dateStamp) {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function encodePath(key) {
  return key.split('/').map((s) => encodeURIComponent(s)).join('/');
}

export function signR2Request({ endpoint, accessKeyId, secretAccessKey, method, path, body, contentType, date = new Date() }) {
  const amzDateValue = amzDate(date);
  const dateStamp = amzDateValue.slice(0, 8);
  const host = new URL(endpoint).host;
  const payloadHash = body ? sha256Hex(body) : sha256Hex('');
  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDateValue,
  };
  if (contentType) headers['content-type'] = contentType;
  if (body) headers['content-length'] = String(body.length);

  const canonicalHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase()).sort()
    .map((k) => `${k}:${String(headers[k]).trim()}\n`).join('');
  const signedHeaders = Object.keys(headers).map((k) => k.toLowerCase()).sort().join(';');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDateValue,
    `${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = hmac(signingKey(secretAccessKey, dateStamp), stringToSign).toString('hex');
  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

async function r2Fetch(method, key, body, contentType) {
  const cfg = r2Config();
  const objectPath = `/${cfg.bucket}/${encodePath(key)}`;
  const headers = signR2Request({
    endpoint: cfg.endpoint,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    method,
    path: objectPath,
    body,
    contentType,
  });
  const { host, ...fetchHeaders } = headers; // fetch derives Host from the URL; host stays signed
  const res = await fetch(`${cfg.endpoint}${objectPath}`, { method, headers: fetchHeaders, body });
  const buffer = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buffer };
}

export async function r2PutObject(key, buf, contentType = 'image/png') {
  const { status } = await r2Fetch('PUT', key, buf, contentType);
  if (status < 200 || status >= 300) throw new Error(`R2 upload failed (HTTP ${status})`);
}

export async function r2GetObject(key) {
  const { status, buffer } = await r2Fetch('GET', key, undefined, undefined);
  if (status === 404) return null;
  if (status < 200 || status >= 300) throw new Error(`R2 fetch failed (HTTP ${status})`);
  return buffer;
}

export async function r2DeleteObject(key) {
  const { status } = await r2Fetch('DELETE', key, undefined, undefined);
  if (status === 404) return false;
  if (status < 200 || status >= 300) throw new Error(`R2 delete failed (HTTP ${status})`);
  return true;
}
