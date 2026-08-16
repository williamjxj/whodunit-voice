# R2 Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cloudflare R2 object storage to whodunit-voice so ComfyUI-generated character images are uploaded to the `whodunit` bucket and, when `R2_IMAGES_ENABLED=1`, served to the browser through a zero-dependency SigV4 proxy in `server.js` with local-file fallback.

**Architecture:** A new shared `r2.mjs` module (repo root) implements AWS SigV4 signing with only `node:crypto` + global `fetch`, ported from the user's `rh-comfyui-app/src/lib/r2.ts`. `comfyui/generate.mjs` uploads each generated image after the local write (warn-and-continue on failure). `server.js` intercepts `GET /characters/*.png` requests and proxies them from R2 (with a small FIFO cache), falling back to the existing static file handler. The client (`public/app.js`) is unchanged — relative URLs keep working.

**Tech Stack:** Node >= 18 ESM, zero npm dependencies, global `fetch`, `node:crypto` (createHash/createHmac), `node:test` (built-in test runner, zero deps), Cloudflare R2 (S3-compatible).

## Global Constraints

- **Zero npm dependencies**: `r2.mjs` must use only `node:crypto` + global `fetch` + `node:fs`/`node:path`/`node:url`. No `aws-sdk`, no `dotenv`.
- **Env resolution**: `r2.mjs` resolves env as `{ ...readDotEnv(), ...process.env }` (process env wins). Its `.env` parser must match `server.js`'s `loadEnv()` exactly (skip `#` comments and blank lines; split on first `=`; trim).
- **Env aliases** (first present wins): account id = `ACCOUNT_ID` | `R2_ACCOUNT_ID` | `CLOUDFLARE_ACCOUNT_ID`; bucket = `BUCKET_NAME` | `R2_BUCKET_NAME`, else parse from `S3_API`; endpoint = `R2_ENDPOINT` override, else derive `https://<accountId>.r2.cloudflarestorage.com` (or the `S3_API` origin).
- **Single gate**: R2 is enabled iff all four creds resolve **and** `R2_IMAGES_ENABLED` ∈ {`1`, `true`, `yes`, `on`} (case-insensitive). This gates BOTH upload and serve.
- **R2 object keys** mirror client URLs: `characters/<caseId>/<charId>_<variant>.png`.
- **Serving contract**: only intercept `pathname.startsWith('/characters/')` AND `/\.png$/i`. Non-PNG paths (e.g. `/characters/manifest.json`) fall straight through to `serveStatic`. R2 404 or error → fall back to `serveStatic`. R2 success → `Content-Type: image/png`, `Content-Length`, no `Cache-Control` override.
- **Upload contract**: local file is the source of truth. Upload failure → `console.warn`, never throw/abort generation. `--dry-run`/`--build-only` produce no files, hence no uploads.
- **SigV4 specifics (from rh-comfyui-app commit c47554c)**: region `auto`, service `s3`; sign `host`, `x-amz-date`, `x-amz-content-sha256` always; sign `content-type` when set; **sign `content-length` when a body is present** (R2 rejects otherwise); body hash = hex sha256 (empty string when no body); Authorization = `AWS4-HMAC-SHA256 Credential=<keyId>/<dateStamp>/auto/s3/aws4_request, SignedHeaders=..., Signature=...`.
- **Git discipline**: the working tree contains the user's unrelated staged WIP. NEVER `git add -A` / `git add .`. Stage only the feature files listed in each commit step (pathspec). Committing `comfyui/generate.mjs`, `.gitignore`, `docs/SPEC.md`, `docs/PLAN.md` will include pre-existing staged edits on those files — this is expected and acceptable (they are all touched by this feature); do not try to separate them.
- **Anti-cheat**: never introduce an endpoint or code path that ships `solution`/`secret`/`guilt` to the client. R2 only serves images.
- **Test runner**: use built-in `node --test` (Node >= 18). Tests live in `test/`. Live tests must skip when R2 not enabled: `{ skip: !isR2Enabled() }`.

---
## File Structure

| File | Responsibility | Action |
|---|---|---|
| `r2.mjs` | Zero-dep SigV4 R2 client (config, gate, sign, put, get) | Create |
| `test/r2.test.mjs` | Unit tests (config aliases, gate, signature) + live round-trip | Create |
| `comfyui/generate.mjs` | Upload each saved image to R2 after local write | Modify |
| `server.js` | R2-proxy `/characters/*.png` + FIFO cache + local fallback | Modify |
| `.env.example` | Document R2 env vars | Modify |
| `.gitignore` | Add `public/characters/` | Modify |
| `public/characters/` (index) | Untrack the generated images | `git rm -r --cached` |
| `AGENTS.md` | Architecture + verify notes for R2 | Modify |
| `docs/SPEC.md` | R2 section | Modify |
| `docs/PLAN.md` | Verification log entry | Modify |

---

### Task 1: `r2.mjs` — zero-dependency SigV4 R2 client + tests

**Files:**
- Create: `r2.mjs`
- Create: `test/r2.test.mjs`

**Interfaces:**
- Consumes: nothing (self-contained; Node builtins only).
- Produces:
  - `resolvedEnv()` → `{ [key]: string }` (process env wins over `.env`)
  - `r2Config(env = resolvedEnv())` → `{ endpoint, accessKeyId, secretAccessKey, bucket }` (all strings, empty when absent)
  - `isR2Enabled(env = resolvedEnv())` → `boolean`
  - `signR2Request({ endpoint, accessKeyId, secretAccessKey, method, path, body?, contentType?, date? })` → `Record<string,string>` (headers incl. `authorization`)
  - `r2PutObject(key, buf, contentType = 'image/png')` → `Promise<void>` (throws on non-2xx)
  - `r2GetObject(key)` → `Promise<Buffer | null>` (null on 404, throws on other errors)

- [ ] **Step 1: Write the failing tests** — create `test/r2.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { r2Config, isR2Enabled, signR2Request, r2GetObject, r2PutObject } from '../r2.mjs';

const FULL = { ACCOUNT_ID: 'abc123', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', BUCKET_NAME: 'whodunit' };

test('r2Config: ACCOUNT_ID + BUCKET_NAME (user .env style)', () => {
  const cfg = r2Config(FULL);
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
  assert.equal(cfg.bucket, 'whodunit');
});

test('r2Config: R2_ACCOUNT_ID / R2_BUCKET_NAME (rh-comfyui-app style)', () => {
  const cfg = r2Config({ R2_ACCOUNT_ID: 'abc123', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET_NAME: 'nfsw' });
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
  assert.equal(cfg.bucket, 'nfsw');
});

test('r2Config: CLOUDFLARE_ACCOUNT_ID alias', () => {
  const cfg = r2Config({ CLOUDFLARE_ACCOUNT_ID: 'abc123', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', BUCKET_NAME: 'b' });
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
});

test('r2Config: S3_API parsed into endpoint + bucket (LianHuanAI style)', () => {
  const cfg = r2Config({ S3_API: 'https://abc123.r2.cloudflarestorage.com/comic', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' });
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
  assert.equal(cfg.bucket, 'comic');
});

test('r2Config: R2_ENDPOINT overrides account derivation', () => {
  const cfg = r2Config({ ...FULL, R2_ENDPOINT: 'https://custom.example.com' });
  assert.equal(cfg.endpoint, 'https://custom.example.com');
});

test('isR2Enabled: false when flag absent or falsy', () => {
  assert.equal(isR2Enabled(FULL), false);
  assert.equal(isR2Enabled({ ...FULL, R2_IMAGES_ENABLED: '0' }), false);
  assert.equal(isR2Enabled({ ...FULL, R2_IMAGES_ENABLED: 'FALSE' }), false);
});

test('isR2Enabled: true for 1/true/yes/on (case-insensitive)', () => {
  for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) {
    assert.equal(isR2Enabled({ ...FULL, R2_IMAGES_ENABLED: v }), true);
  }
});

test('isR2Enabled: false when any credential missing', () => {
  assert.equal(isR2Enabled({ R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', BUCKET_NAME: 'b', R2_IMAGES_ENABLED: '1' }), false);
  assert.equal(isR2Enabled({ ...FULL, R2_IMAGES_ENABLED: '1', R2_SECRET_ACCESS_KEY: '' }), false);
});

test('signR2Request: deterministic, correct shape, signs content-length', () => {
  const date = new Date('2026-08-15T00:00:00Z');
  const opts = {
    endpoint: 'https://abc123.r2.cloudflarestorage.com', accessKeyId: 'AK', secretAccessKey: 'SK',
    method: 'PUT', path: '/whodunit/characters/jade-pavilion/zhao_logo.png',
    body: Buffer.from('hello'), contentType: 'image/png', date,
  };
  const a = signR2Request(opts);
  assert.equal(a.authorization, signR2Request(opts).authorization); // deterministic
  assert.equal(a['x-amz-date'], '20260815T000000Z');
  assert.equal(a['x-amz-content-sha256'], '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'); // sha256('hello')
  assert.equal(a['content-length'], '5');
  assert.match(a.authorization, /^AWS4-HMAC-SHA256 Credential=AK\/20260815\/auto\/s3\/aws4_request, /);
  assert.match(a.authorization, /SignedHeaders=content-length;content-type;host;x-amz-content-sha256;x-amz-date/);
});

test('signR2Request: GET signs empty payload, no content-length', () => {
  const date = new Date('2026-08-15T00:00:00Z');
  const h = signR2Request({ endpoint: 'https://abc123.r2.cloudflarestorage.com', accessKeyId: 'AK', secretAccessKey: 'SK', method: 'GET', path: '/whodunit/characters/a.png', date });
  assert.equal(h['x-amz-content-sha256'], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); // sha256('')
  assert.ok(!('content-length' in h));
  assert.match(h.authorization, /SignedHeaders=host;x-amz-content-sha256;x-amz-date/);
});

test('live: r2PutObject + r2GetObject round-trip', { skip: !isR2Enabled() }, async () => {
  const buf = Buffer.from('whodunit-r2-live-check-' + Date.now());
  const key = 'test/whodunit-r2-live-check.png';
  await r2PutObject(key, buf, 'image/png');
  const back = await r2GetObject(key);
  assert.ok(back, 'r2GetObject should return the uploaded buffer');
  assert.deepEqual(back, buf);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/r2.test.mjs`
Expected: FAIL — `Cannot find module '../r2.mjs'` (module does not exist yet).

- [ ] **Step 3: Write the implementation** — create `r2.mjs`:

```js
// r2.mjs — Cloudflare R2 (S3-compatible) client, zero npm dependencies.
// AWS SigV4 ported from rh-comfyui-app/src/lib/r2.ts (hand-rolled, node:crypto only).
// Transport: Node's global fetch (Node >= 18). Env aliases stay compatible with the
// user's other repos (LianHuanAI S3_API / rh-comfyui-app R2_ACCOUNT_ID).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE = 's3';
const REGION = 'auto';
const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

function readDotEnv() {
  const env = {};
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/r2.test.mjs`
Expected: all tests PASS. The `live:` test runs only if `.env` has `R2_IMAGES_ENABLED=1` + creds (it does in this repo) — it must PASS too (real upload + fetch round-trip). If the live test fails, debug SigV4 (check `content-length` in SignedHeaders; verify endpoint/bucket from `.env`; check the R2 dashboard error in the R2 console).

- [ ] **Step 5: Commit**

```bash
git add r2.mjs test/r2.test.mjs
git commit -m "feat: R2 SigV4 客户端模块 r2.mjs + node:test 单测（含 live 回环）"
```

---

### Task 2: `comfyui/generate.mjs` — upload generated images to R2

**Files:**
- Modify: `comfyui/generate.mjs:20` (imports), `comfyui/generate.mjs:222-231` (`downloadImage`)

**Interfaces:**
- Consumes: `isR2Enabled()` and `r2PutObject(key, buf, contentType)` from `../r2.mjs` (Task 1).
- Produces: after each real generation, the image exists locally at `public/characters/<caseId>/<charId>_<variant>.png` AND at R2 key `characters/<caseId>/<charId>_<variant>.png`. No signature changes for other callers.

- [ ] **Step 1: Add the import** — modify line 20 of `comfyui/generate.mjs`:

```js
import { characters, NEGATIVE, buildPrompt, CHECKPOINT_ALIASES } from './config/characters.mjs';
import { isR2Enabled, r2PutObject } from '../r2.mjs';
```

- [ ] **Step 2: Write the failing test (live round-trip is already covered in Task 1)** — verification-only task step: run the existing Task 1 live test with R2 enabled and confirm upload works BEFORE wiring the generator, so a failure is attributable to the generator change, not the module:

Run: `node --test test/r2.test.mjs`
Expected: PASS (including the `live:` test).

- [ ] **Step 3: Implement the upload hook** — replace the body of `downloadImage` (currently lines 222-231) with:

```js
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
```

Key derivation: `path.relative(path.join(ROOT, 'public'), destPath)` turns `/repo/public/characters/jade-pavilion/zhao_logo.png` into `characters/jade-pavilion/zhao_logo.png` (with `/` separators forced). `ROOT` is already defined at line 23. The `logo` variant goes through this same function, so it uploads too.

- [ ] **Step 4: Verify the hook**

Run: `node --check comfyui/generate.mjs`
Expected: no output (syntax OK).

Then run a **real, cheap** generation end-to-end only if ComfyUI is running at `http://127.0.0.1:8188`:
`node comfyui/generate.mjs --char zhao --variants logo`
Expected: prints `→ public/characters/jade-pavilion/zhao_logo.png` AND `R2 ↑ characters/jade-pavilion/zhao_logo.png`. (If the file already exists and wasn't `--force`, the skip path runs — use `--force` to force regeneration, or skip this check if ComfyUI is offline; the upload logic is identical for all variants and covered by the Task 1 live test.)

- [ ] **Step 5: Commit**

```bash
git add comfyui/generate.mjs
git commit -m "feat: comfyui 出图同步上传 R2（失败告警不中断）"
```

> Note: `comfyui/generate.mjs` is a pre-existing staged new file in the user's WIP; this commit includes its full current content (expected per Global Constraints).

---

### Task 3: `server.js` — R2-proxied serving with local fallback + cache

**Files:**
- Modify: `server.js:5` (imports), `server.js:34` (env consts), `server.js:159` (cache consts), insert function before `serveStatic` (line 758), `server.js:995` (handler dispatch), `server.js:1002-1009` (startup log)

**Interfaces:**
- Consumes: `isR2Enabled()` and `r2GetObject(key)` from `./r2.mjs` (Task 1).
- Produces: `GET /characters/<caseId>/<charId>_<variant>.png` returns R2 bytes (or local file fallback). Client unchanged.

- [ ] **Step 1: Add the import** — after line 5 (`import { randomUUID, createHash } from 'node:crypto';`):

```js
import { isR2Enabled, r2GetObject } from './r2.mjs';
```

- [ ] **Step 2: Add the R2 flag const** — after line 34 (`const EDGE_TTS_ENABLED = ...`):

```js
const R2_IMAGES_ENABLED = isR2Enabled();
```

- [ ] **Step 3: Add the image cache** — next to `const ttsCache = new Map();` (line 159):

```js
const IMG_CACHE_MAX = 50;
const imgCache = new Map();
let lastImgWarnAt = 0;
```

- [ ] **Step 4: Add the serving function** — insert immediately before `function serveStatic(` (line 758):

```js
/* ---- R2-proxied character images (fall back to local static files) ---- */
async function serveR2Image(res, pathname) {
  const key = pathname.slice(1); // 'characters/<caseId>/<charId>_<variant>.png'
  const cached = imgCache.get(key);
  if (cached) {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': cached.length });
    res.end(cached);
    return true;
  }
  let buf = null;
  try {
    buf = await r2GetObject(key);
  } catch (err) {
    if (Date.now() - lastImgWarnAt > 10000) {
      lastImgWarnAt = Date.now();
      console.warn(`R2 取图失败，回退本地：${err.message}`);
    }
  }
  if (!buf) return false; // 404 or error -> serveStatic (local file) path
  if (imgCache.size >= IMG_CACHE_MAX) imgCache.delete(imgCache.keys().next().value);
  imgCache.set(key, buf);
  res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': buf.length });
  res.end(buf);
  return true;
}
```

- [ ] **Step 5: Wire the handler dispatch** — replace line 995 (`serveStatic(req, res, pathname);`) with:

```js
    if (R2_IMAGES_ENABLED && pathname.startsWith('/characters/') && /\.png$/i.test(pathname)) {
      if (await serveR2Image(res, pathname)) return;
    }

    serveStatic(req, res, pathname);
```

(Keep the exact 4-space indentation of the surrounding `try` block.)

- [ ] **Step 6: Add the startup log** — inside the `server.listen(PORT, HOST, ...)` callback (after the existing TTS lines, ~line 1009):

```js
  if (R2_IMAGES_ENABLED) console.log('R2: /characters/* 图片从 Cloudflare R2 提供（缺失回退本地）');
```

- [ ] **Step 7: Verify**

Run: `node --check server.js`
Expected: no output (syntax OK).

Then run the server and probe both modes:
```bash
node server.js &   # uses .env (R2_IMAGES_ENABLED=1)
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://127.0.0.1:4310/characters/jade-pavilion/zhao_logo.png
```
Expected: `200 image/png` (served from R2; local file exists too, so to prove R2 served it, temporarily `mv public/characters/jade-pavilion/zhao_logo.png /tmp/` and re-curl — still `200`; then restore). Also verify a cache hit (curl twice — second is from `imgCache`) and a non-PNG path is untouched: `curl -s http://127.0.0.1:4310/characters/manifest.json | head -c 60` → JSON, not PNG. Finally kill the server.

- [ ] **Step 8: Commit**

```bash
git add server.js
git commit -m "feat: /characters/* 图片经 R2 SigV4 代理提供（回退本地 + 内存缓存）"
```

---

### Task 4: `.env.example`, `.gitignore`, untrack `public/characters/`

**Files:**
- Modify: `.env.example` (append R2 section)
- Modify: `.gitignore` (append `public/characters/`)
- Index: `git rm -r --cached public/characters`

- [ ] **Step 1: Append the R2 section to `.env.example`**

```bash
# Cloudflare R2 对象存储（可选）。R2_IMAGES_ENABLED=1 时：
#   出图上传 R2（comfyui/generate.mjs）+ /characters/* 从 R2 提供，缺失回退本地（server.js）
R2_IMAGES_ENABLED=0
ACCOUNT_ID=                      # 也接受 R2_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
BUCKET_NAME=whodunit             # 也接受 R2_BUCKET_NAME，或从 S3_API 解析
# R2_ENDPOINT=                   # 可选覆盖，默认 https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

- [ ] **Step 2: Append to `.gitignore`** (after the existing `__pycache__/` line)

```
# Generated character images (served from Cloudflare R2 when R2_IMAGES_ENABLED=1)
public/characters/
```

- [ ] **Step 3: Untrack the already-staged images**

```bash
git rm -r --cached public/characters
```

Expected: ~40 files removed from the index (`rm 'public/characters/...'` lines), working-tree files untouched. This prevents the next `git commit` from sweeping the PNGs into git — the user's stated goal.

- [ ] **Step 4: Verify**

Run: `git status --short | grep characters`
Expected: no `public/characters` entries in the index (only untracked `??` or nothing, since the `.gitignore` now covers them). `ls public/characters/jade-pavilion/zhao_logo.png` must still exist on disk.

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: R2 环境变量示例 + gitignore public/characters（生图不再入库）"
```

---

### Task 5: Docs sync + full verification

**Files:**
- Modify: `AGENTS.md` (architecture bullet + verify line)
- Modify: `docs/SPEC.md` (R2 section)
- Modify: `docs/PLAN.md` (verification log entry)

- [ ] **Step 1: Update `AGENTS.md`**

In the **Run / verify** section, add after the `curl http://127.0.0.1:4310/api/health` line:

```markdown
- R2 tests (if enabled): `node --test test/r2.test.mjs` — unit tests for config/signing + a live upload/fetch round-trip (auto-skips when `R2_IMAGES_ENABLED` is off).
```

In the **Architecture** section, add a bullet:

```markdown
- R2 (optional): `r2.mjs` — zero-dependency SigV4 client (alias env: `ACCOUNT_ID`/`R2_ACCOUNT_ID`/`S3_API`, `BUCKET_NAME`/`R2_BUCKET_NAME`, `R2_ENDPOINT`). When `R2_IMAGES_ENABLED=1`: `comfyui/generate.mjs` uploads each generated image to bucket `whodunit` under `characters/<caseId>/<id>_<variant>.png` (warn-and-continue); `server.js` serves `/characters/*.png` from R2 with local fallback + FIFO cache. `public/characters/` is gitignored.
```

Also in **Rules that must not be broken**, append: "R2 serves images only — the proxy must never touch `solution`/`secret`/`guilt`."

- [ ] **Step 2: Update `docs/SPEC.md`** — add a short "R2 图片存储（v0.7）" section describing: the env vars, the two modes (local / R2), the SigV4 proxy serving contract, the upload-on-generate behavior, and the fallback chain. Reference `docs/oc_r2_image_storage_design.md` for the full design.

- [ ] **Step 3: Update `docs/PLAN.md`** — append a verification log entry dated 2026-08-15: R2 feature implemented; `node --test` live round-trip result; curl results for both modes; note that `public/characters/` is now gitignored.

- [ ] **Step 4: Full verification suite**

```bash
node --check r2.mjs server.js comfyui/generate.mjs test/r2.test.mjs
node --test test/r2.test.mjs                      # all pass incl. live
node server.js &                                   # R2 mode (per .env)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4310/api/health   # 200
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://127.0.0.1:4310/characters/jade-pavilion/zhao_logo.png  # 200 image/png
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4310/characters/midnight-meridian/nonexistent_x.png  # 404 (local fallback miss)
# Local mode regression: R2_IMAGES_ENABLED=0 node server.js → same two curls still 200/404
# Browser check (Playwright): load /, enter a case, portraits render with R2 on; delete a local PNG, reload, still renders
```

Expected: every check passes. The `404` case proves the local-fallback miss path; the Playwright pass proves the full client path (node-only checks miss UI wiring).

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/SPEC.md docs/PLAN.md
git commit -m "docs: 同步 R2 图片存储（AGENTS/SPEC/PLAN）"
```

> Note: `docs/SPEC.md` and `docs/PLAN.md` carry pre-existing staged user edits; this commit includes them (expected per Global Constraints).

---

## Self-Review

**1. Spec coverage** — cross-checked against `docs/oc_r2_image_storage_design.md`:
- §4.1 shared `r2.mjs` (config/gate/sign/put/get) → Task 1 ✓
- §4.2 upload on save in `downloadImage` + warn-and-continue → Task 2 ✓
- §4.3 proxy serving + `.png` guard + FIFO cache (50) + rate-limited warn + startup log → Task 3 ✓
- §5 env example with aliases → Task 4 ✓
- §7 gitignore + untrack → Task 4 ✓
- §7 docs sync (AGENTS/SPEC/PLAN) → Task 5 ✓
- §8 verification plan (node --check, curl on/off, live round-trip, Playwright) → Task 5 ✓
- Non-PNG paths bypass proxy → Task 3 Step 5 guard ✓
- Content-Type via MIME behavior: interception is `.png`-only, so `image/png` literal is equivalent to `MIME['.png']` ✓

**2. Placeholder scan** — no TBD/TODO; every code step has complete code blocks; the only conditional step (Task 2 Step 4) is explicitly gated on ComfyUI availability and has a documented skip path.

**3. Type consistency** — `r2Config(env)`, `isR2Enabled(env)`, `signR2Request(...)`, `r2PutObject(key, buf, contentType)`, `r2GetObject(key)` are defined once (Task 1) and used with identical signatures in Tasks 2/3 and tests. Cache const `IMG_CACHE_MAX` consistent between Task 3 Steps 3/4. `R2_IMAGES_ENABLED` const name used consistently in Steps 2/5/6.

**Note on commits:** per Global Constraints, feature commits use pathspecs and will include pre-existing staged WIP content on `comfyui/generate.mjs`, `.gitignore`, `docs/SPEC.md`, `docs/PLAN.md`. This was flagged to the user before implementation.