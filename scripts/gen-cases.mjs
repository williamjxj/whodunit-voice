#!/usr/bin/env node
/* 案件生成器（CASE-PIPELINE-SPEC §4）：用 Kimi K3 三步生成新案件初稿。
   为什么三步：K3 长请求易被网络切断（实测 5-8 分钟断连），拆成
   案件核心 → 嫌疑人 → 线索 三个小请求，每步 ≤ 1-3 分钟，稳定得多。
   用法：
     node scripts/gen-cases.mjs                          # 生成全部
     node scripts/gen-cases.mjs --case lantern-tricks    # 只生成一个
     node scripts/gen-cases.mjs --list                   # 列出案件创意
   输出：data/cases/<caseId>/{case,suspects,clues}.json（校验通过才落盘） */
import fs from 'node:fs';
import path from 'node:path';
import { chatLLM } from './llm.mjs';
import { loadPack, checkPack, ZH_VOICES, EN_VOICES } from './validate-cases.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CASES_DIR = path.join(ROOT, 'data', 'cases');
const PART_RETRY = 3;
const REPAIR_MAX = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VOICE_POOLS = {
  zh: {
    male: ['sambert-zhixiang-v1', 'sambert-zhinan-v1', 'sambert-zhichu-v1', 'sambert-zhide-v1', 'sambert-zhilun-v1', 'sambert-zhishuo-v1'],
    female: ['sambert-zhiqi-v1', 'sambert-zhijia-v1', 'sambert-zhiru-v1', 'sambert-zhiqian-v1', 'sambert-zhiwei-v1', 'sambert-zhijing-v1', 'sambert-zhiting-v1'],
  },
  en: {
    male: ['sambert-brian-v1', 'sambert-cally-v1'],
    female: ['sambert-cindy-v1', 'sambert-donna-v1', 'sambert-eva-v1', 'sambert-betty-v1', 'sambert-beth-v1'],
  },
};

const RULES = `【创作铁律——每条都必须满足】
1. 公平推理：真凶必在嫌疑人中（guilt 恰好 1 人为 true）。所有破案信息必须藏在嫌疑人证词或线索里。禁止超自然、禁止"只有凶手知道"的上帝证据。
2. 嫌疑人天平：每名嫌疑人都有"说得通的动机 + 一个不想让人知道的秘密"。真凶嫌疑度不能明显高于别人：至少 2 名无辜者的动机同样强烈；至少 1 名无辜者有自己的"假破绽"（看似可疑其实无辜）。
3. 线索链完整：8-10 条线索覆盖"谁 / 怎么 / 为什么"；至少 2 条用于排除无辜者；至少 1 条误导线索"表面指向 A 实则指向 B"；每条线索都能被玩家的一句话自然解锁。
4. 关键词纪律：每条线索 4-8 个 keywords，必须是玩家自然会说出口的词语或短句（含口语与同义说法）。禁止：文档原句、生僻专名缩写、需要先知道答案才问得出的词。
5. 人物鲜活：personality 写出说话风格/口头禅/怪癖；tells 是与性格相符的说漏嘴小动作；alibi 有细节、能被线索戳穿；secret 是人物宁死不愿暴露的隐私（不是"我是凶手"）。
6. 叙事精彩：briefing 用"你"第二人称、有画面感、结尾抛钩子；scene 充满可观察细节（气味/声音/物件）；tagline 一句勾人；epilogues 三种结局（漂亮破案/勉强破案/冤枉好人）各写一段有反转感与余韵的文字。
7. 时间线自洽：timeline 5-8 条，把每个人都"钉"在具体时刻，互相咬合、可交叉验证。
8. 语言：全部正文用目标语言（中文案用简体中文；英文案用地道英文）。中文案 titleEn 给英文译名。
9. 只输出合法的 JSON 对象（不要解释、注释或代码块标记），字段按给定结构，不要添加未列出的字段。`;

const SYS_CORE = `${RULES}

【本步任务】只输出"案件核心 + 演员表"：
{"case": {...}, "cast": [...5 人]}

case 字段：
id, title, titleEn, lang("zh"/"en"), tagline,
victim{id, name, age, emoji, bio},
location, time, briefing, scene,
timeline[5-8 条字符串],
relations[{a, b, label}，a/b 用 cast id 或 "victim"，7-10 条，覆盖全员],
questions[5-6 条玩家会问的自然问题],
difficulty(1-3), estimatedMinutes(15-30),
solution{killer(cast 中一人的 id), killerName, weapon, motive, summary},
epilogues{solved_brilliant, solved_thin, wrong},
ranks[至少 4 档递增 {min, title, emoji}，最低档 min=0]

cast 每条字段（只要骨架，详细人设下一步写）：
id, name, role, emoji, age, gender("male"/"female"), oneLine(一句话人设/关系，供后续步引用)`;

const SYS_SUSPECTS = `${RULES}

【本步任务】根据提供的案件核心 + 演员表，只输出：
{"suspects": [...5 人完整字段]}

suspects 每条字段：
id(必须与演员表一致), name(一致), role(一致), emoji(一致), age(一致),
shortBio, personality, alibi, secret, guilt(bool，凶手= solution.killer 的那位必须 true，其余 false),
revealRules, tells, gender(一致), voice, voiceRate(0.85-1.15), voicePitch(0.9-1.15)

音色表（voice 必须从这里选，且与 gender 匹配）：
中文男声：sambert-zhixiang-v1(磁性沉稳) / sambert-zhinan-v1(精明自信) / sambert-zhichu-v1(清晰通用) / sambert-zhide-v1(权威) / sambert-zhilun-v1(悬疑老江湖) / sambert-zhishuo-v1(忠厚自然)
中文女声：sambert-zhiqi-v1(温柔端庄) / sambert-zhijia-v1(标准) / sambert-zhiru-v1(知性) / sambert-zhiqian-v1(干练) / sambert-zhiwei-v1(活泼年轻) / sambert-zhijing-v1(严厉) / sambert-zhiting-v1(电台)
英文男声：sambert-brian-v1(沉稳商务) / sambert-cally-v1(年轻戏剧化)
英文女声：sambert-cindy-v1(优雅) / sambert-donna-v1(知性) / sambert-eva-v1(年轻) / sambert-betty-v1(爽利) / sambert-beth-v1(柔和)`;

const SYS_CLUES = `${RULES}

【本步任务】根据提供的案件核心 + 演员表 + 嫌疑人详情，只输出：
{"clues": [...8-10 条]}

clues 每条字段：
id, title, description, source(嫌疑人 id 或 "scene"), keywords[4-8 个], hint

要求：覆盖"谁/怎么/为什么"三问；至少 2 条用于排除无辜者；至少 1 条误导线索；keywords 全部是玩家自然口语。`;

const BRIEFS = [
  {
    caseId: 'lantern-tricks',
    victimId: 'jin',
    lang: 'zh',
    title: '灯影幻戏',
    titleEn: 'The Lantern Trick',
    difficulty: 2,
    minutes: 20,
    prompt: `创作一个全新中文案件：
- 案件 id: lantern-tricks；标题：《灯影幻戏》；英文名 The Lantern Trick
- 时代背景：唐代长安，上元灯节，西市。受害者是幻戏班班主"金指儿"——以"空手变灯、箱中换人"闻名的戏法大师，45 岁。
- 核心诡计（必须体现且在线索中公平可推）：他死在一个从里面反锁的戏箱里，形成"不可能密室"；真相是戏班"替身换人"的障眼法 + 灯节烟火遮蔽，制造了不存在的死亡时间。
- 5 名嫌疑人角色设定（可自由取名、丰满人设）：班主夫人（前歌姬，知道戏班账目亏空）、傀儡师（技艺之争、曾被当众羞辱）、胡商（债主，握有抵押契书）、乐师（班主义弟，被亏待多年）、走方药师（旧识，卖过迷药，知道金指儿旧事）。
- 氛围：长安灯节的热闹、丝竹、胡姬酒肆、烟火；诡计要有"戏法揭穿"的爽感。
- 难度 2 星，预计 20 分钟。故事要精彩有反转，但公平可推。`,
  },
  {
    caseId: 'grand-theatre',
    victimId: 'baimudan',
    lang: 'zh',
    title: '白牡丹',
    titleEn: 'White Peony',
    difficulty: 3,
    minutes: 25,
    prompt: `创作一个全新中文案件：
- 案件 id: grand-theatre；标题：《白牡丹》；英文名 White Peony
- 背景：1935 年上海"大光明戏院"，头牌名伶白牡丹（29 岁）被发现死在反锁的化妆间里，窗外暴雨。
- 核心诡计（必须体现且在线索中公平可推）：死亡时间被"谢幕"误导——她死在谢幕之后；她本计划用"假死药"金蝉脱壳、逃离青帮控制，真凶却利用同一个计划完成了谋杀；留声机唱片里录下了关键声音证据。
- 5 名嫌疑人：戏院班主（旧情人，被青帮要挟）、武生（痴迷白牡丹）、青衣（同台竞争者）、琴师（知道她身世秘密）、报馆记者（卧底调查戏院黑幕，握有勒索信）。
- 氛围：雨夜、后台、旗袍、留声机、旧上海夜色；情感浓烈，每个人都有不愿说的往事。
- 难度 3 星（最难的一案），预计 25 分钟。诡计要精巧，动机要动人。`,
  },
  {
    caseId: 'halcyon-voyage',
    victimId: 'vane',
    lang: 'en',
    title: 'The Halcyon Voyage',
    titleEn: 'The Halcyon Voyage',
    difficulty: 2,
    minutes: 20,
    prompt: `Create a brand-new English murder-mystery case:
- caseId: halcyon-voyage; Title: "The Halcyon Voyage"
- Setting: the generation ship Halcyon, 60 years into a 200-year voyage to Epsilon Eridani — a luxury liner with a cryo-bay, hydroponic gardens, and an AI steward.
- Victim: Dr. Elias Vane (52), the ship's visionary architect, found dead inside the sealed cryo-bay — a temperature-controlled vault with a tamper-proof log.
- Core trick (must be present and fairly deducible from clues): the murder was timed to mimic a life-support failure; the killer exploited the cryo-bay's quiet-hours window and forged the AI steward's log; the zero-g maintenance corridor gives everyone a weird, hard-to-check alibi.
- 5 suspects: Dr. Naomi Voss (AI ethicist, Elias's former partner), Tariq Osei (terraforming engineer who leaked a whistleblower report), Dr. Marta Lindqvist (chief medical officer, secretly his physician), June Calloway (celebrity journalist digging into the ship's hidden lies), Commander Rook (head of security, loyal but hiding a sabotage record).
- Vibe: cozy-but-creepy space mystery; claustrophobic luxury; a believable sci-fi trick that is fair to deduce.
- Difficulty 2 stars, ~20 minutes. Write all text in natural, vivid English.`,
  },
];

function extractJson(text) {
  let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('输出中没有找到 JSON 对象');
  return JSON.parse(t.slice(start, end + 1));
}

function pickVoice(lang, gender, idx) {
  const g = gender === 'female' ? 'female' : 'male';
  const pool = VOICE_POOLS[lang]?.[g] || (lang === 'zh' ? VOICE_POOLS.zh.male : VOICE_POOLS.en.male);
  return pool[idx % pool.length];
}

function partUserPrompt(brief, part, contextJson, feedback) {
  const partName = part === 'core' ? '案件核心与演员表' : part === 'suspects' ? '嫌疑人数组' : '线索数组';
  let user = brief.prompt;
  if (contextJson) user += `\n\n【已生成的上下文（保持 id/名字一致）】\n${JSON.stringify(contextJson, null, 1)}`;
  user += `\n\n请严格按系统提示词的结构输出【${partName}】的 JSON 对象。只输出该 JSON，不要输出其他内容。`;
  if (feedback) user += `\n\n上次输出有误，请修正后重新输出完整 JSON：\n${feedback}`;
  return user;
}

async function genPart(brief, part, contextJson, feedback) {
  const system = part === 'core' ? SYS_CORE : part === 'suspects' ? SYS_SUSPECTS : SYS_CLUES;
  const user = partUserPrompt(brief, part, contextJson, feedback);
  let lastErr = '';
  for (let attempt = 1; attempt <= PART_RETRY; attempt++) {
    console.log(`    · ${part}（第 ${attempt}/${PART_RETRY} 次）...`);
    try {
      const { content, engine } = await chatLLM({ system, user, maxTokens: 16000, timeoutMs: 8 * 60 * 1000, reasoningEffort: 'low' });
      if (attempt === 1) console.log(`      引擎：${engine}`);
      return extractJson(content);
    } catch (err) {
      lastErr = err.message;
      console.error(`    ✗ ${part} 失败：${lastErr}`);
      if (attempt < PART_RETRY) {
        const wait = 10 * attempt * 1000;
        console.log(`      等待 ${wait / 1000}s 后重试...`);
        await sleep(wait);
      }
    }
  }
  throw new Error(`[${brief.caseId}] ${part} 生成失败：${lastErr}`);
}

function postProcess(brief, obj) {
  if (!obj || typeof obj !== 'object') throw new Error('生成结果不是对象');
  if (!Array.isArray(obj.suspects) || !Array.isArray(obj.clues) || !obj.case) {
    throw new Error('合并结果缺少 case/suspects/clues');
  }
  obj.case.id = brief.caseId;
  obj.case.lang = brief.lang;
  if (!obj.case.title) obj.case.title = brief.title;
  if (brief.titleEn && (!obj.case.titleEn || obj.case.titleEn === obj.case.title)) obj.case.titleEn = brief.titleEn;
  if (!obj.case.titleEn) obj.case.titleEn = obj.case.title;
  obj.case.difficulty = Number(brief.difficulty);
  obj.case.estimatedMinutes = Number(brief.minutes);
  if (obj.case.victim) obj.case.victim.id = brief.victimId; // 受害者 id 必须唯一且与图像命名一致
  const killerId = obj.case.solution?.killer;
  const langOk = brief.lang === 'zh' ? ZH_VOICES : EN_VOICES; // 英文案只用英文音色，中文案只用中文音色
  obj.suspects.forEach((s, i) => {
    s.guilt = s.id === killerId;
    if (!langOk.has(s.voice)) s.voice = pickVoice(brief.lang, s.gender, i);
    if (s.voiceRate !== undefined) s.voiceRate = Math.min(1.15, Math.max(0.85, Number(s.voiceRate) || 1));
    if (s.voicePitch !== undefined) s.voicePitch = Math.min(1.15, Math.max(0.9, Number(s.voicePitch) || 1));
    delete s.gender;
  });
  return obj;
}

function writePack(caseId, obj) {
  const dir = path.join(CASES_DIR, caseId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify(obj.case, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'suspects.json'), JSON.stringify(obj.suspects, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'clues.json'), JSON.stringify(obj.clues, null, 2) + '\n');
}

async function generateCase(brief) {
  /* 第 1 步：案件核心 + 演员表 */
  const core = await genPart(brief, 'core');
  const c = core.case;
  const cast = core.cast;
  if (!Array.isArray(cast) || cast.length < 3) throw new Error(`[${brief.caseId}] cast 不足 3 人`);
  const castIds = new Set(cast.map((m) => m.id));
  if (!castIds.has(c.solution?.killer)) throw new Error(`[${brief.caseId}] solution.killer 不在 cast: ${c.solution?.killer}`);
  c.id = brief.caseId;
  c.lang = brief.lang;
  c.title = c.title || brief.title;
  c.titleEn = c.titleEn || brief.titleEn || c.title;
  c.difficulty = Number(brief.difficulty);
  c.estimatedMinutes = Number(brief.minutes);
  console.log(`  ✓ 核心：${c.title} | 真凶 ${c.solution.killerName}（${c.solution.weapon}）`);

  /* 第 2 步：嫌疑人细节 */
  let suspects = (await genPart(brief, 'suspects', { case: c, cast })).suspects;
  suspects = cast.map((m) => suspects.find((s) => s.id === m.id) || { ...m });

  /* 第 3 步：线索 */
  const clues = (await genPart(brief, 'clues', {
    case: c,
    cast: cast.map((m) => ({ id: m.id, name: m.name, role: m.role, gender: m.gender, oneLine: m.oneLine })),
    suspects: suspects.map((s) => ({ id: s.id, name: s.name, role: s.role, personality: s.personality, secret: s.secret, alibi: s.alibi })),
  })).clues;

  let obj = { case: c, suspects, clues };
  /* 校验与修复（最多 REPAIR_MAX 轮） */
  for (let round = 1; round <= REPAIR_MAX; round++) {
    obj = postProcess(brief, obj);
    writePack(brief.caseId, obj);
    const { ok, errors, warnings } = checkPack(loadPack(brief.caseId).pack);
    if (ok) {
      console.log(`  ✓ 全量校验通过（warnings: ${warnings.length ? warnings.join('; ') : '无'}）`);
      return obj;
    }
    console.error(`  ✗ 校验未通过（第 ${round} 轮）：${errors.join('; ')}`);
    const errText = errors.join('; ');
    const partToFix = /clues|线索|source|keywords|keyword/.test(errText) ? 'clues'
      : /suspect|guilt|嫌疑人|voice|音色/.test(errText) ? 'suspects' : 'core';
    if (round === REPAIR_MAX) break;
    if (partToFix === 'core') {
      throw new Error(`[${brief.caseId}] 核心数据错误需重跑：${errText}`);
    }
    const fixed = await genPart(brief, partToFix,
      partToFix === 'clues'
        ? { case: c, cast, suspects }
        : { case: c, cast },
      errText);
    if (partToFix === 'clues') obj.clues = fixed.clues;
    else obj.suspects = fixed.suspects;
  }
  throw new Error(`[${brief.caseId}] 校验修复失败`);
}

function printSummary(brief, obj) {
  const c = obj.case;
  const killer = obj.suspects.find((s) => s.id === c.solution.killer);
  console.log(`\n========== ${c.title}（${c.titleEn}）==========`);
  console.log(`id: ${brief.caseId} | 难度 ${c.difficulty}★ | ${c.estimatedMinutes} 分钟`);
  console.log(`tagline: ${c.tagline}`);
  console.log(`受害者: ${c.victim.emoji} ${c.victim.name}（${c.victim.age} 岁）`);
  console.log(`真凶: ${killer ? `${killer.emoji} ${killer.name}` : c.solution.killerName} | 凶器: ${c.solution.weapon}`);
  console.log(`动机: ${c.solution.motive}`);
  console.log(`嫌疑人: ${obj.suspects.map((s) => `${s.emoji}${s.name}[${s.role}]`).join('、')}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    for (const b of BRIEFS) console.log(`${b.caseId} | ${b.lang} | ${b.title}（${b.titleEn}）| 难度 ${b.difficulty}★`);
    return;
  }
  const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : null;
  const targets = BRIEFS.filter((b) => !only || b.caseId === only);
  if (!targets.length) {
    console.error(`未找到案件创意：${only}`);
    process.exit(1);
  }
  const results = [];
  for (const brief of targets) {
    try {
      const obj = await generateCase(brief);
      printSummary(brief, obj);
      results.push(brief.caseId);
    } catch (err) {
      console.error(`\n✗ ${brief.caseId} 失败：${err.message}`);
    }
  }
  console.log(`\n完成：${results.length}/${targets.length} 个案件生成成功 -> ${results.join(', ')}`);
  if (results.length) console.log('运行 node scripts/validate-cases.mjs 可复检全部案件。');
}

main().catch((err) => { console.error(err); process.exit(1); });
