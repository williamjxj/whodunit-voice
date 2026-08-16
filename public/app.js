/* Whodunit Voice - client logic (multi-case, i18n, v1.0 enhanced) */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const I18N = {
    en: {
      app_sub: 'A voice-driven murder mystery',
      pts: ' pts',
      choose_case: 'Choose a case',
      case_select_hint: 'Three cases. Different languages, same rule: find the killer.',
      briefing_title: 'Case Briefing',
      scene_title: '🔍 Crime Scene',
      relations_title: '🕸️ Relationships',
      timeline_title: 'Timeline of the night',
      hint_note: '🎙️ Ask suspects questions out loud, or type. Collect clues, then accuse.',
      accept_case: 'Accept the case',
      back_cases: '← Choose another case',
      lobby_title: 'Interview the suspects',
      evidence_btn: '📁 Evidence',
      accuse_btn: '⚖️ Accuse',
      back_lobby: '← Back to lobby',
      input_ph: 'Ask a question, or press the mic and speak...',
      send_btn: 'Send',
      evidence_board: 'Evidence Board',
      no_evidence: 'No evidence yet. Ask sharp questions.',
      source_scene: 'crime scene',
      suspects_group: 'from the suspects',
      accuse_title: 'Make your accusation',
      accuse_sub: 'Who killed the victim?',
      motive_label: 'Motive / reasoning (optional)',
      cite_label: 'Cite evidence (check the ones you use)',
      cancel: 'Cancel',
      submit_accuse: '🔨 Submit accusation',
      pick_suspect: 'Pick a suspect first.',
      judging: '⏳ The judge is deliberating...',
      court_unavailable: 'The court is unavailable (DeepSeek error). Try again.',
      case_closed: 'Case Closed',
      injustice: 'Miscarriage of Justice',
      the_truth: 'The Truth',
      killer: 'Killer',
      weapon: 'Weapon',
      motive: 'Motive',
      summary: 'Summary',
      strong_evidence: 'What convinced the court',
      missed_evidence: 'Crucial evidence you missed',
      none: 'None',
      final_rank: 'Final rank',
      total_score: 'Total score',
      play_again: 'Play again',
      mic_status_default: 'Ask a question - out loud or in writing.',
      mic_listening: 'Listening... ask your question.',
      mic_blocked: 'Microphone blocked. Type your questions instead.',
      mic_unsupported: 'Voice input not supported in this browser - type your questions.',
      heard: 'Heard:',
      freeze: '⚠️ The witness froze (DeepSeek unavailable). Try again.',
      intro: 'The suspect is seated across you. Begin the interview.',
      new_evidence: '📁 New evidence:',
      postmortem: 'Postmortem',
      clues_found: 'Clues found',
      missed_clue_hint: 'Missed clues (with hints)',
      load_fail: 'Failed to load the case. Is the server running?',
      retry: 'Retry',
      tts_label: 'Voice replies',
      tts_preparing: 'Preparing voice…',
      tts_speaking: 'Speaking…',
      tts_fallback: 'Server voice unavailable – using browser voice.',
      listen_briefing: '🔊 Listen to the briefing',
      stop_reading: '⏹ Stop reading',
      continue_investigation: 'Continue investigation',
      continue_label_short: 'Continue',
      discard_save: 'Discard save',
      save_found: 'Saved progress found',
      resumed: 'Investigation resumed',
      save_cleared: 'Save cleared',
      saved_note: 'Progress autosaves',
      hint_btn: 'Need a hint',
      hint_cost: '–5 pts',
      no_more_hints: 'No hints left',
      all_clues_found: 'All clues already found',
      hint_got: '💡 Hint',
      mood_calm: 'Calm',
      mood_uneasy: 'Uneasy',
      mood_agitated: 'Agitated',
      mood_cornered: 'Cornered',
      tell_label: 'Tell',
      quick_ask: 'Suggested questions',
      questioned: 'Questioned',
      difficulty: 'Difficulty',
      est_time: 'Est. time',
      min_short: 'min',
      best_score: 'Best',
      achievements_title: 'Achievements',
      ach_clue_hunter: 'Clue Hunter',
      ach_clue_hunter_desc: 'Found every clue in the case',
      ach_all_interviewed: 'People Person',
      ach_all_interviewed_desc: 'Interviewed every suspect',
      ach_quick_solver: 'Rapid Fire',
      ach_quick_solver_desc: 'Solved the case in 10 questions or fewer',
      ach_perfect_case: 'Airtight',
      ach_perfect_case_desc: 'Correct accusation with no missed key evidence',
      copy_result: 'Copy result',
      copied: 'Copied to clipboard',
      back_lobby_v: 'Back to lobby',
      new_best: 'New best score!',
      sfx_on: 'Sound effects on',
      sfx_off: 'Sound effects off',
    },
    zh: {
      app_sub: '语音驱动的互动探案',
      pts: ' 分',
      choose_case: '选择案件',
      case_select_hint: '三个案件，中英双语，规则相同：找出真凶。',
      briefing_title: '案件简报',
      scene_title: '🔍 案发现场',
      relations_title: '🕸️ 人物关系',
      timeline_title: '当晚时间线',
      hint_note: '🎙️ 用语音或文字审问嫌疑人，收集证据后指认真凶。',
      accept_case: '接案',
      back_cases: '← 换个案件',
      lobby_title: '审问嫌疑人',
      evidence_btn: '📁 证据',
      accuse_btn: '⚖️ 指控',
      back_lobby: '← 返回大厅',
      input_ph: '提问，或按下麦克风说话……',
      send_btn: '发送',
      evidence_board: '证据板',
      no_evidence: '还没有证据。问点尖锐的问题。',
      source_scene: '案发现场',
      suspects_group: '来自嫌疑人',
      accuse_title: '作出指控',
      accuse_sub: '谁是真凶？',
      motive_label: '动机 / 推理（可选）',
      cite_label: '引用证据（勾选你依据的线索）',
      cancel: '取消',
      submit_accuse: '🔨 提交指控',
      pick_suspect: '先选择嫌疑人。',
      judging: '⏳ 法官正在合议……',
      court_unavailable: '法庭暂时无法开庭（DeepSeek 出错），请重试。',
      case_closed: '案件告破',
      injustice: '冤案',
      the_truth: '真相',
      killer: '真凶',
      weapon: '凶器 / 手法',
      motive: '动机',
      summary: '案情总结',
      strong_evidence: '说服法庭的关键证据',
      missed_evidence: '你漏掉的关键证据',
      none: '无',
      final_rank: '最终称号',
      total_score: '总分',
      play_again: '再玩一次',
      mic_status_default: '提问——说出来，或打出来。',
      mic_listening: '正在聆听……请提问。',
      mic_blocked: '麦克风被拒绝，请改用文字提问。',
      mic_unsupported: '当前浏览器不支持语音输入，请用文字提问。',
      heard: '听到：',
      freeze: '⚠️ 证人突然沉默（DeepSeek 不可用），请重试。',
      intro: '嫌疑人就坐在你对面。开始审问吧。',
      new_evidence: '📁 新证据：',
      postmortem: '结案复盘',
      clues_found: '已发现线索',
      missed_clue_hint: '漏掉的线索（附提示）',
      load_fail: '案件加载失败。服务器在运行吗？',
      retry: '重试',
      tts_label: '语音播报',
      tts_preparing: '正在合成语音……',
      tts_speaking: '正在播放……',
      tts_fallback: '服务器语音不可用，改用浏览器语音。',
      listen_briefing: '🔊 听案件简报',
      stop_reading: '⏹ 停止朗读',
      continue_investigation: '继续调查',
      continue_label_short: '继续',
      discard_save: '放弃存档',
      save_found: '检测到上次调查进度',
      resumed: '已恢复调查进度',
      save_cleared: '存档已清除',
      saved_note: '进度自动保存中',
      hint_btn: '要一条提示',
      hint_cost: '−5 分',
      no_more_hints: '提示已用完',
      all_clues_found: '线索已全部找到',
      hint_got: '💡 提示',
      mood_calm: '镇定',
      mood_uneasy: '不安',
      mood_agitated: '急躁',
      mood_cornered: '破绽毕露',
      tell_label: '小动作',
      quick_ask: '推荐提问',
      questioned: '已审问',
      difficulty: '难度',
      est_time: '预计时长',
      min_short: '分钟',
      best_score: '最佳',
      achievements_title: '成就',
      ach_clue_hunter: '线索猎手',
      ach_clue_hunter_desc: '找到本案全部线索',
      ach_all_interviewed: '八面玲珑',
      ach_all_interviewed_desc: '审问过全部嫌疑人',
      ach_quick_solver: '快刀斩乱麻',
      ach_quick_solver_desc: '10 次提问以内破案',
      ach_perfect_case: '铁证如山',
      ach_perfect_case_desc: '指认正确且无关键证据遗漏',
      copy_result: '复制结果',
      copied: '已复制到剪贴板',
      back_lobby_v: '返回大厅',
      new_best: '新纪录！',
      sfx_on: '音效已开启',
      sfx_off: '音效已关闭',
    },
  };

  const CLUE_POINTS = 20;
  const CORRECT_POINTS = 40;
  const HINT_COST = 5;
  const MAX_HINTS = 3;
  const SAVE_KEY = 'whodunit_v2_save';
  const BEST_PREFIX = 'whodunit_v2_best_';
  const SFX_KEY = 'whodunit_v2_sfx';
  const TTS_KEY = 'whodunit_v2_tts';
  const MOODS = {
    calm: { emoji: '😌' },
    uneasy: { emoji: '😅' },
    agitated: { emoji: '😠' },
    cornered: { emoji: '😰' },
  };
  const ACHIEVEMENTS = [
    { id: 'clue_hunter', emoji: '🔎', title: 'ach_clue_hunter', desc: 'ach_clue_hunter_desc' },
    { id: 'all_interviewed', emoji: '🗣️', title: 'ach_all_interviewed', desc: 'ach_all_interviewed_desc' },
    { id: 'quick_solver', emoji: '⚡', title: 'ach_quick_solver', desc: 'ach_quick_solver_desc' },
    { id: 'perfect_case', emoji: '🏆', title: 'ach_perfect_case', desc: 'ach_perfect_case_desc' },
  ];

  const state = {
    lang: 'en',
    cases: [],
    caseId: null,
    caseData: null,
    suspects: [],
    clues: [],
    foundClues: new Set(),
    hintedClues: new Set(),
    score: 0,
    hintsUsed: 0,
    questionCount: 0,
    conversations: {},
    questioned: {},
    moods: {},
    activeSuspect: null,
    ttsOn: true,
    sfxOn: true,
    busy: false,
    saved: null,
    lastVerdict: null,
  };

  function t(key) {
    return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key;
  }

  function applyLang() {
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  }

  function showScreen(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  }

  function toast(msg) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  /* ---- character images (generated by comfyui/, gracefully fall back to emoji) ---- */
  function charImg(caseId, id, variant) {
    return `characters/${encodeURIComponent(caseId)}/${encodeURIComponent(id)}_${variant}.png`;
  }
  function setAvatarWithImg(box, caseId, id, name, variant = 'logo', emojiFallback) {
    box.textContent = '';
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.alt = name || '';
    img.loading = 'lazy';
    img.src = charImg(caseId, id, variant);
    img.onerror = () => { box.textContent = emojiFallback || '❓'; };
    box.appendChild(img);
  }

  /* ---- sound effects (WebAudio, zero files) ---- */
  let audioCtx = null;
  function tone(freq, start, dur, type = 'sine', vol = 0.06) {
    if (!state.sfxOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const at = audioCtx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(vol, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    } catch { /* audio unavailable */ }
  }
  function sfx(name) {
    if (!state.sfxOn) return;
    try {
      if (name === 'evidence') { tone(660, 0, 0.12); tone(880, 0.09, 0.16); }
      else if (name === 'send') { tone(300, 0, 0.05, 'triangle', 0.04); }
      else if (name === 'hint') { tone(520, 0, 0.1); tone(390, 0.08, 0.12); }
      else if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, 'triangle', 0.07)); }
      else if (name === 'lose') { tone(220, 0, 0.35, 'sine', 0.06); tone(196, 0.3, 0.5, 'sine', 0.06); }
    } catch { /* noop */ }
  }

  /* ---- persistence ---- */
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
  }
  function saveState() {
    if (!state.caseId) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 2,
        caseId: state.caseId,
        lang: state.lang,
        foundClues: [...state.foundClues],
        hintedClues: [...state.hintedClues],
        score: state.score,
        hintsUsed: state.hintsUsed,
        questionCount: state.questionCount,
        conversations: state.conversations[state.caseId] || {},
        questioned: state.questioned,
        moods: state.moods,
        savedAt: new Date().toISOString(),
      }));
      state.saved = loadSaved();
    } catch { /* storage full/unavailable */ }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
    state.saved = null;
  }
  function updateSaveNote() {
    const el = $('#save-note');
    if (el) el.textContent = state.caseId ? `💾 ${t('saved_note')}` : '';
  }

  function updateScore() {
    $('#score-value').textContent = state.score;
  }

  function updateEvidenceUI() {
    $('#evidence-count').textContent = state.foundClues.size;
    $('#evidence-total').textContent = state.clues.length;
    const list = $('#evidence-list');
    list.innerHTML = '';
    const found = state.clues.filter((c) => state.foundClues.has(c.id));
    if (found.length === 0) {
      const p = document.createElement('p');
      p.style.color = 'var(--muted)';
      p.style.fontSize = '13px';
      p.textContent = t('no_evidence');
      list.appendChild(p);
      updateHintUI();
      return;
    }
    const renderGroup = (title, items) => {
      if (!items.length) return;
      const group = document.createElement('div');
      group.className = 'evidence-group';
      const head = document.createElement('h5');
      head.textContent = `${title} (${items.length})`;
      group.appendChild(head);
      items.forEach((c) => {
        const item = document.createElement('div');
        item.className = 'evidence-item';
        const src = state.suspects.find((s) => s.id === c.source);
        const srcLabel = src ? src.name : t('source_scene');
        item.innerHTML = `<h4>${escapeHtml(c.title)}</h4><p>${escapeHtml(c.description)}</p><span class="tag">${escapeHtml(srcLabel)}</span>`;
        group.appendChild(item);
      });
      list.appendChild(group);
    };
    renderGroup(t('source_scene'), found.filter((c) => c.source === 'scene'));
    renderGroup(t('suspects_group'), found.filter((c) => c.source !== 'scene'));
    updateHintUI();
  }

  /* ---- hint system ---- */
  function updateHintUI() {
    const btn = $('#btn-hint');
    if (!btn) return;
    const left = Math.max(0, MAX_HINTS - state.hintsUsed);
    $('#hints-left').textContent = left;
    const locked = state.clues.filter((c) => !state.foundClues.has(c.id) && !state.hintedClues.has(c.id));
    btn.disabled = left <= 0 || locked.length === 0;
    btn.title = `${t('hint_btn')} (${t('hint_cost')})`;
  }
  function useHint() {
    if (state.hintsUsed >= MAX_HINTS) { toast(t('no_more_hints')); return; }
    const locked = state.clues.filter((c) => !state.foundClues.has(c.id) && !state.hintedClues.has(c.id));
    if (!locked.length) { toast(t('all_clues_found')); return; }
    const pick = locked[Math.floor(Math.random() * locked.length)];
    state.hintedClues.add(pick.id);
    state.hintsUsed += 1;
    state.score = Math.max(0, state.score - HINT_COST);
    updateScore();
    sfx('hint');
    toast(`${t('hint_got')}: ${pick.title} — ${pick.hint}`);
    saveState();
    updateHintUI();
  }

  /* ---- case select ---- */
  async function init() {
    state.saved = loadSaved();
    initTts(); // non-blocking; voice list arrives whenever ready
    try {
      const res = await fetch('/api/cases');
      if (!res.ok) throw new Error('failed to load cases');
      const data = await res.json();
      state.cases = data.cases;
      renderCaseGrid();
    } catch (err) {
      const p = $('#case-grid');
      p.innerHTML = `<p style="color:var(--muted);">${t('load_fail')}</p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="location.reload()">${t('retry')}</button>`;
    }
  }

  function renderCaseGrid() {
    const grid = $('#case-grid');
    grid.innerHTML = '';
    state.cases.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'case-card';
      const langLabel = c.lang === 'zh' ? '中文' : 'EN';
      const diff = Math.max(1, Math.min(3, Number(c.difficulty) || 1));
      const stars = '★'.repeat(diff);
      const est = c.estimatedMinutes ? `⏱ ${c.estimatedMinutes} ${t('min_short')}` : '';
      const best = Number(localStorage.getItem(BEST_PREFIX + c.id) || 0);
      const hasSave = !!(state.saved && state.saved.caseId === c.id);
      const badges =
        `${hasSave ? `<span class="case-badge continue-badge">▶ ${t('continue_label_short')}</span>` : ''}` +
        `${best ? `<span class="case-badge best-badge">🏆 ${t('best_score')} ${best}</span>` : ''}` +
        `<span class="case-badge">⭐ ${t('difficulty')} ${stars}${est ? ' · ' + est : ''}</span>`;
      card.innerHTML = `
        <span class="lang-badge">${langLabel}</span>
        <div class="case-art" aria-hidden="true"></div>
        <h3>${escapeHtml(c.title)}</h3>
        <p class="case-tag">${escapeHtml(c.tagline)}</p>
        <p class="case-meta">🪦 ${c.victimEmoji ? c.victimEmoji + ' ' : ''}${escapeHtml(c.victimName)}<br />📍 ${escapeHtml(c.location)} · ${escapeHtml(c.time)}<br />👥 ${c.suspects} suspects · 🔍 ${c.clues} clues</p>
        <div class="case-badges">${badges}</div>`;
      const artBox = card.querySelector('.case-art');
      if (c.victimId) {
        const img = document.createElement('img');
        img.src = charImg(c.id, c.victimId, 'logo');
        img.alt = c.victimName || '';
        img.loading = 'lazy';
        img.onerror = () => { artBox.textContent = c.victimEmoji || '🪦'; };
        artBox.appendChild(img);
      } else {
        artBox.textContent = c.victimEmoji || '🪦';
      }
      card.addEventListener('click', () => loadCase(c.id));
      grid.appendChild(card);
    });
  }

  async function loadCase(caseId) {
    try {
      const res = await fetch(`/api/case?caseId=${encodeURIComponent(caseId)}`);
      if (!res.ok) throw new Error('failed to load case');
      const data = await res.json();
      state.caseId = caseId;
      state.caseData = data.case;
      state.suspects = data.suspects;
      state.clues = data.clues;
      state.foundClues = new Set();
      state.hintedClues = new Set();
      state.score = 0;
      state.hintsUsed = 0;
      state.questionCount = 0;
      state.activeSuspect = null;
      state.questioned = {};
      state.moods = {};
      state.conversations[caseId] = {};
      state.lang = data.case.lang === 'zh' ? 'zh' : 'en';
      applyLang();
      pickVoice(state.lang);

      $('#case-title').textContent = data.case.title;
      const victimEl = $('#victim-emoji');
      victimEl.textContent = (data.case.victim && data.case.victim.emoji) || '🪦';
      if (data.case.victim && data.case.victim.id) {
        const vimg = document.createElement('img');
        vimg.className = 'victim-img';
        vimg.alt = data.case.victim.name || '';
        vimg.src = charImg(caseId, data.case.victim.id, 'logo');
        vimg.onerror = () => { victimEl.textContent = (data.case.victim && data.case.victim.emoji) || '🪦'; };
        victimEl.textContent = '';
        victimEl.appendChild(vimg);
      }
      $('#victim-name').textContent = data.case.victim.name;
      $('#victim-meta').textContent = `${data.case.victim.age} · ${data.case.location} · ${data.case.time}`;
      $('#victim-bio').textContent = data.case.victim.bio || '';
      const diff = Math.max(1, Math.min(3, Number(data.case.difficulty) || 1));
      const facts = [`⭐ ${t('difficulty')} ${'★'.repeat(diff)}`];
      if (data.case.estimatedMinutes) facts.push(`⏱ ${t('est_time')} ${data.case.estimatedMinutes} ${t('min_short')}`);
      $('#case-facts').innerHTML = facts.map((f) => `<span class="fact-chip">${f}</span>`).join('');
      $('#briefing-text').textContent = data.case.briefing;
      $('#scene-text').textContent = data.case.scene || '';
      renderRelations();
      const tl = $('#timeline-list');
      tl.innerHTML = '';
      data.case.timeline.forEach((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        tl.appendChild(li);
      });
      updateScore();
      updateEvidenceUI();
      renderSuspectGrid();
      renderResumeBanner();
      showScreen('screen-briefing');
    } catch (err) {
      console.error('[loadCase]', err);
      toast(t('load_fail'));
    }
  }

  function renderRelations() {
    const box = $('#relations-box');
    const rels = (state.caseData && state.caseData.relations) || [];
    if (!rels.length) { box.hidden = true; return; }
    box.hidden = false;
    const size = 480;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.36;
    const meta = new Map();
    meta.set('victim', { emoji: (state.caseData.victim && state.caseData.victim.emoji) || '🪦', name: state.caseData.victim.name });
    state.suspects.forEach((s) => meta.set(s.id, { emoji: s.emoji, name: s.name }));
    const ids = ['victim', ...state.suspects.map((s) => s.id)];
    const pos = new Map();
    ids.forEach((id, i) => {
      if (id === 'victim') pos.set(id, { x: cx, y: cy });
      else {
        const angle = (2 * Math.PI * i) / ids.length;
        pos.set(id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      }
    });
    const nodeRadius = (id) => (id === 'victim' ? 34 : 28);
    const truncate = (text, max) => (String(text).length > max ? `${String(text).slice(0, max)}…` : String(text));
    const lines = rels.map((rel) => {
      const a = pos.get(rel.a);
      const b = pos.get(rel.b);
      if (!a || !b) return '';
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Shorten the line so the arrowhead lands just outside the target node.
      const x1 = a.x + ux * nodeRadius(rel.a);
      const y1 = a.y + uy * nodeRadius(rel.a);
      const x2 = b.x - ux * nodeRadius(rel.b);
      const y2 = b.y - uy * nodeRadius(rel.b);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const label = truncate(rel.label, 24);
      return `<line class="rel-edge" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" marker-end="url(#rel-arrow)"/>
        <g class="rel-edge-label"><title>${escapeHtml(rel.a === 'victim' ? state.caseData.victim.name : (meta.get(rel.a)?.name || rel.a))} → ${escapeHtml(meta.get(rel.b)?.name || rel.b)}：${escapeHtml(rel.label)}</title>
        <text x="${mx.toFixed(1)}" y="${my.toFixed(1)}">${escapeHtml(label)}</text></g>`;
    }).join('');
    const nodes = [...pos].map(([id, p]) => {
      const m = meta.get(id) || { emoji: '❓', name: id };
      const cls = id === 'victim' ? 'rel-node victim' : 'rel-node';
      return `<g class="${cls}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})">
        <title>${escapeHtml(m.name)}</title>
        <circle r="${nodeRadius(id)}"/>
        <text class="rel-emoji" y="0">${m.emoji}</text>
        <text class="rel-name" y="${nodeRadius(id) + 13}">${escapeHtml(m.name)}</text>
      </g>`;
    }).join('');
    $('#relations-map').innerHTML = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(t('relations_title'))}">
      <defs><marker id="rel-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path class="rel-arrow-head" d="M0,0 L10,5 L0,10 z"/>
      </marker></defs>
      ${lines}${nodes}
    </svg>`;
    const list = $('#relations-list');
    list.innerHTML = rels.map((rel) => {
      const a = meta.get(rel.a);
      const b = meta.get(rel.b);
      const an = a ? `${a.emoji} ${a.name}` : escapeHtml(rel.a);
      const bn = b ? `${b.emoji} ${b.name}` : escapeHtml(rel.b);
      return `<li><span class="rel-pair">${an} <span class="rel-arrow">→</span> ${bn}</span><span class="rel-label">：${escapeHtml(rel.label)}</span></li>`;
    }).join('');
  }

  function renderResumeBanner() {
    const banner = $('#resume-banner');
    const saved = (state.saved && state.saved.caseId === state.caseId) ? state.saved : null;
    if (!saved) { banner.hidden = true; return; }
    banner.hidden = false;
    $('#resume-text').textContent =
      `${t('save_found')}: ${t('clues_found')} ${saved.foundClues.length}/${state.clues.length} · ${saved.score} ${t('pts')}`;
  }

  function resumeInvestigation() {
    const s = state.saved;
    if (!s || s.caseId !== state.caseId) return;
    state.foundClues = new Set(s.foundClues || []);
    state.hintedClues = new Set(s.hintedClues || []);
    state.score = Number(s.score) || 0;
    state.hintsUsed = Number(s.hintsUsed) || 0;
    state.questionCount = Number(s.questionCount) || 0;
    state.questioned = s.questioned || {};
    state.moods = s.moods || {};
    state.conversations[state.caseId] = s.conversations || {};
    state.activeSuspect = null;
    updateScore();
    updateEvidenceUI();
    renderSuspectGrid();
    updateSaveNote();
    toast(t('resumed'));
    showScreen('screen-lobby');
  }

  function discardSave() {
    clearSave();
    toast(t('save_cleared'));
    renderResumeBanner();
    renderCaseGrid();
    updateSaveNote();
  }

  function renderSuspectGrid() {
    const grid = $('#suspect-grid');
    grid.innerHTML = '';
    state.suspects.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'suspect-card';
      const questioned = state.questioned[s.id] > 0;
      card.innerHTML = `
        <span class="badge ${questioned ? 'on' : ''}">🗣️ ${t('questioned')}</span>
        <div class="avatar"></div>
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="role">${escapeHtml(s.role)}</div>
        <p class="bio">${escapeHtml(s.shortBio)}</p>`;
      setAvatarWithImg(card.querySelector('.avatar'), state.caseId, s.id, s.name, 'logo', s.emoji);
      card.addEventListener('click', () => openInterview(s.id));
      grid.appendChild(card);
    });
  }

  function openInterview(id) {
    state.activeSuspect = id;
    if (!state.conversations[state.caseId][id]) state.conversations[state.caseId][id] = [];
    const suspect = state.suspects.find((s) => s.id === id);
    const vmeta = voiceById(activeVoiceId(suspect.voice || ''));
    const voiceTag = vmeta
      ? `<div class="voice-tag">🎙 ${escapeHtml(vmeta.name)} <span class="voice-gender">${vmeta.gender === 'female' ? '♀' : '♂'}</span></div>`
      : '';
    $('#suspect-head').innerHTML = `
      <div class="avatar"></div>
      <div>
        <div class="name">${escapeHtml(suspect.name)}</div>
        <div class="role">${escapeHtml(suspect.role)}</div>
        ${voiceTag}
      </div>
      <div class="head-side"><span id="mood-chip" class="mood-chip"></span></div>`;
    setAvatarWithImg($('#suspect-head .avatar'), state.caseId, id, suspect.name, 'logo', suspect.emoji);
    renderChat(id);
    renderMoodChip();
    renderQuickQuestions();
    showScreen('screen-interview');
    $('#input-question').value = '';
    $('#input-question').focus();
    $('#mic-status').textContent = t('mic_status_default');
  }

  function renderMoodChip() {
    const chip = $('#mood-chip');
    if (!chip) return;
    const m = state.moods[state.activeSuspect];
    const mood = (m && MOODS[m.mood]) ? m.mood : 'calm';
    chip.className = `mood-chip mood-${mood}`;
    const parts = [`${MOODS[mood].emoji} ${t('mood_' + mood)}`];
    if (m && m.tell) parts.push(`· ${t('tell_label')}: ${m.tell}`);
    chip.textContent = parts.join(' ');
    updatePortrait();
  }

  function updatePortrait() {
    const box = $('#portrait-box');
    if (!box) return;
    const suspect = state.suspects.find((s) => s.id === state.activeSuspect);
    if (!suspect) { box.hidden = true; return; }
    const m = state.moods[state.activeSuspect];
    let variant = (m && m.mood) ? m.mood : 'calm';
    if (variant === 'agitated') variant = 'cornered';
    const img = $('#suspect-portrait');
    img.onload = () => { box.hidden = false; };
    img.onerror = () => { box.hidden = true; };
    img.src = charImg(state.caseId, suspect.id, variant);
  }

  function renderQuickQuestions() {
    const box = $('#quick-questions');
    const qs = (state.caseData && state.caseData.questions) || [];
    if (!qs.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<span class="q-label">💬 ${t('quick_ask')}</span>`;
    qs.forEach((q) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'q-chip';
      b.textContent = q;
      b.disabled = state.busy;
      b.addEventListener('click', () => {
        $('#input-question').value = q;
        sendQuestion(q);
      });
      box.appendChild(b);
    });
  }

  function renderChat(id) {
    const log = $('#chat-log');
    log.innerHTML = '';
    const msgs = state.conversations[state.caseId][id] || [];
    if (msgs.length === 0) {
      const intro = document.createElement('div');
      intro.className = 'msg sys';
      intro.textContent = t('intro');
      log.appendChild(intro);
      return;
    }
    msgs.forEach((m) => {
      const el = document.createElement('div');
      el.className = `msg ${m.role === 'user' ? 'user' : m.role === 'error' ? 'error' : 'suspect'}`;
      const who = m.role === 'user' ? (state.lang === 'zh' ? '你' : 'You') : state.suspects.find((s) => s.id === id)?.name || '';
      el.innerHTML = m.role === 'user' ? `<span class="who">${escapeHtml(who)}</span>${escapeHtml(m.content)}` : escapeHtml(m.content);
      log.appendChild(el);
    });
    log.scrollTop = log.scrollHeight;
  }

  function showTyping() {
    const log = $('#chat-log');
    const el = document.createElement('div');
    el.className = 'msg sys typing';
    el.innerHTML = '<span>…</span>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function unlockClues(text) {
    const lower = text.toLowerCase();
    let unlocked = false;
    state.clues.forEach((c) => {
      if (state.foundClues.has(c.id)) return;
      if (c.keywords.some((k) => lower.includes(k.toLowerCase()))) {
        state.foundClues.add(c.id);
        state.score += CLUE_POINTS;
        unlocked = true;
        sfx('evidence');
        toast(`${t('new_evidence')} ${c.title}`);
      }
    });
    if (unlocked) {
      updateScore();
      updateEvidenceUI();
    }
  }

  async function sendQuestion(rawText) {
    const text = (rawText || '').trim();
    if (!text || state.busy) return;
    const id = state.activeSuspect;
    const history = state.conversations[state.caseId][id] || [];
    history.push({ role: 'user', content: text });
    state.questionCount += 1;
    state.questioned[id] = (state.questioned[id] || 0) + 1;
    sfx('send');
    renderChat(id);
    renderSuspectGrid();

    state.busy = true;
    setControlsEnabled(false);
    showTyping();
    renderQuickQuestions();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: state.caseId, suspectId: id, messages: history.slice(0, -1), question: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'request failed');
      history.push({ role: 'assistant', content: data.reply });
      if (data.mood) state.moods[id] = { mood: data.mood, tell: data.tell || '' };
      renderChat(id);
      renderMoodChip();
      unlockClues(text);
      const suspect = state.suspects.find((s) => s.id === id);
      speak(data.reply, {
        voice: (suspect && suspect.voice) || '',
        rate: (suspect && suspect.voiceRate) || 1,
        pitch: (suspect && suspect.voicePitch) || 1,
      });
      saveState();
    } catch (err) {
      history.push({ role: 'error', content: t('freeze') });
      renderChat(id);
    } finally {
      state.busy = false;
      setControlsEnabled(true);
      $('#input-question').value = '';
      $('#input-question').focus();
      renderQuickQuestions();
    }
  }

  function setControlsEnabled(enabled) {
    $('#btn-send').disabled = !enabled;
    $('#btn-mic').disabled = !enabled;
    $('#input-question').disabled = !enabled;
  }

  /* ---- Text to speech (multi-voice) ----
     Preferred path: server-side DashScope Sambert voices fetched from /api/tts
     and played through Web Audio. Fallback: browser speechSynthesis (lang-matched).
     Each suspect carries their own voice id + rate/pitch from the case data. */
  let ttsServerOn = false;
  let ttsActiveProvider = null;  // 'sambert' | 'edge' | null
  let ttsVoices = [];
  let ttsVoicesMap = new Map();
  let ttsSambertToEdge = {};     // sambert voice id -> edge voice id
  let ttsAbort = null;         // AbortController for an in-flight /api/tts fetch
  let ttsPhase = 'idle';       // idle | loading | playing
  let ttsVoiceName = '';
  let ttsOnEnd = null;         // callback fired when playback concludes OR is superseded
  let currentSource = null;    // active AudioBufferSourceNode
  let voice = null;            // browser fallback voice

  async function initTts() {
    try {
      const res = await fetch('/api/tts/voices');
      if (!res.ok) throw new Error('voices endpoint unavailable');
      const data = await res.json();
      ttsServerOn = Boolean(data.enabled);
      ttsActiveProvider = data.activeProvider || null;
      ttsVoices = Array.isArray(data.voices) ? data.voices : [];
      ttsVoicesMap = new Map(ttsVoices.map((v) => [v.id, v]));
      ttsSambertToEdge = data.sambertToEdge || {};
    } catch {
      ttsServerOn = false;
      ttsActiveProvider = null;
      ttsVoices = [];
      ttsVoicesMap = new Map();
      ttsSambertToEdge = {};
    }
  }

  function voiceById(id) {
    return (id && ttsVoicesMap.get(id)) || null;
  }

  // Map a case's Sambert voice id onto the currently active provider's registry,
  // so suspects keep their gender/age flavor on Edge TTS (free) as well.
  function activeVoiceId(id) {
    if (!id) return '';
    if (ttsActiveProvider === 'edge') {
      return ttsSambertToEdge[id] || (ttsVoicesMap.has(id) ? id : '');
    }
    return ttsVoicesMap.has(id) ? id : '';
  }

  // utterance.voice overrides utterance.lang; a mismatched voice (en-US voice reading Chinese) is silent on macOS
  function pickVoice(lang) {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const wantZh = lang === 'zh';
    const exact = wantZh ? 'zh-cn' : 'en-us';
    const prefix = wantZh ? 'zh' : 'en';
    const nameHint = wantZh ? /Tingting|Meijia|Xiaoxiao|XiaoYi|Google/i : /Google|Samantha|Daniel|Karen|Alex|Eddy/i;
    const pool = voices.filter((v) => v.lang);
    voice = pool.find((v) => v.lang.toLowerCase() === exact)
      || pool.find((v) => v.lang.toLowerCase().startsWith(prefix) && nameHint.test(v.name))
      || pool.find((v) => v.lang.toLowerCase().startsWith(prefix))
      || null;
  }
  if (window.speechSynthesis) {
    pickVoice(state.lang);
    speechSynthesis.onvoiceschanged = () => pickVoice(state.lang);
  }

  function setTtsPhase(phase, voiceName = '') {
    ttsPhase = phase;
    if (voiceName) ttsVoiceName = voiceName;
    const el = $('#tts-status');
    if (!el) return;
    if (phase === 'idle') {
      el.hidden = true;
      el.classList.remove('on');
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.classList.add('on');
    const label = phase === 'loading' ? t('tts_preparing') : t('tts_speaking');
    el.textContent = ttsVoiceName ? `${label} · ${ttsVoiceName}` : label;
  }

  function finishTtsPlayback() {
    currentSource = null;
    ttsAbort = null;
    setTtsPhase('idle');
    if (ttsOnEnd) {
      const cb = ttsOnEnd;
      ttsOnEnd = null;
      cb();
    }
  }

  function stopSpeaking() {
    if (ttsAbort) {
      try { ttsAbort.abort(); } catch { /* noop */ }
      ttsAbort = null;
    }
    if (currentSource) {
      try { currentSource.onended = null; currentSource.stop(); } catch { /* noop */ }
      currentSource = null;
    }
    if (window.speechSynthesis) {
      try { speechSynthesis.cancel(); } catch { /* noop */ }
    }
    if (ttsPhase !== 'idle') finishTtsPlayback();
    else if (ttsOnEnd) {
      const cb = ttsOnEnd;
      ttsOnEnd = null;
      cb();
    }
  }

  async function speakWithServer(text, voiceId, rate, pitch, onEnd) {
    const controller = new AbortController();
    ttsAbort = controller;
    const meta = voiceById(voiceId);
    setTtsPhase('loading', meta ? meta.name : '');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1000), voice: voiceId, rate, pitch, provider: 'auto' }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      if (ttsAbort !== controller) return;
      let audio = null;
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        audio = await audioCtx.decodeAudioData(buf);
      } catch {
        audio = null; // undecodable audio -> browser fallback below
      }
      if (ttsAbort !== controller) return;
      if (!audio) {
        ttsAbort = null;
        speakWithBrowser(text, onEnd);
        return;
      }
      ttsOnEnd = onEnd || null;
      const src = audioCtx.createBufferSource();
      src.buffer = audio;
      src.connect(audioCtx.destination);
      src.onended = () => {
        if (currentSource === src) finishTtsPlayback();
      };
      currentSource = src;
      src.start();
      setTtsPhase('playing', meta ? meta.name : '');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.warn('[tts] server synthesis failed, browser fallback:', err);
      ttsAbort = null;
      if (state.ttsOn) {
        toast(t('tts_fallback'));
        speakWithBrowser(text, onEnd);
      } else {
        finishTtsPlayback();
      }
    }
  }

  function speakWithBrowser(text, onEnd) {
    if (!window.speechSynthesis) {
      setTtsPhase('idle');
      if (onEnd) onEnd();
      return;
    }
    ttsOnEnd = onEnd || null;
    setTtsPhase('loading');
    pickVoice(state.lang);
    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    else utter.lang = state.lang === 'zh' ? 'zh-CN' : 'en-US';
    utter.rate = 1.02;
    utter.onstart = () => setTtsPhase('playing', voice ? voice.name : '');
    utter.onend = () => finishTtsPlayback();
    utter.onerror = () => finishTtsPlayback();
    // Chrome/macOS drops an utterance queued synchronously right after cancel(); defer briefly
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      setTimeout(() => speechSynthesis.speak(utter), 60);
    } else {
      speechSynthesis.speak(utter);
    }
  }

  function speak(text, opts = {}) {
    if (!state.ttsOn) return;
    const clean = String(text || '').trim();
    if (!clean) return;
    stopSpeaking();
    const voiceId = activeVoiceId(String(opts.voice || ''));
    const useServer = ttsServerOn && voiceId;
    if (useServer) {
      speakWithServer(clean, voiceId, Number(opts.rate) || 1, Number(opts.pitch) || 1, opts.onEnd || null);
    } else {
      speakWithBrowser(clean, opts.onEnd || null);
    }
  }

  function judgeVoice() {
    return state.lang === 'zh' ? 'sambert-zhide-v1' : 'sambert-cally-v1';
  }
  function narratorVoice() {
    return state.lang === 'zh' ? 'sambert-zhichu-v1' : 'sambert-cally-v1';
  }

  let briefingReading = false;
  function toggleReadBriefing() {
    const btn = $('#btn-read-briefing');
    if (briefingReading) {
      stopSpeaking();
      briefingReading = false;
      if (btn) btn.classList.remove('playing');
      return;
    }
    const parts = [state.caseData.briefing, state.caseData.scene || ''];
    const text = parts.filter(Boolean).join(' ');
    if (!text) return;
    briefingReading = true;
    if (btn) btn.classList.add('playing');
    speak(text, {
      voice: narratorVoice(),
      rate: 1,
      pitch: 1,
      onEnd: () => {
        briefingReading = false;
        if (btn) btn.classList.remove('playing');
      },
    });
  }

  /* ---- Speech recognition ---- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let listening = false;
  if (SR) {
    recognizer = new SR();
    recognizer.interimResults = true;
    recognizer.continuous = false;
    recognizer.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      if (event.results[0].isFinal && transcript.trim()) {
        $('#mic-status').textContent = `${t('heard')} "${transcript.trim().slice(0, 120)}"`;
        sendQuestion(transcript.trim());
      }
    };
    recognizer.onend = () => stopListeningUI();
    recognizer.onerror = (e) => {
      $('#mic-status').textContent = e.error === 'not-allowed' ? t('mic_blocked') : `${t('mic_blocked')}`;
      stopListeningUI();
    };
  } else {
    $('#btn-mic').style.display = 'none';
    $('#mic-status').textContent = t('mic_unsupported');
  }

  function stopListeningUI() {
    listening = false;
    $('#btn-mic').classList.remove('listening');
    $('#btn-mic').textContent = '🎤';
  }

  $('#btn-mic').addEventListener('click', () => {
    if (!recognizer) return;
    if (listening) {
      recognizer.stop();
      stopListeningUI();
      return;
    }
    recognizer.lang = state.lang === 'zh' ? 'zh-CN' : 'en-US';
    listening = true;
    $('#btn-mic').classList.add('listening');
    $('#btn-mic').textContent = '🔴';
    $('#mic-status').textContent = t('mic_listening');
    try {
      recognizer.start();
    } catch {
      stopListeningUI();
    }
  });

  /* ---- Accuse ---- */
  function openAccuse() {
    const list = $('#accuse-suspects');
    list.innerHTML = '';
    state.suspects.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'accuse-option';
      btn.dataset.id = s.id;
      btn.innerHTML = `<span>${s.emoji}</span> ${escapeHtml(s.name)}`;
      btn.addEventListener('click', () => {
        $$('.accuse-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      list.appendChild(btn);
    });

    const ev = $('#accuse-evidence');
    ev.innerHTML = '';
    const found = state.clues.filter((c) => state.foundClues.has(c.id));
    if (found.length === 0) {
      const p = document.createElement('p');
      p.style.color = 'var(--muted)';
      p.style.fontSize = '13px';
      p.textContent = t('no_evidence');
      ev.appendChild(p);
    } else {
      found.forEach((c) => {
        const label = document.createElement('label');
        label.className = 'evidence-check';
        label.innerHTML = `<input type="checkbox" value="${c.id}" checked /> <span>${escapeHtml(c.title)}</span>`;
        ev.appendChild(label);
      });
    }
    $('#motive').value = '';
    $('#accuse-modal').classList.add('open');
  }

  async function submitAccuse() {
    const selected = $('.accuse-option.selected');
    if (!selected) {
      toast(t('pick_suspect'));
      return;
    }
    const suspectId = selected.dataset.id;
    const motive = $('#motive').value.trim();
    const evidence = $$('#accuse-evidence input:checked').map((i) => i.value);
    const btn = $('#btn-submit-accuse');
    btn.disabled = true;
    btn.textContent = t('judging');
    try {
      const res = await fetch('/api/accuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: state.caseId, suspectId, motive, evidence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'accusation failed');
      $('#accuse-modal').classList.remove('open');
      renderVerdict(data);
    } catch (err) {
      toast(t('court_unavailable'));
    } finally {
      btn.disabled = false;
      btn.textContent = t('submit_accuse');
    }
  }

  function computeAchievements(v) {
    const got = new Set();
    if (state.foundClues.size >= state.clues.length) got.add('clue_hunter');
    if (state.suspects.every((s) => state.questioned[s.id] > 0)) got.add('all_interviewed');
    if (state.questionCount > 0 && state.questionCount <= 10) got.add('quick_solver');
    if (v && v.correct && (!v.missed || !v.missed.length)) got.add('perfect_case');
    return got;
  }

  function renderVerdict(data) {
    const v = data.verdict;
    const correct = v.correct;
    state.lastVerdict = v;
    if (correct) state.score += CORRECT_POINTS;
    state.score += v.rating;
    updateScore();

    const rank = (state.caseData.ranks || []).find((r) => state.score >= r.min) || { title: t('final_rank'), emoji: '👶' };
    const banner = correct ? '⚖️' : '🕯️';
    const title = correct ? t('case_closed') : t('injustice');
    sfx(correct ? 'win' : 'lose');

    const strongHtml = v.strong && v.strong.length
      ? `<div class="verdict-evidence"><h5>${t('strong_evidence')}</h5><ul>${v.strong.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>`
      : '';
    const missedHtml = v.missed && v.missed.length
      ? `<div class="verdict-evidence"><h5>${t('missed_evidence')}</h5><ul>${v.missed.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>`
      : '';

    const missedClues = state.clues.filter((c) => !state.foundClues.has(c.id));
    const postmortemHtml = `
      <div class="postmortem">
        <h4>${t('postmortem')}</h4>
        <p>${t('clues_found')}: ${state.foundClues.size}/${state.clues.length}</p>
        ${missedClues.length ? `<p class="missed">${t('missed_clue_hint')}: ${missedClues.map((c) => `${escapeHtml(c.title)} (${escapeHtml(c.hint)})`).join(' · ')}</p>` : ''}
      </div>`;

    const achievements = computeAchievements(v);
    const achievementsHtml = `
      <div class="achievements">
        <h4>🏅 ${t('achievements_title')}</h4>
        ${ACHIEVEMENTS.map((a) => {
          const got = achievements.has(a.id);
          return `<div class="achievement ${got ? '' : 'locked'}">
            <span class="a-emoji">${got ? a.emoji : '🔒'}</span>
            <div><div class="a-title">${t(a.title)}</div><div class="a-desc">${t(a.desc)}</div></div>
          </div>`;
        }).join('')}
      </div>`;

    const bestKey = BEST_PREFIX + state.caseId;
    const prevBest = Number(localStorage.getItem(bestKey) || 0);
    const newBest = state.score > prevBest;
    if (newBest) {
      try { localStorage.setItem(bestKey, String(state.score)); } catch { /* noop */ }
    }

    $('#verdict-card').innerHTML = `
      <div class="verdict-banner">${banner}</div>
      <div class="verdict-title">${title}</div>
      <div class="verdict-rating">${v.rating}<span style="font-size:18px;color:var(--muted);">/100</span></div>
      <p class="verdict-msg">${escapeHtml(v.message)}</p>
      ${strongHtml}
      ${missedHtml}
      <div class="truth-box">
        <h4>${t('the_truth')}</h4>
        <p><strong>${t('killer')}:</strong> ${escapeHtml(data.truth.killer)}</p>
        <p><strong>${t('weapon')}:</strong> ${escapeHtml(data.truth.weapon)}</p>
        <p><strong>${t('motive')}:</strong> ${escapeHtml(data.truth.motive)}</p>
        <p><strong>${t('summary')}:</strong> ${escapeHtml(data.truth.summary)}</p>
      </div>
      <p class="epilogue">${escapeHtml(data.epilogue)}</p>
      ${postmortemHtml}
      ${achievementsHtml}
      <div class="rank-line">${rank.emoji} ${t('final_rank')}: ${escapeHtml(rank.title)} · ${t('total_score')}: ${state.score}</div>
      ${newBest ? `<p class="best-line">🎉 ${t('new_best')} ${t('best_score')}: ${state.score}</p>` : `<p class="best-line">${t('best_score')}: ${Math.max(prevBest, state.score)}</p>`}
      <div class="verdict-actions">
        <button id="btn-copy" class="btn btn-ghost">📋 ${t('copy_result')}</button>
        <button id="btn-continue" class="btn btn-primary">🏛️ ${t('back_lobby_v')}</button>
        <button id="btn-replay" class="btn btn-ghost">🔄 ${t('play_again')}</button>
      </div>`;

    showScreen('screen-verdict');
    speak(`${title}. ${v.message}`, { voice: judgeVoice(), rate: 1.02, pitch: 1 });

    $('#btn-copy').addEventListener('click', () => {
      const text = `${title} · ${v.rating}/100 · ${rank.title} · ${state.score}${t('pts')}\n${v.message}\n${t('killer')}: ${data.truth.killer}\n${t('motive')}: ${data.truth.motive}`;
      const done = () => toast(t('copied'));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }
    });
    $('#btn-continue').addEventListener('click', () => {
      saveState();
      showScreen('screen-lobby');
    });
    $('#btn-replay').addEventListener('click', () => {
      state.foundClues = new Set();
      state.hintedClues = new Set();
      state.score = 0;
      state.hintsUsed = 0;
      state.questionCount = 0;
      state.questioned = {};
      state.moods = {};
      state.conversations[state.caseId] = {};
      updateScore();
      updateEvidenceUI();
      renderSuspectGrid();
      saveState();
      showScreen('screen-lobby');
    });
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch { /* noop */ }
    ta.remove();
  }

  /* ---- Wire up ---- */
  $('#btn-accept').addEventListener('click', () => {
    saveState();
    updateSaveNote();
    showScreen('screen-lobby');
  });
  $('#btn-back-cases').addEventListener('click', () => {
    state.caseId = null;
    state.caseData = null;
    state.suspects = [];
    state.clues = [];
    state.foundClues = new Set();
    state.score = 0;
    state.lang = 'en';
    applyLang();
    updateScore();
    renderCaseGrid();
    showScreen('screen-cases');
  });
  $('#btn-back').addEventListener('click', () => showScreen('screen-lobby'));
  $('#btn-read-briefing').addEventListener('click', toggleReadBriefing);
  $('#btn-send').addEventListener('click', () => sendQuestion($('#input-question').value));
  $('#input-question').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendQuestion(e.target.value);
  });
  $('#btn-resume').addEventListener('click', resumeInvestigation);
  $('#btn-discard-save').addEventListener('click', discardSave);
  $('#btn-clear-save').addEventListener('click', discardSave);

  /* ---- TTS toggle (persisted) ---- */
  function updateTtsButton() {
    $('#tts-icon').textContent = state.ttsOn ? '🔊' : '🔇';
  }
  state.ttsOn = localStorage.getItem(TTS_KEY) !== '0';
  updateTtsButton();
  $('#btn-tts').addEventListener('click', () => {
    state.ttsOn = !state.ttsOn;
    localStorage.setItem(TTS_KEY, state.ttsOn ? '1' : '0');
    updateTtsButton();
    if (!state.ttsOn) stopSpeaking();
  });

  /* ---- SFX toggle (persisted) ---- */
  function updateSfxButton() {
    const btn = $('#btn-sfx');
    btn.textContent = state.sfxOn ? '🔊' : '🔇';
    btn.classList.toggle('off', !state.sfxOn);
    btn.title = state.sfxOn ? t('sfx_on') : t('sfx_off');
  }
  state.sfxOn = localStorage.getItem(SFX_KEY) !== '0';
  updateSfxButton();
  $('#btn-sfx').addEventListener('click', () => {
    state.sfxOn = !state.sfxOn;
    localStorage.setItem(SFX_KEY, state.sfxOn ? '1' : '0');
    updateSfxButton();
    sfx('send');
  });

  $('#btn-evidence').addEventListener('click', () => {
    updateEvidenceUI();
    $('#evidence-panel').classList.add('open');
  });
  $('#btn-close-evidence').addEventListener('click', () => $('#evidence-panel').classList.remove('open'));
  $('#btn-hint').addEventListener('click', useHint);
  $('#btn-accuse').addEventListener('click', openAccuse);
  $('#btn-cancel-accuse').addEventListener('click', () => $('#accuse-modal').classList.remove('open'));
  $('#btn-submit-accuse').addEventListener('click', submitAccuse);

  init();
})();
