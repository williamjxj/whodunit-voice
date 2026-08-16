import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const env = {};
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // .env optional; process env wins anyway
  }
  return env;
}

const env = loadEnv();
const PORT = Number(process.env.PORT || env.PORT || 4310);
const HOST = process.env.HOST || env.HOST || '127.0.0.1';
const API_KEY = process.env.DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.DEEPSEEK_MODEL || env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || env.DASHSCOPE_API_KEY || '';
const TTS_WS_URL = (process.env.DASHSCOPE_TTS_URL || env.DASHSCOPE_TTS_URL || 'wss://dashscope.aliyuncs.com/api-ws/v1/inference').replace(/\/$/, '');
const HAS_NATIVE_WS = typeof WebSocket !== 'undefined';
const EDGE_TTS_ENABLED = String(process.env.EDGE_TTS_ENABLED ?? env.EDGE_TTS_ENABLED ?? '1') !== '0';

const CASES_DIR = path.join(__dirname, 'data', 'cases');
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ---- Sambert voice registry (DashScope 百炼) ----
   All voices are real Sambert model ids. sampleRate = the model's native default;
   every voice accepts 16000 as well. Genders are used by the client to render
   "male/female" labels; langs: zh / en / multi. */
const TTS_VOICES = [
  // 中文 48kHz（高音质，中文+英文）
  { id: 'sambert-zhixiang-v1', name: '磁性男声', gender: 'male', lang: 'zh', sampleRate: 48000, desc: '磁性、浑厚，适合有声读物与沉稳角色' },
  { id: 'sambert-zhinan-v1', name: '广告男声', gender: 'male', lang: 'zh', sampleRate: 48000, desc: '磁性、自信，适合精明角色' },
  { id: 'sambert-zhichu-v1', name: '舌尖男声', gender: 'male', lang: 'zh', sampleRate: 48000, desc: '清晰、标准，通用旁白' },
  { id: 'sambert-zhide-v1', name: '新闻男声', gender: 'male', lang: 'zh', sampleRate: 48000, desc: '沉稳、权威，适合主审官' },
  { id: 'sambert-zhiqi-v1', name: '温柔女声', gender: 'female', lang: 'zh', sampleRate: 48000, desc: '柔和、亲切，适合端庄角色' },
  { id: 'sambert-zhijia-v1', name: '标准女声', gender: 'female', lang: 'zh', sampleRate: 48000, desc: '标准、清晰，通用女声' },
  { id: 'sambert-zhiru-v1', name: '新闻女声', gender: 'female', lang: 'zh', sampleRate: 48000, desc: '专业、流畅，知性角色' },
  { id: 'sambert-zhiqian-v1', name: '资讯女声', gender: 'female', lang: 'zh', sampleRate: 48000, desc: '干练、利落，精明女性' },
  { id: 'sambert-zhiwei-v1', name: '萝莉女声', gender: 'female', lang: 'zh', sampleRate: 48000, desc: '活泼、可爱，适合年轻角色' },
  // 中文 16kHz 特色音色
  { id: 'sambert-zhilun-v1', name: '悬疑解说男声', gender: 'male', lang: 'zh', sampleRate: 16000, desc: '悬疑氛围男声，适合江湖老角色' },
  { id: 'sambert-zhishuo-v1', name: '自然男声', gender: 'male', lang: 'zh', sampleRate: 16000, desc: '自然口语男声，适合忠厚角色' },
  { id: 'sambert-zhijing-v1', name: '严厉女声', gender: 'female', lang: 'zh', sampleRate: 16000, desc: '严厉、干练女声' },
  { id: 'sambert-zhiting-v1', name: '电台女声', gender: 'female', lang: 'zh', sampleRate: 16000, desc: '电台主持质感女声' },
  // 英语（美式）
  { id: 'sambert-brian-v1', name: 'Brian', gender: 'male', lang: 'en', sampleRate: 16000, desc: '沉稳美式男声，商务/管家人设' },
  { id: 'sambert-cally-v1', name: 'Cally', gender: 'male', lang: 'en', sampleRate: 16000, desc: '年轻美式男声，戏剧化角色' },
  { id: 'sambert-cindy-v1', name: 'Cindy', gender: 'female', lang: 'en', sampleRate: 16000, desc: '优雅美式女声' },
  { id: 'sambert-donna-v1', name: 'Donna', gender: 'female', lang: 'en', sampleRate: 16000, desc: '知性美式女声' },
  { id: 'sambert-eva-v1', name: 'Eva', gender: 'female', lang: 'en', sampleRate: 16000, desc: '年轻美式女声' },
  { id: 'sambert-betty-v1', name: 'Betty', gender: 'female', lang: 'en', sampleRate: 16000, desc: '爽利美式女声' },
  { id: 'sambert-beth-v1', name: 'Beth', gender: 'female', lang: 'en', sampleRate: 16000, desc: '柔和美式女声' },
  // 多语种特色
  { id: 'sambert-clara-v1', name: 'Clara', gender: 'female', lang: 'multi', sampleRate: 16000, desc: '法语女声，舞台质感' },
];
const TTS_VOICE_MAP = new Map(TTS_VOICES.map((v) => [v.id, v]));
const DEFAULT_TTS_VOICE = TTS_VOICE_MAP.get('sambert-zhichu-v1');

/* ---- Edge TTS (Microsoft free neural voices, no API key) ----
   Talks to Edge's read-aloud WebSocket: wss://speech.platform.bing.com/...
   Requires a Sec-MS-GEC token (sha256 of rounded Windows ticks + trusted client
   token). Live endpoint currently exposes ~322 voices / 142 locales; we curate
   the ones relevant to the game (zh-CN + en-US + flavor languages). */
const EDGE_TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_CHROMIUM_VERSION = '143.0.3650.75';
const EDGE_SEC_MS_GEC_VERSION = `1-${EDGE_CHROMIUM_VERSION}`;
const EDGE_BASE_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const EDGE_WIN_EPOCH = 11644473600;

const EDGE_VOICES = [
  // 中文（普通话）
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: 'female', lang: 'zh', desc: '温暖女声，中文最常用的声音' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: 'female', lang: 'zh', desc: '活泼年轻女声，适合少女角色' },
  { id: 'zh-CN-YunjianNeural', name: '云健', gender: 'male', lang: 'zh', desc: '沉稳浑厚男声，成熟角色' },
  { id: 'zh-CN-YunxiNeural', name: '云希', gender: 'male', lang: 'zh', desc: '少年感男声，适合讲故事/江湖角色' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏', gender: 'male', lang: 'zh', desc: '标准清晰男声，通用' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', gender: 'male', lang: 'zh', desc: '新闻播报男声，沉稳权威' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '晓北', gender: 'female', lang: 'zh', desc: '东北方言女声，泼辣角色' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: '晓妮', gender: 'female', lang: 'zh', desc: '陕西方言女声' },
  // 英语（美式）
  { id: 'en-US-AriaNeural', name: 'Aria', gender: 'female', lang: 'en', desc: '温暖成熟女声' },
  { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'female', lang: 'en', desc: '专业新闻女声' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', gender: 'female', lang: 'en', desc: '年轻友善女声' },
  { id: 'en-US-AnaNeural', name: 'Ana', gender: 'female', lang: 'en', desc: '活泼女声' },
  { id: 'en-US-AvaNeural', name: 'Ava', gender: 'female', lang: 'en', desc: '成熟柔和女声' },
  { id: 'en-US-EmmaNeural', name: 'Emma', gender: 'female', lang: 'en', desc: '自信女声' },
  { id: 'en-US-GuyNeural', name: 'Guy', gender: 'male', lang: 'en', desc: '低沉权威男声' },
  { id: 'en-US-BrianNeural', name: 'Brian', gender: 'male', lang: 'en', desc: '专业沉稳男声' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', gender: 'male', lang: 'en', desc: '温暖青年男声，适合叙事' },
  { id: 'en-US-EricNeural', name: 'Eric', gender: 'male', lang: 'en', desc: '自信男声' },
  { id: 'en-US-RogerNeural', name: 'Roger', gender: 'male', lang: 'en', desc: '成熟男声' },
  { id: 'en-US-AndrewNeural', name: 'Andrew', gender: 'male', lang: 'en', desc: '温和男声' },
  { id: 'en-US-SteffanNeural', name: 'Steffan', gender: 'male', lang: 'en', desc: '年轻男声' },
  { id: 'en-US-EmmaMultilingualNeural', name: 'Emma (多语)', gender: 'female', lang: 'multi', desc: '多语种女声' },
  { id: 'en-US-BrianMultilingualNeural', name: 'Brian (多语)', gender: 'male', lang: 'multi', desc: '多语种男声' },
  { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew (多语)', gender: 'male', lang: 'multi', desc: '多语种旁白男声' },
  // 风味语言（点缀用）
  { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: 'female', lang: 'en', desc: '英式女声' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', gender: 'male', lang: 'en', desc: '英式男声' },
  { id: 'fr-FR-DeniseNeural', name: 'Denise', gender: 'female', lang: 'multi', desc: '法语女声，舞台质感' },
  { id: 'fr-FR-HenriNeural', name: 'Henri', gender: 'male', lang: 'multi', desc: '法语男声' },
  { id: 'ja-JP-NanamiNeural', name: 'Nanami', gender: 'female', lang: 'multi', desc: '日语女声' },
  { id: 'ja-JP-KeitaNeural', name: 'Keita', gender: 'male', lang: 'multi', desc: '日语男声' },
  { id: 'ko-KR-SunHiNeural', name: 'SunHi', gender: 'female', lang: 'multi', desc: '韩语女声' },
  { id: 'ko-KR-InJoonNeural', name: 'InJoon', gender: 'male', lang: 'multi', desc: '韩语男声' },
  { id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'female', lang: 'multi', desc: '德语女声' },
  { id: 'de-DE-ConradNeural', name: 'Conrad', gender: 'male', lang: 'multi', desc: '德语男声' },
  { id: 'es-ES-ElviraNeural', name: 'Elvira', gender: 'female', lang: 'multi', desc: '西班牙语女声' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro', gender: 'male', lang: 'multi', desc: '西班牙语男声' },
  { id: 'it-IT-ElsaNeural', name: 'Elsa', gender: 'female', lang: 'multi', desc: '意大利语女声' },
  { id: 'it-IT-DiegoNeural', name: 'Diego', gender: 'male', lang: 'multi', desc: '意大利语男声' },
  { id: 'ru-RU-SvetlanaNeural', name: 'Svetlana', gender: 'female', lang: 'multi', desc: '俄语女声' },
  { id: 'ru-RU-DmitryNeural', name: 'Dmitry', gender: 'male', lang: 'multi', desc: '俄语男声' },
];
const EDGE_VOICE_MAP = new Map(EDGE_VOICES.map((v) => [v.id, v]));
const DEFAULT_EDGE_VOICE = EDGE_VOICE_MAP.get('zh-CN-XiaoxiaoNeural');

/* Sambert voice id -> closest Edge voice id. Used when Edge TTS is the active
   provider so per-suspect voices keep their gender/age flavor for free. */
const SAMBERT_TO_EDGE = {
  'sambert-zhixiang-v1': 'zh-CN-YunjianNeural',
  'sambert-zhinan-v1': 'zh-CN-YunxiNeural',
  'sambert-zhichu-v1': 'zh-CN-YunxiaNeural',
  'sambert-zhide-v1': 'zh-CN-YunyangNeural',
  'sambert-zhiqi-v1': 'zh-CN-XiaoxiaoNeural',
  'sambert-zhijia-v1': 'zh-CN-XiaoxiaoNeural',
  'sambert-zhiru-v1': 'zh-CN-XiaoxiaoNeural',
  'sambert-zhiqian-v1': 'zh-CN-XiaoxiaoNeural',
  'sambert-zhiwei-v1': 'zh-CN-XiaoyiNeural',
  'sambert-zhilun-v1': 'zh-CN-YunxiNeural',
  'sambert-zhishuo-v1': 'zh-CN-YunxiaNeural',
  'sambert-zhijing-v1': 'zh-CN-liaoning-XiaobeiNeural',
  'sambert-zhiting-v1': 'zh-CN-XiaoxiaoNeural',
  'sambert-brian-v1': 'en-US-BrianNeural',
  'sambert-cally-v1': 'en-US-ChristopherNeural',
  'sambert-cindy-v1': 'en-US-AriaNeural',
  'sambert-donna-v1': 'en-US-JennyNeural',
  'sambert-eva-v1': 'en-US-MichelleNeural',
  'sambert-betty-v1': 'en-US-EmmaNeural',
  'sambert-beth-v1': 'en-US-AvaNeural',
  'sambert-clara-v1': 'fr-FR-DeniseNeural',
};

const TTS_CACHE_MAX = 64;
const ttsCache = new Map();

function clampNum(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function ensureWav(buf, sampleRate) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') return buf;
  // DashScope returned raw PCM; wrap it in a standard 16-bit mono WAV header.
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + buf.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);       // PCM
  header.writeUInt16LE(1, 22);       // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(buf.length, 40);
  return Buffer.concat([header, buf]);
}

/* Synthesize speech via DashScope Sambert WebSocket (zero npm deps, Node 22+ native WebSocket).
   Returns a complete WAV buffer. Falls back to raw-PCM wrapping if needed. */
function synthesizeSpeech(text, voiceId = '', opts = {}) {
  return new Promise((resolve, reject) => {
    if (!DASHSCOPE_API_KEY) {
      reject(new Error('DASHSCOPE_API_KEY is not set. Add it to .env to enable multi-voice TTS.'));
      return;
    }
    if (!HAS_NATIVE_WS) {
      reject(new Error('Server TTS requires Node >= 22 (native WebSocket). Upgrade Node or let the browser fall back to speechSynthesis.'));
      return;
    }
    const voice = TTS_VOICE_MAP.get(voiceId) || DEFAULT_TTS_VOICE;
    const sampleRate = clampNum(Number(opts.sampleRate) || voice.sampleRate, 8000, 48000);
    const rate = clampNum(Number(opts.rate) || 1, 0.5, 2);
    const pitch = clampNum(Number(opts.pitch) || 1, 0.5, 2);
    const volume = clampNum(Number(opts.volume) || 50, 0, 100);
    const cleanText = String(text).replace(/\s+/g, ' ').trim().slice(0, 1000);
    if (!cleanText) {
      reject(new Error('Empty TTS text'));
      return;
    }
    const cacheKey = `${voice.id}|${sampleRate}|${rate}|${pitch}|${cleanText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      resolve(cached);
      return;
    }

    let ws;
    try {
      ws = new WebSocket(TTS_WS_URL, {
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
          'user-agent': 'whodunit-voice/0.5',
        },
      });
      ws.binaryType = 'arraybuffer';
    } catch (err) {
      reject(err);
      return;
    }

    const chunks = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* noop */ }
      reject(new Error('TTS request timed out after 45s'));
    }, 45000);

    const finish = (err, buf) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      if (err) {
        reject(err);
        return;
      }
      if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
      ttsCache.set(cacheKey, buf);
      resolve(buf);
    };

    ws.onopen = () => {
      const msg = {
        header: { action: 'run-task', task_id: randomUUID(), streaming: 'out' },
        payload: {
          model: voice.id,
          task_group: 'audio',
          task: 'tts',
          function: 'SpeechSynthesizer',
          input: { text: cleanText },
          parameters: {
            text_type: 'PlainText',
            format: 'wav',
            sample_rate: sampleRate,
            volume,
            rate,
            pitch,
            word_timestamp_enabled: false,
            phoneme_timestamp_enabled: false,
          },
        },
      };
      try { ws.send(JSON.stringify(msg)); } catch (err) { finish(err); }
    };
    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        let msg = null;
        try { msg = JSON.parse(event.data); } catch { return; }
        const ev = msg.header && msg.header.event;
        if (ev === 'task-finished') {
          finish(null, ensureWav(Buffer.concat(chunks), sampleRate));
        } else if (ev === 'task-failed') {
          finish(new Error(`DashScope TTS failed: ${msg.header.error_code || 'UNKNOWN'} ${msg.header.error_message || ''}`.trim()));
        }
        return;
      }
      const data = event.data;
      if (data instanceof ArrayBuffer) chunks.push(Buffer.from(data));
      else if (Buffer.isBuffer(data)) chunks.push(data);
      else if (data && typeof data.arrayBuffer === 'function') {
        data.arrayBuffer().then((ab) => { if (!settled) chunks.push(Buffer.from(ab)); }).catch(() => {});
      }
    };
    ws.onerror = (event) => {
      const detail = (event && event.message) ? `: ${event.message}` : '';
      finish(new Error(`DashScope TTS connection error${detail}`));
    };
    ws.onclose = () => {
      if (!settled) finish(new Error('DashScope TTS connection closed before task finished'));
    };
  });
}

/* ---- Edge TTS (free) ---- */
function edgeJsDateString(d = new Date()) {
  return d.toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
}

function edgeSecMsGec(nowSeconds) {
  let ticks = (nowSeconds || Date.now() / 1000) + EDGE_WIN_EPOCH;
  ticks -= ticks % 300;          // round down to nearest 5 minutes
  ticks *= 1e7;                  // Windows file time (100ns intervals)
  const hash = createHash('sha256').update(`${Math.round(ticks)}${EDGE_TRUSTED_CLIENT_TOKEN}`);
  return hash.digest('hex').toUpperCase();
}

function edgeEscapeXml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[ch]));
}

function edgeConnectId() {
  return randomUUID().replace(/-/g, '');
}

function edgeConnectUrl(connectId, skewSeconds = 0) {
  return `${EDGE_BASE_URL}?TrustedClientToken=${EDGE_TRUSTED_CLIENT_TOKEN}`
    + `&Sec-MS-GEC=${edgeSecMsGec(Date.now() / 1000 + skewSeconds)}`
    + `&Sec-MS-GEC-Version=${EDGE_SEC_MS_GEC_VERSION}`
    + `&ConnectionId=${connectId}`;
}

/* One synthesis attempt over a single WebSocket connection. Returns MP3 bytes. */
function edgeSynthesizeOnce(text, voiceId, { rate = 1, pitch = 1, skewSeconds = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const connectId = edgeConnectId();
    let ws;
    try {
      ws = new WebSocket(edgeConnectUrl(connectId, skewSeconds), {
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
          'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${EDGE_CHROMIUM_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${EDGE_CHROMIUM_VERSION.split('.')[0]}.0.0.0`,
          'Cookie': `muid=${edgeConnectId().toUpperCase()};`,
        },
      });
      ws.binaryType = 'arraybuffer';
    } catch (err) {
      reject(err);
      return;
    }

    const chunks = [];
    let audioReceived = false;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* noop */ }
      reject(new Error('Edge TTS request timed out after 30s'));
    }, 30000);

    const finish = (err, buf) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      if (err) reject(err);
      else resolve(buf);
    };

    ws.onopen = () => {
      const timestamp = edgeJsDateString();
      const config = '{"context":{"synthesis":{"audio":{"metadataoptions":{'
        + '"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},'
        + '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}';
      ws.send(`X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${config}\r\n`);
      const ratePct = Math.round((rate - 1) * 100);
      const pitchHz = Math.round((pitch - 1) * 100);
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>`
        + `<voice name='${voiceId}'><prosody pitch='${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz' rate='${ratePct >= 0 ? '+' : ''}${ratePct}%' volume='+0%'>`
        + `${edgeEscapeXml(text)}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${edgeConnectId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const path = (String(event.data).match(/Path:(\S+)/) || [])[1];
        if (path === 'turn.end') {
          if (!audioReceived) {
            finish(new Error('Edge TTS returned no audio (voice or text rejected)'));
          } else {
            finish(null, Buffer.concat(chunks));
          }
        }
        return;
      }
      const raw = Buffer.from(event.data);
      if (raw.length < 2) return;
      const headerLength = raw.readUInt16BE(0);
      const head = raw.subarray(2, 2 + headerLength).toString('latin1');
      const body = raw.subarray(2 + headerLength);
      if (head.includes('Path:audio') && body.length) {
        audioReceived = true;
        chunks.push(body);
      }
    };

    ws.onerror = (event) => {
      const detail = (event && event.message) ? `: ${event.message}` : '';
      finish(new Error(`Edge TTS connection error${detail}`));
    };
    ws.onclose = () => {
      if (!settled) finish(new Error('Edge TTS connection closed before turn finished'));
    };
  });
}

async function synthesizeEdgeSpeech(text, voiceId, opts = {}) {
  if (!HAS_NATIVE_WS) throw new Error('Edge TTS requires Node >= 22 (native WebSocket).');
  const voice = EDGE_VOICE_MAP.get(voiceId) || DEFAULT_EDGE_VOICE;
  try {
    return await edgeSynthesizeOnce(text, voice.id, opts);
  } catch (err) {
    // Microsoft rejects tokens when the system clock is skewed: fetch the server
    // Date header once and retry with corrected clock.
    try {
      const probe = await fetch(`https://${EDGE_BASE_URL.replace('wss://', '')}?TrustedClientToken=${EDGE_TRUSTED_CLIENT_TOKEN}`, { method: 'GET' });
      const serverDate = probe.headers.get('date');
      const skew = serverDate ? (Date.parse(serverDate) / 1000) - (Date.now() / 1000) : 0;
      if (Math.abs(skew) > 60) {
        return await edgeSynthesizeOnce(text, voice.id, { ...opts, skewSeconds: skew });
      }
    } catch { /* keep original error */ }
    throw err;
  }
}

function ttsActiveProvider() {
  if (DASHSCOPE_API_KEY && HAS_NATIVE_WS) return 'sambert';
  if (EDGE_TTS_ENABLED && HAS_NATIVE_WS) return 'edge';
  return null;
}

function resolveTtsVoice(voiceId, provider) {
  const sambertOk = Boolean(DASHSCOPE_API_KEY && HAS_NATIVE_WS);
  const edgeOk = Boolean(EDGE_TTS_ENABLED && HAS_NATIVE_WS);
  const wantEdge = provider === 'edge' || (provider === 'auto' && EDGE_VOICE_MAP.has(voiceId));

  if (wantEdge && edgeOk) {
    return {
      provider: 'edge',
      voice: EDGE_VOICE_MAP.get(voiceId)
        || EDGE_VOICE_MAP.get(SAMBERT_TO_EDGE[voiceId])
        || DEFAULT_EDGE_VOICE,
    };
  }
  if (!wantEdge && sambertOk) {
    return {
      provider: 'sambert',
      voice: TTS_VOICE_MAP.get(voiceId) || DEFAULT_TTS_VOICE,
    };
  }
  // Requested provider unavailable -> degrade to the other one.
  if (sambertOk) {
    return {
      provider: 'sambert',
      voice: TTS_VOICE_MAP.get(voiceId) || DEFAULT_TTS_VOICE,
    };
  }
  if (edgeOk) {
    return {
      provider: 'edge',
      voice: EDGE_VOICE_MAP.get(voiceId)
        || EDGE_VOICE_MAP.get(SAMBERT_TO_EDGE[voiceId])
        || DEFAULT_EDGE_VOICE,
    };
  }
  return null;
}

async function synthesizeTts(text, voiceId, opts = {}) {
  const provider = String(opts.provider || 'auto');
  const resolved = resolveTtsVoice(voiceId, provider);
  if (!resolved) throw new Error('No TTS provider available. Set DASHSCOPE_API_KEY or enable Edge TTS.');
  const rate = clampNum(Number(opts.rate) || 1, 0.5, 2);
  const pitch = clampNum(Number(opts.pitch) || 1, 0.5, 2);
  const cacheKey = `${resolved.provider}|${resolved.voice.id}|${rate}|${pitch}|${text}`;
  let buf = ttsCache.get(cacheKey);
  let contentType;
  if (resolved.provider === 'sambert') {
    contentType = 'audio/wav';
    if (!buf) buf = await synthesizeSpeech(text, resolved.voice.id, { rate, pitch, sampleRate: opts.sampleRate });
  } else {
    contentType = 'audio/mpeg';
    if (!buf) buf = await synthesizeEdgeSpeech(text, resolved.voice.id, { rate, pitch });
  }
  if (!ttsCache.has(cacheKey)) {
    if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
    ttsCache.set(cacheKey, buf);
  }
  return { buffer: buf, contentType, provider: resolved.provider };
}

function loadCases() {
  const packs = {};
  if (!fs.existsSync(CASES_DIR)) return packs;
  for (const entry of fs.readdirSync(CASES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(CASES_DIR, entry.name);
    const casePath = path.join(dir, 'case.json');
    const suspectsPath = path.join(dir, 'suspects.json');
    const cluesPath = path.join(dir, 'clues.json');
    if (!fs.existsSync(casePath) || !fs.existsSync(suspectsPath) || !fs.existsSync(cluesPath)) continue;
    try {
      packs[entry.name] = {
        id: entry.name,
        meta: JSON.parse(fs.readFileSync(casePath, 'utf8')),
        suspects: JSON.parse(fs.readFileSync(suspectsPath, 'utf8')),
        clues: JSON.parse(fs.readFileSync(cluesPath, 'utf8')),
      };
    } catch (err) {
      console.warn(`Skipping case pack ${entry.name}: ${err.message}`);
    }
  }
  return packs;
}

const cases = loadCases();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function callDeepSeek(messages, { temperature = 0.85, maxTokens = 320 } = {}) {
  if (!API_KEY) throw new Error('DEEPSEEK_API_KEY is not set. Copy .env.example to .env and add your key.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`DeepSeek API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('DeepSeek returned an empty response.');
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

function buildSuspectSystemPrompt(pack, suspect) {
  const lang = pack.meta.lang === 'zh';
  const rules = lang
    ? [
        `你是${suspect.name}，${suspect.role}，在命案《${pack.meta.title}》中接受审问。`,
        `性格：${suspect.personality}`,
        `你的不在场证词：${suspect.alibi}`,
        `你的秘密：${suspect.secret}`,
        `揭示规则：${suspect.revealRules}`,
        `习惯性小动作：${suspect.tells}`,
        '',
        '扮演规则：',
        '- 始终入戏，第一人称，绝口不提自己是 AI 或游戏。',
        '- 每次回答 2 到 4 句，口语化，像在说话而不是念稿。',
        '- 被问痛处就回避，绝不主动交代。',
        '- 被问到与案件无关的事，用角色身份挡回去。',
        '',
        '回答结束后，在最后单独一行以 [STATE] 标记开头，跟一个紧凑 JSON（舞台提示，不要说出来）：',
        '{"mood":"calm|uneasy|agitated|cornered","tell":"..."}',
        '- mood：calm 镇定自若 / uneasy 神色不安 / agitated 急躁防御 / cornered 破绽毕露',
        '- tell：一句简短的神态小动作描写（最多 12 字），mood 为 calm 时写 ""',
        '- 示例：忍无可忍时回答："我没拿过你的钱！[STATE]{"mood":"agitated","tell":"他拍桌而起，声音发抖"}"',
        '- 绝不要在对话正文里提及 [STATE] 或"舞台提示"，那是给侦探界面看的。',
      ].join('\n')
    : [
        `You are ${suspect.name}, ${suspect.role} in a murder mystery called "${pack.meta.title}".`,
        `Personality: ${suspect.personality}`,
        `Your alibi: ${suspect.alibi}`,
        `Your secret: ${suspect.secret}`,
        `Reveal rules: ${suspect.revealRules}`,
        `A physical tell: ${suspect.tells}`,
        '',
        'Roleplay rules:',
        '- Stay fully in character. First person. Never mention you are an AI or a game.',
        '- Answer in 2 to 4 short sentences, written for spoken delivery. Use contractions.',
        '- Be evasive when uncomfortable; volunteer nothing that is not asked.',
        '- If asked about something outside the case, deflect in character.',
        '',
        'When your reply is done, add one final line starting with the marker [STATE] followed by a compact JSON object (stage direction, never spoken):',
        '{"mood":"calm|uneasy|agitated|cornered","tell":"..."}',
        '- mood: calm / uneasy / agitated / cornered',
        '- tell: a short phrase describing one visible nervous tell (max 8 words), or "" when calm',
        '- Example: "I did not touch the money! [STATE]{"mood":"agitated","tell":"he slams the table"}"',
        '- Never mention [STATE] or "stage direction" in your spoken words; it is HUD info for the investigator.',
      ].join('\n');
  return rules;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 256 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function buildJudgeSystemPrompt(pack) {
  const meta = pack.meta;
  const solution = meta.solution;
  const clueTitles = pack.clues.map((c) => c.title);
  const lang = meta.lang === 'zh';
  if (lang) {
    return [
      `你是《${meta.title}》一案的主审官。你负责评估捕头（玩家）的指控。`,
      '案件的真相：',
      `- 真凶：${solution.killerName}`,
      `- 凶器/手法：${solution.weapon}`,
      `- 动机：${solution.motive}`,
      `- 案情总结：${solution.summary}`,
      '',
      '本案全部可发现证据：',
      clueTitles.map((t) => `- ${t}`).join('\n'),
      '',
      '评估捕头提交的指控，只输出一个 JSON 对象：',
      '- "correct": true/false，是否指认正确',
      '- "rating": 0-100 的整数，指认正确且证据具体充分 80-100；正确但证据模糊 60-79；指错 20-45',
      '- "verdict": "有罪" 或 "无罪"',
      '- "message": 2-3 句面向捕头的判决陈词，语气威严但不失公允',
      '- "strong": 数组，列出最支持本次结论的证据标题（最多 3 条；若证据不足可为空数组）',
      '- "missed": 数组，列出捕头没有引用但本案关键的证据标题（最多 3 条；若没有可为空数组）',
      '',
      '只输出 JSON，不要 markdown，不要任何 JSON 以外的文字。',
    ].join('\n');
  }
  return [
    'You are the presiding judge of the inquest. You evaluate the investigator\'s accusation.',
    'The true solution of the case:',
    `- Killer: ${solution.killerName}`,
    `- Weapon: ${solution.weapon}`,
    `- Motive: ${solution.motive}`,
    `- Summary: ${solution.summary}`,
    '',
    'All discoverable evidence in the case:',
    clueTitles.map((t) => `- ${t}`).join('\n'),
    '',
    'Evaluate the accusation the investigator submits and respond with ONLY a JSON object:',
    '- "correct": true if the accused killer matches the true solution, else false',
    '- "rating": an integer 0-100. Correct suspect plus strong specific evidence: 80-100. Correct suspect but weak or vague evidence: 60-79. Wrong suspect: 20-45.',
    '- "verdict": "guilty" if correct, else "innocent"',
    '- "message": a 2-3 sentence dramatic verdict addressed to the investigator',
    '- "strong": array of up to 3 evidence titles that most supported this outcome (empty if none)',
    '- "missed": array of up to 3 crucial evidence titles the investigator did not cite (empty if none)',
    '',
    'Return valid JSON only. No markdown, no commentary outside the JSON.',
  ].join('\n');
}

function buildJudgeUserPrompt(pack, body) {
  const suspect = pack.suspects.find((s) => s.id === body.suspectId);
  const evidence = Array.isArray(body.evidence) ? body.evidence : [];
  const clueTitles = pack.clues.filter((c) => evidence.includes(c.id)).map((c) => c.title);
  const motive = typeof body.motive === 'string' && body.motive.trim() ? body.motive.trim().slice(0, 300) : 'no motive stated';
  const lang = pack.meta.lang === 'zh';
  if (lang) {
    return [
      `捕头指认：${suspect ? `${suspect.name}（${suspect.role}）` : '未知之人'}`,
      `陈述的动机或推理：${motive}`,
      `捕头收集并引用的证据：${clueTitles.length ? clueTitles.join('、') : '未引用任何证据'}`,
      '',
      '现在给出判决。',
    ].join('\n');
  }
  return [
    `The investigator accuses: ${suspect ? `${suspect.name} (${suspect.role})` : 'an unknown person'}`,
    `Stated motive or reasoning: ${motive}`,
    `Evidence the investigator collected and cited: ${clueTitles.length ? clueTitles.join(', ') : 'none cited'}`,
    '',
    'Evaluate the accusation now.',
  ].join('\n');
}

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function extractState(text) {
  const match = String(text).match(/\[STATE\]\s*(\{[\s\S]*\})/i);
  if (!match) return { text: String(text).trim(), state: null };
  const reply = String(text).slice(0, match.index).trim();
  try {
    const parsed = JSON.parse(match[1]);
    const mood = ['calm', 'uneasy', 'agitated', 'cornered'].includes(parsed.mood) ? parsed.mood : 'calm';
    const tell = typeof parsed.tell === 'string' ? parsed.tell.slice(0, 80) : '';
    return { text: reply || String(text).trim(), state: { mood, tell } };
  } catch {
    return { text: String(text).trim(), state: null };
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  const safePath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function caseSummaries() {
  return Object.values(cases).map((pack) => {
    const m = pack.meta;
    return {
      id: pack.id,
      title: m.title,
      titleEn: m.titleEn || m.title,
      lang: m.lang || 'en',
      tagline: m.tagline,
      victimName: m.victim && m.victim.name,
      victimEmoji: m.victim && m.victim.emoji,
      location: m.location,
      time: m.time,
      difficulty: m.difficulty,
      estimatedMinutes: m.estimatedMinutes,
      suspects: pack.suspects.length,
      clues: pack.clues.length,
    };
  });
}

const handler = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        model: MODEL,
        cases: caseSummaries().length,
        caseTitle: Object.values(cases)[0]?.meta.title || '',
        tts: {
          enabled: Boolean(ttsActiveProvider()),
          activeProvider: ttsActiveProvider(),
          providers: {
            sambert: Boolean(DASHSCOPE_API_KEY && HAS_NATIVE_WS),
            edge: Boolean(EDGE_TTS_ENABLED && HAS_NATIVE_WS),
          },
          voices: {
            sambert: TTS_VOICES.length,
            edge: EDGE_VOICES.length,
          },
        },
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/tts/voices') {
      const active = ttsActiveProvider();
      const sambertEnabled = Boolean(DASHSCOPE_API_KEY && HAS_NATIVE_WS);
      const edgeEnabled = Boolean(EDGE_TTS_ENABLED && HAS_NATIVE_WS);
      sendJson(res, 200, {
        enabled: Boolean(active),
        activeProvider: active,
        defaultVoice: active === 'sambert' ? DEFAULT_TTS_VOICE.id : DEFAULT_EDGE_VOICE.id,
        voices: active === 'sambert' ? TTS_VOICES : EDGE_VOICES,
        sambertToEdge: SAMBERT_TO_EDGE,
        providers: [
          { id: 'sambert', enabled: sambertEnabled, free: false, name: 'DashScope Sambert', voices: TTS_VOICES },
          { id: 'edge', enabled: edgeEnabled, free: true, name: 'Edge TTS（免费）', voices: EDGE_VOICES },
        ],
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/tts') {
      const body = await readJsonBody(req);
      const text = typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : '';
      if (!text) {
        sendJson(res, 400, { error: 'Empty text' });
        return;
      }
      const { buffer: audio, contentType, provider } = await synthesizeTts(text, String(body.voice || ''), {
        provider: body.provider,
        rate: body.rate,
        pitch: body.pitch,
        sampleRate: body.sampleRate,
      });
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': audio.length,
        'Cache-Control': 'no-store',
        'X-TTS-Provider': provider,
      });
      res.end(audio);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/cases') {
      sendJson(res, 200, { cases: caseSummaries() });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/case') {
      const caseId = url.searchParams.get('caseId') || Object.keys(cases)[0];
      const pack = cases[caseId];
      if (!pack) {
        sendJson(res, 404, { error: `Unknown caseId: ${caseId}` });
        return;
      }
      const safeSuspects = pack.suspects.map(({ id, name, role, emoji, age, shortBio, voice, voiceRate, voicePitch }) => ({
        id, name, role, emoji, age, shortBio,
        voice: voice || '',
        voiceRate: Number.isFinite(Number(voiceRate)) ? Number(voiceRate) : 1,
        voicePitch: Number.isFinite(Number(voicePitch)) ? Number(voicePitch) : 1,
      }));
      sendJson(res, 200, {
        case: {
          id: pack.meta.id,
          title: pack.meta.title,
          titleEn: pack.meta.titleEn,
          lang: pack.meta.lang || 'en',
          tagline: pack.meta.tagline,
          victim: pack.meta.victim,
          location: pack.meta.location,
          time: pack.meta.time,
          briefing: pack.meta.briefing,
          scene: pack.meta.scene || '',
          timeline: pack.meta.timeline,
          relations: Array.isArray(pack.meta.relations) ? pack.meta.relations : [],
          questions: Array.isArray(pack.meta.questions) ? pack.meta.questions.slice(0, 6) : [],
          difficulty: pack.meta.difficulty,
          estimatedMinutes: pack.meta.estimatedMinutes,
          epilogues: pack.meta.epilogues,
          ranks: pack.meta.ranks,
        },
        suspects: safeSuspects,
        clues: pack.clues,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await readJsonBody(req);
      const pack = cases[String(body.caseId || '')];
      if (!pack) {
        sendJson(res, 400, { error: 'Unknown caseId' });
        return;
      }
      const suspect = pack.suspects.find((s) => s.id === String(body.suspectId || ''));
      if (!suspect) {
        sendJson(res, 400, { error: 'Unknown suspectId' });
        return;
      }
      const history = sanitizeMessages(body.messages);
      const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
      if (!question) {
        sendJson(res, 400, { error: 'Empty question' });
        return;
      }
      const messages = [
        { role: 'system', content: buildSuspectSystemPrompt(pack, suspect) },
        ...history,
        { role: 'user', content: question },
      ];
      const raw = await callDeepSeek(messages, { temperature: 0.9, maxTokens: 360 });
      const { text, state } = extractState(raw);
      sendJson(res, 200, {
        reply: text,
        mood: (state && state.mood) || 'calm',
        tell: (state && state.tell) || '',
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/accuse') {
      const body = await readJsonBody(req);
      const pack = cases[String(body.caseId || '')];
      if (!pack) {
        sendJson(res, 400, { error: 'Unknown caseId' });
        return;
      }
      const suspect = pack.suspects.find((s) => s.id === String(body.suspectId || ''));
      if (!suspect) {
        sendJson(res, 400, { error: 'Unknown suspectId' });
        return;
      }
      const judgeMessages = [
        { role: 'system', content: buildJudgeSystemPrompt(pack) },
        { role: 'user', content: buildJudgeUserPrompt(pack, body) },
      ];
      const raw = await callDeepSeek(judgeMessages, { temperature: 0.2, maxTokens: 600 });
      const parsed = extractJson(raw);
      const solution = pack.meta.solution;
      const epilogue = parsed.correct
        ? (Number(parsed.rating) >= 80 ? pack.meta.epilogues.solved_brilliant : pack.meta.epilogues.solved_thin)
        : pack.meta.epilogues.wrong;
      const cleanArray = (v) => Array.isArray(v) ? v.map((x) => String(x).slice(0, 80)).slice(0, 3) : [];
      sendJson(res, 200, {
        verdict: {
          correct: Boolean(parsed.correct),
          rating: Math.max(0, Math.min(100, Number(parsed.rating) || 0)),
          verdictText: String(parsed.verdict || 'mistrial'),
          message: String(parsed.message || 'The court has reached its decision.'),
          strong: cleanArray(parsed.strong),
          missed: cleanArray(parsed.missed),
        },
        truth: {
          killer: solution.killerName,
          weapon: solution.weapon,
          motive: solution.motive,
          summary: solution.summary,
        },
        epilogue,
      });
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'Unknown API endpoint' });
      return;
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    const status = /DeepSeek|DashScope|TTS/.test(err.message) ? 502 : 400;
    sendJson(res, status, { error: err.message });
  }}

const server = http.createServer(handler);
server.listen(PORT, HOST, () => {
  console.log(`Whodunit Voice running at http://${HOST}:${PORT}`);
  console.log(`Model: ${MODEL} | Case packs: ${Object.keys(cases).length}`);
  if (!API_KEY) console.warn('WARNING: DEEPSEEK_API_KEY missing - set it in .env');
  if (DASHSCOPE_API_KEY && HAS_NATIVE_WS) console.log(`TTS: DashScope Sambert enabled (${TTS_VOICES.length} voices)`);
  else if (DASHSCOPE_API_KEY && !HAS_NATIVE_WS) console.warn('WARNING: DASHSCOPE_API_KEY set but Node < 22 has no native WebSocket - server TTS disabled');
  if (EDGE_TTS_ENABLED && HAS_NATIVE_WS) console.log(`TTS: Edge TTS enabled (free, ${EDGE_VOICES.length} curated voices)`);
  if (!DASHSCOPE_API_KEY && !(EDGE_TTS_ENABLED && HAS_NATIVE_WS)) console.warn('WARNING: no TTS provider active - browser speechSynthesis fallback only. Add DASHSCOPE_API_KEY or enable Edge TTS.');
});

if (HOST === '127.0.0.1') {
  http.createServer(handler).listen(PORT, '::1', () => {
    console.log('Also listening on http://[::1]:' + PORT + ' (IPv6)');
  });
}
