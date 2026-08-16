# The Sterling Affair - 产品规格书 (SPEC)

## 1. 背景与选择依据

上一轮趋势研究（last30days + GitHub 数据）得出三个候选方向：声音、短视频、游戏。
选择"声音驱动的互动推理游戏"的理由：

- **差异化**：whodunnitai（语音审问 AI 嫌疑人）在 Hacker News 获 211 分 / 89 评论，
  证明"语音交互 + 互动叙事"是空位，而"又一个短剧生成器"是红海。
- **规避风险**：游戏行业消费者正在惩罚"AI 生成资产"的游戏（"no generative AI used"
  标签使销量 5 倍；律师警告版权诉讼）。本项目 AI 只做角色扮演和判定，不生成受版权争议的资产。
- **技术可行**：浏览器原生 Web Speech API 提供语音识别与合成，零语音 API 成本；
  DeepSeek V4 Flash 只做"嫌疑人/法官"的推理，本地 Node 代理保护 API key。
- **适合 solo**：无数据库、无构建步骤、零 npm 依赖，Node 18+ 直接运行。

## 2. 产品定义

一款浏览器端的语音互动谋杀推理游戏：玩家扮演探长，用语音（或打字）审问五名嫌疑人，
收集证据，最后指控凶手。案件与全部数据为虚构（fake data）。

- 名称：The Sterling Affair（斯特林庄园疑案）
- 形态：单页 Web 应用，桌面 + 移动端可用
- 时长：单局 10-20 分钟，可无限重玩（案件固定，流程可变）

## 3. 用户画像

- 主用户：喜欢侦探/互动小说/播客式叙事的玩家，愿意"开口说话"参与剧情。
- 次用户：AI 产品爱好者、语音交互 demo 展示者。
- 非目标：硬核游戏玩家（不追求画面与操作深度）。

## 4. MVP 范围

| 包含 | 不包含（非目标） |
|---|---|
| 案件简报 + 时间线 | 多案件/案件生成器 |
| 5 名嫌疑人的语音/文字审问 | 多人模式、账号系统 |
| 8 条线索的规则解锁与证据板 | 图像/视频生成 |
| 指控 + AI 法官判定 + 结局 | 收费、后台管理 |
| 评分与称号 | 持久化存档（刷新即重开） |

## 5. 游戏流程

1. 案件简报：受害者、地点、时间线，点击"接受案件"。
2. 大厅：选择嫌疑人开始审问；随时打开证据板；随时可指控。
3. 审问：点麦克风说话（或打字），问题发给 DeepSeek 扮演的嫌疑人；
   回答自动朗读（可关闭）；问题命中关键词时解锁线索（+20 分）。
4. 指控：选择嫌疑人 + 动机 + 引用证据，提交给"法官"（DeepSeek）。
5. 结局：正确 + 强证据 => 高分结局；正确但证据弱 => 低分结局；错误 => 真凶逍遥法外。
   展示真相、结案陈词、总分与称号，可重玩。

## 6. 假数据模型

- `data/cases/<caseId>/case.json`：案件元数据、简报、案发现场、时间线、人物关系、
  推荐提问、难度/时长、真相（凶手/凶器/动机/总结）、
  三种结局文案、称号档位。真相只存服务端，不发给客户端（防作弊）。
- `data/cases/<caseId>/suspects.json`：5 名嫌疑人（id, name, role, emoji, 性格, 不在场证明,
  秘密, 是否有罪, 揭示规则, 习惯性小动作）。揭示规则约束 LLM 的角色扮演行为。
- `data/cases/<caseId>/clues.json`：8-10 条线索（id, title, description, source, keywords, hint）。
  线索解锁为规则匹配（关键词命中），不依赖 LLM，保证确定性。

案件核心（剧透，仅供开发者）：凶手是 Marcus Chen（CFO）。Victor 发现其挪用 $4.1M，
当夜召他对质；Marcus 用阿波罗大理石半身像行凶，从花园门逃走。

## 7. 系统架构

```
浏览器 (index.html / app.js / styles.css)
   |  fetch /api/case, /api/chat, /api/accuse, /api/tts, /api/tts/voices
   v
Node 零依赖服务器 (server.js, 内置 http)
   |  DeepSeek chat completions (deepseek-v4-flash)
   |  DashScope Sambert WebSocket（多音色 TTS）
   v
DeepSeek API (api.deepseek.com) / DashScope (dashscope.aliyuncs.com)
```

- 语音识别：浏览器 Web Speech API（en-US / zh-CN，跟随案件语言）。
- 语音合成：优先服务端 DashScope Sambert 多音色（WAV → Web Audio 播放），
  未配置 Key 或失败时回退浏览器 speechSynthesis（语言匹配）。
- API key：只存在于服务端 .env，前端不可见。
- 依赖：Node >= 18 内置 http/fs/fetch；多音色 TTS 需要 Node 22+ 的原生 WebSocket
  （Node 18 无全局 WebSocket，会回退浏览器语音）。仍为零 npm 包。

## 8. API 契约

| 方法/路径 | 请求 | 响应 |
|---|---|---|
| GET /api/health | - | `{ok, model, cases, caseTitle}` |
| GET /api/cases | - | 案件列表（id/title/lang/tagline/victim/难度/时长/数量） |
| GET /api/case | `?caseId=` | case 元数据（含 scene/relations/questions/难度/时长）+ suspects（不含 secret/guilt）+ clues |
| POST /api/chat | `{caseId, suspectId, messages, question}` | `{reply, mood, tell}`（扮演回复 + 审问状态观察） |
| POST /api/accuse | `{caseId, suspectId, motive, evidence[]}` | `{verdict, truth, epilogue}` |
| GET /api/tts/voices | - | `{enabled, provider, defaultVoice, voices[]}`（音色注册表） |
| POST /api/tts | `{text, voice, rate?, pitch?, provider?}` | `audio/wav`（Sambert）或 `audio/mpeg`（Edge TTS），文本 ≤1000 字符 |

- 对话历史限制最近 12 条，单条 600 字符，防止上下文膨胀。
- 超时 45 秒；DeepSeek 失败返回 502，前端提示重试。
- `/api/chat` 回复正文末尾允许携带 `[STATE]{"mood":...,"tell":...}` 舞台提示；
  服务端剥离后返回结构化 mood/tell，缺失时回落为 `calm`（容错，不影响游戏）。

## 9. 评分规则

- 每条线索 +20（每案 8-10 条）
- 指控正确 +40
- 法官评分 0-100 计入总分
- 总分对应称号：>=240 传奇侦探；>=180 敏锐探长；>=120 有前途的警员；其余 菜鸟

## 10. 风险与限制

- 浏览器语音识别仅限 Chrome/Edge/Safari（localhost 为安全上下文），Firefox 不支持 => 文本输入兜底。
- 无 STT 服务端校验，噪声环境识别率下降。
- LLM 角色扮演可能偶尔 OOC（出戏）：通过系统提示 + 揭示规则约束，不保证 100%。
- DeepSeek 免费/低配额度有限，超时或限流时游戏可玩性下降（前端有错误提示与重试）。
- 单案件固定，重玩价值有限（路线图：多案件包、嫌疑人随机化）。

## 11. 后续路线图

1. 多案件：case pack 机制，案件可插拔。
2. 证据组合判定：法官根据"引用了哪些证据"动态给反馈。
3. 语音交互增强：连续对话模式（speech continuous + endpoint 检测）。
4. 多语言（中文语音案件）。
5. 部署：静态托管 + 服务端函数，或 Docker。

## 12. v0.2 更新（多案件 + i18n + 法官证据反馈）

**多案件包机制**
- 案件迁移为可插拔结构：`data/cases/<caseId>/{case.json,suspects.json,clues.json}`。
- 新增 API：`GET /api/cases`（案件列表）；`GET /api/case?caseId=`、`POST /api/chat`、
  `POST /api/accuse` 全部接受 `caseId`。
- 真相（solution）仍只存服务端；`/api/case` 不下发 secret/guilt/solution。

**中文案件《玉簪案》**
- 临安赵府毒杀案：受害者赵文远，真凶账房钱伯年（挪用八千两被查账，砒霜入安神酒）。
- 5 名嫌疑人（夫人/账房/女儿/管家/郎中），8 条中文线索，关键词全部为中文。
- 系统提示、判决提示均按 `case.lang` 输出中文，角色扮演规则与英文案件等价。

## 13. v1.0 更新（内容丰富 + 玩法增强）

**内容**
- 新增英文案件《The Midnight Meridian》（1927 豪华列车密室命案，5 嫌疑人 + 10 线索）。
- 三个案件包统一新增：`scene`（案发现场描写）、`relations`（人物关系，客户端渲染关系图）、
  `questions`（推荐提问，≤6 条）、`difficulty`（1-3 星）、`estimatedMinutes`、`victim.emoji`。

**玩法**
- 审问状态观察：嫌疑人情绪徽章（calm/uneasy/agitated/cornered）+ 小动作提示。
- 推荐提问一键发送；证据板 💡 提示（每条 −5 分、每案 3 次）。
- localStorage 存档续玩（线索/分数/审问记录/提示/情绪），案件卡片 ▶ 继续徽章 + 简报续玩横幅。
- 成就（线索猎手/八面玲珑/快刀斩乱麻/铁证如山）、按案件最佳分、音效开关（WebAudio 合成）。
- 判决页：成就墙、复制结果、返回大厅（错判后继续调查）、再玩一次。
- 证据板按“案发现场 / 来自嫌疑人”分组；嫌疑人卡片显示简介与“已审问”徽章。

**反作弊边界（不变）**
- `/api/case` 永不返回 solution/secret/guilt；新增 scene/relations/questions 均为可公开信息，
  关系图标签只使用案件内公开关系，不泄露秘密线索。

**UI 国际化**
- `I18N` 字典（en/zh）覆盖全部界面文案；`data-i18n` 属性 + `applyLang()` 动态切换。
- 语音识别语言与 TTS 语言跟随案件语言（en-US / zh-CN）。

**法官证据反馈**
- 判决 JSON 新增 `strong`（支持判决的最多 3 条证据）与 `missed`（未引用但关键的最多 3 条证据）。
- 结局页新增"结案复盘"：已发现线索数、漏掉的线索（附提示）。

## 14. v0.4 更新（语音朗读修复 + 宣传海报）

**语音朗读修复（macOS 中文静默）**
- 根因：`loadVoices()` 固定选中 Samantha（en-US），而 `utter.voice` 会覆盖 `utter.lang`，
  导致中文案件在 macOS 上 TTS 无声。
- 修复：`pickVoice(lang)` 按案件语言挑选嗓音（中文案 → zh-CN 嗓音，如 Eddy 中文/Tingting；
  英文案 → Samantha），并兼容跨平台候选列表；`speak()` 增加竞态防护（仅在 speaking/pending
  时 cancel，延迟 60ms 触发）与无匹配嗓音时的 `lang` 回退。
- 🔊 朗读开关：工具栏新增 TTS 开关按钮（图标 + 双语标签），状态持久化于
  `localStorage: whodunit_ttsOn`，不随案件切换重置。

**宣传海报**
- `poster/poster.png`（1200×1600 竖版）：noir 侦探风背景由本机 ComfyUI（Juggernaut XL）生成，
  中文文案由 `poster/poster.html`/`poster.css` 程序化叠加（AI 不直出文字，避免乱码），
  Playwright 截图导出；已作为 hero 图嵌入 README 首屏。

## 15. v0.5 更新（多角色智能配音：DashScope Sambert）

**痛点修复**
- 旧版依赖浏览器 speechSynthesis，macOS/Chrome 常无声，且所有人共用同一默认音色。
- v0.5 引入服务端多音色 TTS：阿里云百炼 Sambert（WebSocket 协议，Node 原生 WebSocket，
  零 npm 依赖），21 个音色注册在 `server.js` 的 `TTS_VOICES`。

**音色分配（智能配音）**
- 每个嫌疑人在 `suspects.json` 声明 `voice`（音色 id）+ `voiceRate`（0.5–2 语速）+
  `voicePitch`（0.5–2 音调），按性别/年龄/性格映射：男角色用男声、女角色用女声；
  少女用活泼萝莉音、老江湖用悬疑解说音、法官用沉稳新闻男声。
- 三个案件共 15 名嫌疑人全部配置独立音色与语速/音调微调（同音色不同人设也可区分）。

**播放链路**
- `POST /api/tts`：`{text, voice, rate, pitch}` → DashScope Sambert 合成 → WAV 返回。
- 前端 `speak()` 优先拉取服务端 WAV，`AudioContext.decodeAudioData` + BufferSource 播放；
  未配置 `DASHSCOPE_API_KEY` 或合成失败时，自动回退浏览器 speechSynthesis（语言匹配）。
- 新增状态指示：合成中/播放中显示「正在合成语音…… · 音色名」；嫌疑人卡片显示音色标签。
- 新增「听案件简报」按钮（旁白音色朗读简报 + 现场描写）、判决由法官音色朗读。

**安全与约束**
- `/api/case` 只透传 `voice/voiceRate/voicePitch`，secret/guilt/solution 仍不下发（反作弊不变）。
- TTS 文本截断 1000 字符、45s 超时、内存缓存（≤64 条）；无 Key 时 502 + 前端回退。

## 16. v0.6 更新（免费音色源：Edge TTS）

用户询问微软 Edge TTS 是否支持 300+ 音色且可直接使用。
实测确认：**支持，且可直接使用**——live 端点当前返回 322 个音色 / 142 个 locale
（zh-CN 8 个、en-US 17 个），无需 API Key，完全免费。

**协议（零依赖原生实现）**
- `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
  + `TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4` + `Sec-MS-GEC`（sha256
  五分组取整的 Windows ticks + token）+ `Sec-MS-GEC-Version` + `ConnectionId`。
- 文本帧：先发 `Path:speech.config`，再发 `Path:ssml`（`<prosody rate/pitch>` 控制语速音调）。
- 二进制帧：前 2 字节头长，随后 `Path:audio` + MP3 数据；`Path:turn.end` 结束。
- 系统时钟偏差时服务端 403：抓取 `Date` 头校准一次后重试（参考开源 edge-tts 的 DRM 逻辑）。

**集成方式**
- `server.js` 新增 `EDGE_VOICES`（精选 40 音色：zh-CN 全 8 个、en-US 16 个、英式/法/日/韩/德/西/意/俄
  风味音色）与 `SAMBERT_TO_EDGE` 映射（21 个 Sambert 音色 → 同性别/年龄 Edge 音色），
  让 15 名嫌疑人在免费源下仍然"男声男、女声女、各有人设"。
- 自动优先级：有 `DASHSCOPE_API_KEY` 用 Sambert → 否则 Edge TTS（免费）→ 否则浏览器语音。
  `EDGE_TTS_ENABLED=0` 可关闭 Edge 源。`/api/tts/voices` 返回双注册表 + `activeProvider`。

## 17. v0.7 更新（人物图像：ComfyUI 工作流 + 前端接入）

**动机**：让案件角色"看得见"——每人一个 logo 头像 + 审问页 2-3 张表情肖像，
跟随情绪徽章切换，增强代入感。

**生成方案（本地 ComfyUI 8188，M3 18GB）**
- 角色配置库 `comfyui/config/characters.mjs`：23 个角色（18 案件人物 + 5 侦探）的
  形象/服装/年代/表情提示词，按案件匹配 checkpoint（动画风）：
  玉簪案 → `4Guofeng4XL_v12.safetensors`（国风4，2.5D 中国古风动画/游戏 CG）、
  Sterling / Midnight / 侦探 → `animagineXL40_v4Opt.safetensors`（Animagine XL 4.0 Opt，
  日式动漫二次元）。两模型均为 SDXL ε-pred，内置 VAE，标准 KSampler 直接可用。
- 生成器 `comfyui/generate.mjs`（零依赖）：先 txt2img 出 `logo`（固定种子），
  再以 logo 为底做 img2img（denoise 0.62）派生 `calm/uneasy/cornered/portrait` 变体，
  保证同一人脸型一致；支持 `--case/--char/--variants/--build-only/--dry-run`。
  另有 `--list-models` 模型就位检查；checkpoint 按文件名精确/模糊自动匹配，
  Civitai 下载的文件名略有出入也能识别。
- 输出 `public/characters/<caseId>/<charId>_<variant>.png`；每角色 workflow JSON
  自动生成于 `comfyui/workflows/`（76 个）。

**前端接入（优雅降级）**
- 嫌疑人卡片、审问页头部、受害者简报位：优先显示 logo 图，缺失自动回退 emoji；
- 审问页新增表情肖像区：随情绪徽章切换 calm/uneasy/cornered（急躁复用 cornered），
  图像缺失时隐藏；
- `case.json` 的 `victim` 新增 `id`（图像命名用），随 /api/case 透传，无敏感信息。

**实测记录**
- 沈月娥 logo + calm 真实生成成功（832×1216 PNG，全链路 txt2img→上传→img2img 通过）；
- 浏览器验证：卡片/头部/肖像三处图像插槽工作，无图角色回退 emoji 正常。
- v0.7.2 全量完成：76 张全部成功（玉簪 22 / Sterling 22 / Midnight 22 / 侦探 10），
  768×1024 PNG；案件卡片新增受害者画像（`/api/cases` 增补 `victimId`）。

## 18. v0.7.2 更新（动画风切换 + 性能调优 + 全量出图）

用户反馈：三款写实 checkpoint（xxmix9 / juggernaut / realvis lightning）不满意，
要求国风动画 + 日本动漫二次元风（游戏感、轻松俏皮、不要真人写实）。

**模型与画风**
- 玉簪案 → 国风4（Civitai #118009）；其余案件与侦探 → Animagine XL 4.0 Opt
  （Civitai #1188071）。提示词全面去写实化：负面禁 `photorealistic/film photography/8k uhd`，
  正面加 `anime style / cel shading / clean lineart / guofeng game character` 等。

**性能调优（M3 18GB + 外置盘 checkpoint 实测）**
- 832×1216 / 24-26 步：单张 15+ 分钟（内存 swap），客户端 5 分钟超时频繁触发；
- 改为 768×1024 + 国风 18 步 / Animagine 16 步 + Animagine 用 dpmpp_2m karras
  （弃官方 SDE/beta，本机过慢）：模型常驻后单张 55-65 秒；
- 客户端超时 15 分钟 + 超时前最后补查历史，避免"图已生成但客户端超时白跑"；
- 连续生成约 40 分钟后内存压力回升，末段单张约 300 秒，属该机型常态。

**新增页面能力**
- 案件选择页每张卡片显示受害者画像（`/api/cases` 返回 `victimId`，前端
  `characters/<caseId>/<victimId>_logo.png`，缺失回退 emoji）；
- 案件选择页新增「🕵️ 选择你的侦探」：5 位原创侦探（福尔摩斯风/狄仁杰/少年侦探/
  和风绅士/大学生名探）头像可选，选择持久化到 localStorage，简报页显示
  「你的侦探」徽章（配图 `characters/detective/<id>_logo.png`）；
- 全部 76 张角色图已生成并随仓库提交，前端零配置即显示。

## 19. R2 图片存储（可选，v0.7.3）

Cloudflare R2 对象存储作为生成图像的**备份与可选分发源**（详见 `docs/oc_r2_image_storage_design.md`）：

**环境变量**（`.env`，均接受别名）
- `R2_IMAGES_ENABLED=1` 总开关（1/true/yes/on 均视为开启）；
- `ACCOUNT_ID`（也接受 `R2_ACCOUNT_ID` / `CLOUDFLARE_ACCOUNT_ID`）；
- `R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`；
- `BUCKET_NAME`（也接受 `R2_BUCKET_NAME`，或从 `S3_API` 解析）；
- `R2_ENDPOINT` 可选覆盖，默认 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`。

**两种模式**
- 本地模式（默认）：图像只存 `public/characters/`，`server.js` 静态服务直接提供；
- R2 模式（`R2_IMAGES_ENABLED=1`）：`comfyui/generate.mjs` 出图后除本地外同步上传
  bucket `whodunit` 的 `characters/<caseId>/<id>_<variant>.png`（失败仅告警不中断）；
  `server.js` 对 `/characters/*.png` 走零依赖 SigV4 代理（`r2.mjs`）从 R2 取图，
  内存 FIFO 缓存 50 张，R2 缺失/出错回退本地静态文件；非 PNG 路径不拦截。

**防作弊**：R2 仅存图片，代理链路永不接触 `solution`/`secret`/`guilt`。
