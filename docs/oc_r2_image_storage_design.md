# R2 Image Storage Design (whodunit-voice)

Status: approved 2026-08-15 (design review); awaiting spec review
Author: OpenCode (`oc_` prefix per docs/ naming convention)
Feature: Cloudflare R2 Object Storage for generated character images

## 1. Goal

When `comfyui/generate.mjs` generates character images via the local ComfyUI
API, save each image in **two** places:

1. `public/characters/` (local — unchanged, existing behavior)
2. Cloudflare R2 bucket `whodunit` (new)

A `.env` flag `R2_IMAGES_ENABLED` gates both directions:

- `R2_IMAGES_ENABLED=1` → images are **served** from the R2 bucket (proxied
  through `server.js`), with fallback to local files; generation also
  **uploads** each new image to R2.
- Flag unset / `0` / missing creds → exactly today's behavior (local only).

Outcome: `public/characters/` is added to `.gitignore` so generated images are
not pushed to GitHub, saving repo space. A fresh clone with R2 enabled still
renders all portraits (served from R2 via the local server).

## 2. Chosen approach (decided with user)

- **Server proxy serving** — the browser keeps using relative URLs
  `characters/<caseId>/<id>_<variant>.png`; `server.js` intercepts those
  requests, fetches the object from R2 with a SigV4-signed `GET`, streams it
  back, and falls back to the local file on miss/error. `public/app.js`
  (specifically `charImg()`) is **unchanged**.
- **Warn-and-continue uploads** — an R2 upload failure during generation logs
  a warning but does not abort that character; the local file is the source
  of truth.
- **Single gate** — `R2_IMAGES_ENABLED` gates both upload and serve.

Alternatives considered and rejected: direct public bucket URL in the client
(needs public access enabled on the bucket + a `pub-<id>.r2.dev` URL; user has
none for `whodunit`; forces client changes) and a no-proxy design (incompatible
with private buckets).

## 3. Reference research (from two user-owned R2 repos)

Both repos were researched for patterns; the key reference is
`jxjwilliam/rh-comfyui-app` `src/lib/r2.ts` — a complete hand-rolled AWS SigV4
implementation in TypeScript with zero AWS SDK dependency (~250 lines,
`node:crypto` only). Critical detail from that repo's latest commit
`c47554c`: **`content-length` must be included in the signed headers when a
body is present**, or R2 rejects the request.

- Repo 1 `williamjxj/LianHuanAI` (Python/boto3): parses `S3_API`
  (`https://<account>.r2.cloudflarestorage.com/<bucket>`) with `urlparse`;
  `put_object` single PUT; serves via public `R2_URL`; gated by CLI `--r2` flag.
- Repo 2 `jxjwilliam/rh-comfyui-app` (Next.js/TS, no aws-sdk): endpoint derived
  from `R2_ACCOUNT_ID` (or `R2_ENDPOINT` override); single PUT via
  `node:http`; serves via signed-GET proxy through the server (private-bucket
  safe); gated by `R2_ENABLED=true` + creds.

Both repos use single PUT (no multipart) — this project does the same.

## 4. Components

### 4.1 New shared module `r2.mjs` (repo root)

Zero-dependency AWS SigV4 client for Cloudflare R2, ported from
`rh-comfyui-app/src/lib/r2.ts`. Uses `node:crypto` and Node's global `fetch`
(Node >= 18). Imported by both `server.js` and `comfyui/generate.mjs`.

Exports:

- `isR2Enabled()` → `boolean`
  - True iff creds resolve **and** `R2_IMAGES_ENABLED` is `1`/`true`/`yes`.
  - Single gate for both upload and serve.
- `r2Config()` → `{ endpoint, bucket, accessKeyId, secretAccessKey } | null`
  - Endpoint: `R2_ENDPOINT` override, else `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
  - Account ID aliases (first present wins): `ACCOUNT_ID`, `R2_ACCOUNT_ID`,
    `CLOUDFLARE_ACCOUNT_ID`
  - Bucket aliases: `BUCKET_NAME`, `R2_BUCKET_NAME`; if neither, parse bucket
    out of `S3_API` (repo 1 style: `https://<account>.r2.cloudflarestorage.com/<bucket>`)
    — when `S3_API` is present and `R2_ENDPOINT` is not, its host is also the
    endpoint.
  - Access key: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (both repos use
    these names).
  - Returns `null` (and logs which vars are missing) if required creds absent.
- `r2PutObject(key, buf, contentType)` → `Promise<void>`
  - `PUT /{bucket}/{key}`; body hash `x-amz-content-sha256` = hex sha256 of
    buffer; **signs `content-length`** and `host`; region `auto`, service `s3`;
    `AWS4-HMAC-SHA256` Authorization header.
  - Throws on non-2xx.
- `r2GetObject(key)` → `Promise<Buffer | null>`
  - `GET /{bucket}/{key}`; same signing (empty-string body hash);
    returns `null` on 404, throws on other errors.

### 4.2 `comfyui/generate.mjs` — upload on save

In `downloadImage(img, destPath)`, after `fs.writeFileSync(destPath, buf)`:

- If `isR2Enabled()`: compute R2 key from the dest path relative to the repo
  root with the `public/` segment stripped → `characters/<caseId>/<id>_<variant>.png`,
  then `await r2PutObject(key, buf, 'image/png')`.
- Upload failure → `console.warn('R2 上传失败（已保留本地文件）…')` and
  **continue** (non-fatal). Success → `console.log('R2 ↑ <key>')`.
- `--dry-run` / `--build-only` paths do not generate files, so no upload.
- `manifest.json` is NOT uploaded (client uses deterministic paths).

### 4.3 `server.js` — R2-proxied static serving

In the request handler, before falling through to `serveStatic`:

- If `isR2Enabled()` and `pathname` starts with `/characters/` and ends with an
  image extension (`.png` — all character images are PNG):
  - `r2GetObject(pathname.slice(1))` (pathname has no leading slash after
    slicing; keys are `characters/...`).
  - Success → `200`, `Content-Type` from the existing `MIME` map (defaults
    `image/png`), `Content-Length`, stream buffer. No `Cache-Control`
    override (consistent with current static handler which sets none).
  - Non-image paths under `/characters/` (e.g. `manifest.json`) skip the
    proxy and fall straight through to `serveStatic`.
  - `null` (R2 404) or thrown error → **fall back** to `serveStatic` (local
    file, which may itself 404 → client falls back to emoji as today).
  - Errors are rate-limited to one `console.warn` per few seconds to avoid
    log spam.
- Small in-memory FIFO cache mirroring the existing `ttsCache` pattern
  (`Map` + evict oldest when `size >= MAX`), `MAX = 50`, keyed by pathname.
  Serves repeated portrait loads (suspect list, chat avatars) without
  re-hitting R2. Only successful R2 buffers are cached — misses fall through
  to the local file cheaply. Cache disabled when R2 disabled.

### 4.4 `public/app.js` — unchanged

`charImg()` keeps returning relative `characters/...` URLs. The proxy keeps
R2 transparent to the client.

## 5. Env config (.env.example additions)

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

The user's existing `.env` (using `ACCOUNT_ID` + `BUCKET_NAME` + the two
`R2_*_KEY` vars + `R2_IMAGES_ENABLED=1`) works as-is.

## 6. Error handling & fallback chain

| Condition | Behavior |
|---|---|
| No creds or flag off | `isR2Enabled()` false → exactly today's behavior (local only) |
| R2 object 404 | Serve local file; if also missing → 404 → client emoji fallback |
| R2 network error | Rate-limited warn; serve local |
| R2 upload failure (generate) | Warn; continue; local file kept |
| Bucket private | Fine — only the server's signed GETs touch R2 |

## 7. Housekeeping

- `.gitignore`: add `public/characters/` (covers the `manifest.json` inside).
- Docs: this design doc; then update `AGENTS.md` architecture section,
  `docs/SPEC.md`, and `docs/PLAN.md` (repo convention: keep in sync, trust the
  code not the prose).
- Anti-cheat: untouched. R2 serves images only; no new API endpoint;
  `solution`/`secret`/`guilt` remain server-side only.

## 8. Verification plan

- `node --check r2.mjs server.js comfyui/generate.mjs`
- `node server.js` with `R2_IMAGES_ENABLED=0` → `/characters/...` served from
  local (existing behavior intact).
- With `R2_IMAGES_ENABLED=1`:
  - Existing local images → served (R2 fetch may 404 → local fallback) or
    from R2 once objects exist.
  - A test `r2PutObject`/`r2GetObject` round-trip (upload a known buffer,
    fetch it back, byte-compare) — run as a small script with real creds.
  - `curl -I http://127.0.0.1:4310/characters/<caseId>/<id>_logo.png` →
    `200 image/png`.
  - Temporarily `git rm -r --cached public/characters` after gitignore, verify
    `git status` no longer tracks it.
- Browser check (Playwright): portraits render with R2 enabled and local
  `public/characters` deleted.