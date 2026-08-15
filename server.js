import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const CASES_DIR = path.join(__dirname, 'data', 'cases');
const PUBLIC_DIR = path.join(__dirname, 'public');

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
      sendJson(res, 200, { ok: true, model: MODEL, cases: caseSummaries().length, caseTitle: Object.values(cases)[0]?.meta.title || '' });
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
      const safeSuspects = pack.suspects.map(({ id, name, role, emoji, age, shortBio }) => ({ id, name, role, emoji, age, shortBio }));
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
    const status = /DeepSeek/.test(err.message) ? 502 : 400;
    sendJson(res, status, { error: err.message });
  }}

const server = http.createServer(handler);
server.listen(PORT, HOST, () => {
  console.log(`Whodunit Voice running at http://${HOST}:${PORT}`);
  console.log(`Model: ${MODEL} | Case packs: ${Object.keys(cases).length}`);
  if (!API_KEY) console.warn('WARNING: DEEPSEEK_API_KEY missing - set it in .env');
});

if (HOST === '127.0.0.1') {
  http.createServer(handler).listen(PORT, '::1', () => {
    console.log('Also listening on http://[::1]:' + PORT + ' (IPv6)');
  });
}
