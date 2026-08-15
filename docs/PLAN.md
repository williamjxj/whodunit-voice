# 实施计划 (PLAN) - The Sterling Affair

## v0.1（已完成）

| # | 步骤 | 状态 | 说明 |
|---|---|---|---|
| 1 | 环境检查 | ✅ | Node v22.21.1；端口 4310；DeepSeek API 连通，模型 `deepseek-v4-flash` |
| 2 | 项目骨架 | ✅ | package.json / .env / .env.example / .gitignore |
| 3 | 假数据 | ✅ | 英文案件《The Sterling Affair》：5 嫌疑人 + 8 线索 |
| 4 | 后端 server.js | ✅ | 零依赖；/api/case + /api/chat + /api/accuse + /api/health |
| 5 | 前端 | ✅ | 语音问询、证据板、指控、三种结局、评分称号 |
| 6 | 文档 | ✅ | SPEC / PLAN / resources / README |
| 7 | 运行与验证 | ✅ | 见下方 v0.1 验证记录 |

## v0.2（已完成）

| # | 步骤 | 状态 | 说明 |
|---|---|---|---|
| 1 | 多案件包结构 | ✅ | 数据迁移到 data/cases/<id>/；新增 GET /api/cases；接口全部带 caseId |
| 2 | 中文案件《玉簪案》 | ✅ | 5 嫌疑人 + 8 线索，全中文数据与角色扮演规则 |
| 3 | UI 国际化 | ✅ | I18N 字典 en/zh，界面、语音识别、TTS 随案件语言切换 |
| 4 | 法官证据反馈 | ✅ | 判决返回 strong/missed；结局页结案复盘（漏掉线索+提示） |
| 5 | 回归验证 | ✅ | 双案件指控 + 前端案件选择屏渲染 + 中文判决词修正 |

## v0.2 验证记录（2026-08-13 实测）

- [x] GET /api/cases 返回 2 个案件（sterling-affair / jade-pavilion）
- [x] GET /api/case?caseId=jade-pavilion：中文案件数据完整，无 solution/guilt 泄露
- [x] 中文角色扮演：审问钱伯年"账目是否有亏空" => 防御性回复（"正常走动挪转"）
- [x] 指控钱伯年 + 3 证据 => correct:true, rating 85, strong=[安神酒,两本账,花匠证词], missed=[砒霜]
- [x] 错指沈月娥 => correct:false, rating 30, innocent
- [x] 英文案件回归：指控 Marcus => correct:true, rating 92
- [x] 判决词修正：中文判决输出"本官判你有罪"（verdict: 有罪）
- [x] headless DOM：案件选择屏渲染两个案件卡片（英文/中文 + 语言徽章）

## 已知事项

- 后台进程模式会被沙箱回收，当前服务器以常驻会话运行；手动重启：`node server.js`
- 语音识别依赖浏览器 Web Speech API（Chrome/Edge/Safari），Firefox 需打字兜底
- DeepSeek 为唯一外部依赖，网络/额度异常时前端提示重试

## v0.3 修复（2026-08-14，playwright 实测驱动）

用户反馈浏览器出现"案件加载失败。服务器在运行吗？"。

| 问题 | 根因 | 修复 |
|---|---|---|
| 浏览器 localhost 打不开 | 服务器只监听 IPv4 127.0.0.1，macOS 浏览器访问 localhost 可能优先走 IPv6 [::1] | server.js 双栈监听（127.0.0.1 + [::1]），实测三种地址全部 200 |
| 点击案件后语言切换但简报不显示 + 报错 toast | `data-i18n` 的 textContent 覆盖把 `#btn-evidence` 里的 `<span id="evidence-count">` 子节点清空，`updateEvidenceUI` 对 null 赋值抛 TypeError | i18n 标签移到按钮内层 span；loadCase catch 增加 console.error 便于排障 |
| 无重试入口 | 加载失败只有一行文字 | 失败时显示"重试"按钮（刷新重载） |
| console 404 | 缺 favicon | 内联 SVG favicon（🔍） |
| 中文用户气泡显示"听到： You" | 文案硬编码 | 按语言显示"你" / "You" |

### playwright 真实浏览器验证记录

- [x] open http://localhost:4310 => 案件选择屏两个卡片（玉簪案/中文 + The Sterling Affair/EN），console 0 error
- [x] 点击《玉簪案》=> 中文简报屏：受害者、案情、6 条时间线全部渲染，语言自动切中文
- [x] 点击"接案" => 嫌疑人大厅：5 人卡片 + "证据 (0/8)" 计数正常
- [x] 打开钱伯年审问 => 提问"账上是不是有亏空？" => DeepSeek 中文入戏回复（"日清月结，断不会有什么亏空"）
- [x] 打开指控弹窗 => 5 名嫌疑人选项 + 动机输入 + 证据勾选 + 提交按钮齐全
- [x] curl 验证：[::1] / localhost / 127.0.0.1 三种地址 /api/health 全部 200

## v1.0 增强版（2026-08-15）

目标：在不破坏零依赖、反作弊、i18n 三条底线的前提下，丰富内容与玩法。

| # | 内容 | 说明 |
|---|---|---|
| 1 | 第三个案件包《The Midnight Meridian》 | 1927 豪华列车密室杀人：5 嫌疑人 + 10 线索，凶手 Sebastian Croft；案件包含 scene/relations/questions/difficulty 元数据 |
| 2 | 现有两案内容丰富 | 新增案发现场描写、人物关系图数据、推荐提问、难度/时长、受害者 emoji |
| 3 | 审问状态观察（mood/tell） | `/api/chat` 返回嫌疑人情绪（calm/uneasy/agitated/cornered）+ 小动作；界面头顶情绪徽章；`[STATE]{...}` 舞台提示在服务端剥离，容错解析（缺失时默认 calm） |
| 4 | 推荐提问 | 每案 5 个一键提问 chip，降低语音/文字提问门槛 |
| 5 | 提示系统 | 证据板 💡 提示：随机揭示一条未解锁线索的 hint，每条 −5 分，每案 3 次 |
| 6 | 存档续玩 | 线索/分数/审问记录/提示次数/情绪写入 localStorage；案件卡片 ▶ 继续徽章 + 简报页续玩横幅；支持放弃存档 |
| 7 | 成就 + 最佳分 | 线索猎手/八面玲珑/快刀斩乱麻/铁证如山；最佳分按案件记录并展示 |
| 8 | 音效 | WebAudio 合成音效（解锁/发送/提示/判决），无需音频文件，可开关并持久化 |
| 9 | 判决页增强 | 成就墙、复制结果、返回大厅（错判后可继续调查）、再玩一次 |
| 10 | 证据板分组 | 按“案发现场 / 来自嫌疑人”分组，显示各组数量 |
| 11 | 细节打磨 | 嫌疑人卡片显示简介与“已审问”徽章；审问中打字指示；案件卡片显示难度星级/时长/最佳分 |

### v1.0 验证记录（2026-08-15 实测）

- [x] `node --check server.js` / `public/app.js` 通过；9 个案件 JSON 全部可解析
- [x] 启动后 `/api/health` 显示 3 个案件包；双栈监听正常
- [x] `/api/cases` 返回 3 案，含 difficulty/estimatedMinutes/victimEmoji
- [x] 三个 `/api/case` 全量检查：无 solution/secret/guilt 泄露；scene/relations/questions/difficulty 透传正常；嫌疑人仍只下发 id/name/role/emoji/age/shortBio
- [x] `/api/chat`（EN 新案 + ZH 玉簪案）：入戏回复、mood/tell 返回、`[STATE]` 标记已从正文剥离
- [x] `/api/accuse`（新案指认 Sebastian + 4 证据）：correct:true / rating 90 / strong/missed / truth / epilogue 正常
- [x] 浏览器实测（playwright）：案件选择 3 卡片（难度星级、时长、victim emoji、▶ 继续徽章）→ 简报（受害者档案、案发现场、人物关系 SVG+列表、时间线、续玩横幅）→ 大厅（简介+已审问徽章+自动存档提示）→ 审问（情绪徽章、推荐提问、聊天、DeepSeek 回复）→ 证据板（分组 + 提示扣分 40→35 + 次数 3→2）→ 指控弹窗（5 嫌疑人+动机+证据勾选）→ 判决页（评分 65、strong/missed、真相、结案陈词、成就、称号、新纪录、复制/返回/重玩按钮）
- [x] 中文案件 UI：案发现场/人物关系/难度/时长全部中文化
- [x] 修复：新案线索关键词过泛（door 同时命中 Thread 与 Perfume）→ 收敛关键词，避免一题误解锁多条线索

### 已知事项

- localStorage 存档为单槽（一次只存一个案件进度），切换案件不会互相覆盖
- DeepSeek 偶发 502（限流/网络）时前端显示“证人突然沉默”并允许重试，属设计内降级
- 情绪徽章依赖模型按 `[STATE]` 约定输出；解析失败时自动回落为“镇定”，不影响游戏

## v0.4 修复（2026-08-15，playwright 实测驱动）

用户反馈：中文案件回复朗读无声（macOS Safari/Chrome 均复现），且没有朗读开关入口。

| 问题 | 根因 | 修复 |
|---|---|---|
| 中文回复 TTS 静默 | `loadVoices()` 固定选中 Samantha（en-US）；`utter.voice` 会覆盖 `utter.lang`，中文文本被英文嗓音接管 | `pickVoice(lang)` 按案件语言选嗓（中文案 → Eddy 中文/Tingting 等 zh-CN 候选，英文案 → Samantha），兼容跨平台可用嗓音列表 |
| 快速连点/切案时朗读卡死 | `speechSynthesis.cancel()` 在非 speaking 状态调用触发 Chrome/macOS 竞态 | `speak()` 仅在 `speaking \|\| pending` 时 cancel，并延迟 60ms 触发；无匹配嗓音时回退 `utter.lang` 让系统自动选 |
| 无朗读开关 | 静音是"文本模式"副作用，玩家无从恢复 | 工具栏新增 🔊 TTS 开关按钮（图标 + 双语标签 `tts_label`），状态持久化 `localStorage: whodunit_ttsOn`（'0'/'1'），`updateTtsButton()` 同步 UI |

### v0.4 验证记录（2026-08-15 实测）

- [x] `node --check public/app.js` 通过；`pickVoice('zh')` 返回 zh-CN 嗓音（Eddy 中文），`pickVoice('en')` 返回 Samantha
- [x] 真实浏览器审问钱伯年“账上是不是有亏空？”→ 回复文字渲染 + `speak()` 以 Eddy（Chinese (China mainland)）触发朗读
- [x] 英文案件切换后嗓音回退 Samantha（en-US）
- [x] 🔊/🔇 开关切换生效，刷新页面后状态保持（localStorage '0'/'1'），console 零错误
- [x] 宣传海报产出：ComfyUI 本机生成 noir 背景 → HTML/CSS 叠加中文文案 → Playwright 截图 1200×1600 → 嵌入 README hero 图（含两轮视觉质检）
