# AGENTS.md

Voice-driven murder-mystery game: browser frontend (`public/`) talks to a zero-dependency Node server (`server.js`) that proxies roleplay/verdict prompts to DeepSeek. Three built-in case packs (two EN + one ZH). All data is fake.

## Run / verify

- Zero npm dependencies, no build, no lint, no tests. Node >= 18, ESM (`"type": "module"`).
- `node server.js` (or `npm start`) → serves `public/` + API on `127.0.0.1:4310` **and** `[::1]` (dual-stack bind; macOS browsers hit `localhost` via IPv6 — don't remove the second listener).
- Env: `cp .env.example .env`, fill `DEEPSEEK_API_KEY`. `server.js` parses `.env` with its own mini-parser (no dotenv); real process env wins. `.env` is gitignored — never commit keys.
- Verification without tests: `node --check server.js`, then `curl http://127.0.0.1:4310/api/health`. DeepSeek-dependent endpoints (`/api/chat`, `/api/accuse`) fail with 502 if the key is bad/quotas exhausted.
- R2 tests (if enabled): `node --test test/r2.test.mjs` — unit tests for config/signing + a live upload/fetch round-trip (auto-skips when `R2_IMAGES_ENABLED` is off).

## Architecture

- `server.js` — static file serving + API. Case packs loaded **once at startup** into memory: editing/adding JSON under `data/cases/` requires a server restart.
- API: `GET /api/health`, `GET /api/cases`, `GET /api/case?caseId=`, `POST /api/chat` `{caseId, suspectId, messages, question}`, `POST /api/accuse` `{caseId, suspectId, motive, evidence[]}`, `GET /api/tts/voices`, `POST /api/tts` `{text, voice, rate?, pitch?}` → `audio/wav`. Same-origin; no CORS.
- `public/app.js` — all client logic incl. the `I18N` en/zh dictionary; `public/index.html`, `public/styles.css`.
- LLM limits (keep if you touch them): chat history sanitized to last 12 messages × 600 chars; question capped at 500 chars; 45s request timeout. Suspect prompts are built per-suspect from `personality/alibi/secret/revealRules/tells`; judge prompt demands strict JSON, parsed by `extractJson()` (strips ``` fences, slices first `{...}`). Both prompts are bilingual, keyed on `case.lang === 'zh'`. `/api/chat` replies may end with a `[STATE]{...}` stage note — the server strips it and returns structured `mood`/`tell` (falls back to `calm` on parse failure).
- TTS (v0.5/v0.6): `POST /api/tts` accepts `{text, voice, rate?, pitch?, provider?: auto|sambert|edge}`. Two providers:
  - `sambert` — DashScope Sambert via native Node WebSocket (`wss://dashscope.aliyuncs.com/api-ws/v1/inference`, `Authorization: Bearer $DASHSCOPE_API_KEY`), returns WAV. Registry: `TTS_VOICES` in `server.js`.
  - `edge` — Microsoft Edge TTS, free, no key (curated registry `EDGE_VOICES`, live endpoint has ~322 voices; protocol: `wss://speech.platform.bing.com/...` with a `Sec-MS-GEC` token), returns MP3. `SAMBERT_TO_EDGE` maps each Sambert voice to a same-gender/age Edge voice so per-suspect flavor survives the free provider.
  - Auto-priority: Sambert if `DASHSCOPE_API_KEY` set, else Edge, else client browser `speechSynthesis`. Suspects declare `voice`/`voiceRate`/`voicePitch` in `suspects.json` (safe to send — no secret/guilt). `GET /api/tts/voices` returns both registries + `activeProvider` + `sambertToEdge`. TTS text is capped at 1000 chars; 45s (Sambert) / 30s (Edge) timeouts; small in-memory cache.
- R2 (optional): `comfyui/cloudflareR2/r2.mjs` — zero-dependency SigV4 client (alias env: `ACCOUNT_ID`/`R2_ACCOUNT_ID`/`S3_API`, `BUCKET_NAME`/`R2_BUCKET_NAME`, `R2_ENDPOINT`). When `R2_IMAGES_ENABLED=1`: `comfyui/generate.mjs` uploads each generated image to bucket `whodunit` under `characters/<caseId>/<id>_<variant>.png` (warn-and-continue); `server.js` serves `/characters/*.png` from R2 with local fallback + FIFO cache; `node comfyui/cloudflareR2/sync.mjs` bulk-uploads existing `public/characters/` images without re-running ComfyUI. `public/characters/` is gitignored.

## Adding a case (pluggable, no code changes)

Create `data/cases/<caseId>/` with exactly three files or the pack is silently skipped (`console.warn` at startup):

- `case.json` — id, title, titleEn, lang (`"en"`|`"zh"`), tagline, victim{name,age,emoji,bio}, location, time, briefing, scene, timeline[], relations[], questions[] (≤6), difficulty (1-3), estimatedMinutes, `solution{killer,killerName,weapon,motive,summary}`, `epilogues{solved_brilliant,solved_thin,wrong}`, `ranks[{min,title,emoji}]`.
- `suspects.json` — per suspect: id, name, role, emoji, age, shortBio, personality, alibi, secret, `guilt` (bool), revealRules, tells.
- `clues.json` — per clue (8-10 per case): id, title, description, `source` (suspect id or `"scene"`), `keywords[]`, hint.

New suspects should also set `voice` (a valid id from `server.js` `TTS_VOICES`), `voiceRate` (0.5–2), `voicePitch` (0.5–2) for per-character voices.

Use an existing pack (`data/cases/jade-pavilion/`) as the schema reference.

## Rules that must not be broken

- **Anti-cheat**: `/api/case` must never send `solution`, `secret`, or `guilt` — it strips suspects to id/name/role/emoji/age/shortBio only. Truth exists only server-side (`case.json.solution`, `suspects[].guilt`). New endpoints must preserve this.
- **Clue unlocking is deterministic client-side keyword matching** (`unlockClues()` in `public/app.js`): the player's question text is matched case-insensitively against `clues[].keywords`. Not LLM-based. Keywords should be words players will plausibly speak; +20 pts per clue, +40 for correct accusation.
- **R2 serves images only** — the proxy must never touch `solution`/`secret`/`guilt`.

## i18n gotchas

- New UI text must be added to **both** `I18N.en` and `I18N.zh` in `app.js`, wired via `data-i18n` / `data-i18n-ph` attributes.
- `applyLang()` sets `textContent` — do **not** put `data-i18n` on an element containing child nodes (e.g. a button wrapping a `<span>` counter); it clobbers them. This caused a real bug (v0.3). Put the attribute on an inner span instead.
- UI, Web Speech recognition, and TTS language all follow the case's `lang`.
- **TTS voice must be lang-matched**: with DashScope enabled the client plays server WAVs via Web Audio (`speak()` in `app.js`); the browser `speechSynthesis` fallback uses `pickVoice(lang)` — assigning `utter.voice` overrides `utter.lang`, so a fixed en-US voice makes Chinese replies silent on macOS. The 🔊 TTS toggle persists under `localStorage: whodunit_ttsOn`.

## Browser constraints

- Speech recognition needs Chrome/Edge/Safari on a secure context (localhost qualifies); Firefox falls back to text input. Verify with a real browser (Playwright) — node-only checks miss UI wiring.

## Docs

- `docs/SPEC.md` (spec, API contract, v0.2/v1.0/v0.4 notes), `docs/PLAN.md` (implementation + verification log, incl. v0.3/v0.4 fixes), `docs/resources.md` (runtime requirements). Keep these in sync when the API or case schema changes — trust the code, not the prose.
