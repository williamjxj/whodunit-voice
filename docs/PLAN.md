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

## v0.5 多角色智能配音（2026-08-15）

用户反馈：回答只有文字没有声音，浏览器 speechSynthesis 在 macOS 上不可靠，且所有角色同音色。
要求：不同人不同声音、男声/女声智能匹配、STT+TTS 都要真正可用、调研可集成的多音色语音库。

**方案调研结论**
- Kimi API 官方不支持 TTS/ASR ❌；ElevenLabs 免费额度小且国内访问受限 ⚠️；
  Edge-TTS 免费但依赖网络与额外脚本 ⚠️；CosyVoice 角色化最强但主流走 WebSocket/价格高 ⚠️。
- 主选 **阿里云百炼 Sambert**：21 个注册音色（9×48kHz 中文 + 特色 16k + 7 美式英语 + 法语），
  官方 WebSocket 协议（`wss://dashscope.aliyuncs.com/api-ws/v1/inference`），
  Node 22+ 原生 WebSocket 客户端即可接入，保持零 npm 依赖 ✅。

**实现内容**
| # | 内容 | 说明 |
|---|---|---|
| 1 | server.js 接入 Sambert TTS | `DASHSCOPE_API_KEY`；`POST /api/tts`（WAV 返回，1000 字上限、45s 超时、内存缓存≤64）；`GET /api/tts/voices` 音色注册表；`/api/health` 上报 TTS 状态 |
| 2 | 嫌疑人音色数据 | 三案 15 名嫌疑人全部配置 `voice` + `voiceRate` + `voicePitch`（男角色男声、女角色女声、按性格微调语速音调） |
| 3 | 前端多音色播放 | `speak()` 优先 fetch `/api/tts` → `decodeAudioData` + BufferSource 播放；失败/无 Key 自动回退浏览器 speechSynthesis；`stopSpeaking()` 中断竞态控制 |
| 4 | 情境配音 | 审问回复用嫌疑人专属音色；判决由法官音色朗读（zh: 新闻男声知德 / en: Cally）；新增「🔊 听案件简报」旁白朗读 |
| 5 | 状态与标签 | 合成中/播放中状态指示（音色名）；嫌疑人头部音色标签（🎙 + ♂/♀） |
| 6 | 反作弊与兼容 | `/api/case` 仅透传 voice/voiceRate/voicePitch；Node 18 无原生 WebSocket 时自动回退浏览器语音；i18n 新增文案 en/zh 双写 |

**验证记录**
- [x] `node --check server.js` / `public/app.js` 通过；三个 suspects.json 全部合法且含 voice 字段
- [x] 启动后 `/api/health` 返回 `tts.enabled:false`（未配 DASHSCOPE_API_KEY，符合预期降级）
- [x] `GET /api/tts/voices` 返回 21 音色 + enabled:false；`POST /api/tts` 无 Key 时 502 + 明确报错文案
- [x] 真实语音合成端到端验证（2026-08-15 用户补 Key 后实测：`provider=sambert` 返回
  48kHz/16bit mono WAV，时长 3.47s，`X-TTS-Provider: sambert`）
- [ ] 15 音色逐一试听 + 移动端播放验证

## v0.6 免费音色源：Edge TTS（2026-08-15）

用户询问 Edge TTS 支持 300+ 声音吗、能否直接使用（免费）。

**调研与实测**
- live 端点（speech.platform.bing.com voices/list）返回 **322 音色 / 142 locale / 75 语言**
  （zh-CN 8 个、en-US 17 个，全部 neural，免费无 Key）。
- 原生 Node WebSocket 实测（零依赖）：中文「晓晓」、英文 Emma、prosody 语速/音调调节，
  三次合成全部成功，输出合法 MP3（24kHz/48kbps/mono，文件 `file` 校验通过）。

**实现**
| # | 内容 | 说明 |
|---|---|---|
| 1 | `EDGE_VOICES` 精选注册表 | 40 音色（zh-CN 全 8 + en-US 16 + 英/法/日/韩/德/西/意/俄风味） |
| 2 | `SAMBERT_TO_EDGE` 映射 | 21 Sambert 音色 → 同性别/年龄 Edge 音色，嫌疑人音色人设在免费源下不丢 |
| 3 | `synthesizeEdgeSpeech()` | 原生 WebSocket + `Sec-MS-GEC` 令牌 + `speech.config`/`ssml` 消息 + MP3 流解析；时钟偏差自动校准重试一次 |
| 4 | 自动优先级 | Sambert（有 Key）→ Edge（免费）→ 浏览器语音；`EDGE_TTS_ENABLED=0` 可关 |
| 5 | 前端适配 | `/api/tts/voices` 新结构（activeProvider + sambertToEdge）；`activeVoiceId()` 把嫌疑人 Sambert 音色映射到活跃供应商 |

**验证记录**
- [x] `node --check server.js` / `public/app.js` 通过
- [x] `/api/tts/voices` 返回双注册表 + activeProvider=edge（无 DashScope Key 时）
- [x] `POST /api/tts`（Edge 中文「晓晓」+ 英文）返回合法 MP3（X-TTS-Provider: edge）
- [x] 浏览器实测：钱伯年音色标签显示「🎙 云健 ♂」（磁性男声 → Edge 云健）；朗读触发
  「正在播放…… · 云夏」状态（Edge 合成 + Web Audio 播放链路贯通）
- [x] `provider:'sambert'` 无 Key 时优雅降级：自动用 Edge 合成，返回 200 + MP3（不再 502）
- [x] 数据一致性：15 名嫌疑人全部有 Edge 映射，21 个映射目标全部在 EDGE_VOICES 注册表内

## v0.7 人物图像（ComfyUI 工作流 + 前端接入，2026-08-15）

用户需求：每个案件人物一个 logo 头像 + 审问页 2-3 张表情图；本机 ComfyUI（8188，
MacBook M3 18GB）持续出图；按人物选择模型；侦探可选福尔摩斯/柯南/狄仁杰/日本名探风格。

**设计**
- 保脸方案：txt2img 固定种子出 logo → img2img（denoise 0.62）派生表情变体；
- 模型匹配：玉簪案（宋代古装）→ `xxmix9realisticsdxl`（亚洲写实）；
  Sterling（现代英伦）→ `juggernautXL`；Midnight（1927 列车）+ 侦探 → `realvisxlV50_Lightning`（快速批量）；
- 侦探为原创原型（福尔摩斯公有领域/狄仁杰历史人物/少年侦探等），不复制版权角色形象；
- 输出 `public/characters/`，前端三处插槽（卡片头像/审问页头部/表情肖像 + 受害者简报位），
  图像缺失自动回退 emoji，零代码即可"生图即上线"。

**实现**
| # | 文件 | 内容 |
|---|---|---|
| 1 | `comfyui/config/characters.mjs` | 23 角色提示词库（形象/服装/年代/表情/种子/参数） |
| 2 | `comfyui/generate.mjs` | 零依赖生成器：API workflow 构造 + 提交 + 轮询 + 下载 + 上传 img2img 底图 |
| 3 | `comfyui/workflows/` | 76 个 API workflow JSON（自动生成） |
| 4 | `public/app.js` / `index.html` / `styles.css` | 头像/肖像插槽 + onerror 回退 |
| 5 | `case.json` | victim 增加 `id`（图像命名） |
| 6 | `comfyui/README.md` | 使用指南（模型策略/批量/故障排查） |

**验证记录**
- [x] 全链路真实出图：沈月娥 logo + calm（832×1216 PNG，txt2img→上传→img2img 通过）
- [x] 浏览器：沈月娥卡片 logo、审问页头像 + 平静肖像（naturalWidth=832）；
  未生成角色（赵文远等）回退 emoji 正常
- [x] `node --check` 全绿；三案 case.json 合法

**待办**
- [x] 批量生成全部 23 角色（76 张图，v0.7.2 完成）
- [ ] 试听/调优个别角色的提示词（脸型、服装、表情强度）
- [x] 侦探头像选择入口（UI）：案件选择页 5 位侦探头像可选 + 简报页"你的侦探"徽章
  （v0.7.2 完成，浏览器实测通过）

**v0.7.1 一键全量 + 续跑（2026-08-15）**
- 生成器新增断点续跑：已存在的图自动跳过（`--force` 强制重出），只补缺失变体；
- 新增 `comfyui/generate-all.sh` 一键脚本（日志写 comfyui/logs/）；
- img2img 底图惰性上传：logo 无论新生成还是本地已有，都会在第一个变体前确保已上传；
- 每次跑完自动写 `public/characters/manifest.json`（图像清单）；
- 实测：沈月娥补全 4 图（logo/calm/uneasy/cornered）；重跑全跳过、秒级结束；
- `comfyui/README.md` 新增「必需模型清单」（3 个 checkpoint + 可选升级）。

**v0.7.2 动画风切换（2026-08-15）**
用户反馈：三款写实 checkpoint（xxmix9 / juggernaut / realvis lightning）不满意，要求
国风动画 + 日本动漫二次元风，游戏感、轻松俏皮，不要真人写实。

- 模型决策：玉簪案 → **GuoFeng4 XL（国风4）**（Civitai #118009，2.5D CG 游戏国风）；
  Sterling / Midnight / 侦探 → **Animagine XL 4.0**（Civitai #1188071，日式动漫 SDXL）；
  均为 SDXL ε-pred，标准 KSampler 直接用。
- 提示词全面去写实化：`NEGATIVE` 去掉 `cartoon/3d render/oversaturated`，改禁
  `photorealistic/film photography/8k uhd`；`STYLE` 换成国风动画 / 日漫扁平插画质量标签
  （`masterpiece, best quality, very aesthetic, absurdres, cel shading, clean lineart`）。
- 新增 checkpoint 自动识别：`generate.mjs` 先精确匹配，再按 `CHECKPOINT_ALIASES`
  关键词（guofeng4 / animagine）模糊匹配 ComfyUI 实际文件名，下载版本/文件名不同也不用改代码。
- 新增 `--list-models`：列出 ComfyUI 全部 checkpoint + 两个目标模型的就位检查。
- 修复：build-only 模式下不再尝试上传底图（离线可正常生成 workflow JSON）。
- `comfyui/README.md` 更新为动画模型清单 + Civitai/HF 直链 + 本机已有替代
  （iniverseMix / ghostmix 可零下载先看效果）。
- 用户已下载：`4Guofeng4XL_v12.safetensors`（国风4 v1.2）与
  `animagineXL40_v4Opt.safetensors`（Animagine 4.0 Opt）；配置改为实际文件名，
  Animagine Opt 用官方参数（22 步 / CFG 5.0 / DPM++ 2M SDE / beta）。
- 实测：沈月娥 logo+calm 用国风4 重出成功（832×1216，单张约 2.5 分钟）；
  全量 `./comfyui/generate-all.sh --force` 已后台启动（2026-08-15 20:32）。
- 性能调优（2026-08-15 深夜实测）：M3 18GB + 外置盘 checkpoint 全量 SDXL 过慢——
  832×1216/24步 单张 15+ 分钟（swap）。改为 **768×1024 + 步数 18/16 +
  Animagine 用 dpmpp_2m/karras（弃 SDE）**：模型加载后单张 55-65 秒。
  客户端超时 5 分钟 → 15 分钟，并加"超时前最后补查历史"避免白跑。
- ✅ 全量完成（2026-08-16 00:39）：76 张全部成功
  （玉簪 22 / Sterling 22 / Midnight 22 / 侦探 10），768×1024 PNG，manifest 已更新。
  注：连续跑 ~40 分钟后内存压力回升，末段单张 300 秒左右，属 M3 18GB 常态。

## v1.0.1 修复：人物关系页（2026-08-15）

用户反馈：关系图只有 emoji 节点与裸线，没有名字和关系标签；列表 `A — label B` 格式易读反。

| 问题 | 修复 |
|---|---|
| 图里缺名字 | 每个节点下方加名字（受害者金色高亮） |
| 图上没关系 | 连线加箭头（A→B）+ 中点关系标签（图上超 24 字符截断，悬停 `<title>` 看全文） |
| 列表易读反 | 改为 `A → B：关系` 清晰格式，关系文字金色区分 |

验证记录：
- [x] 玉簪案：6 节点名字 + 8 条箭头连线 + 8 条列表，格式 `赵文远 → 沈月娥：正室夫人，进门三十年`
- [x] Sterling Affair：英文长标签图上截断为 `CFO and business partner…`，列表保留全文
- [x] `node --check public/app.js` 通过；无 console 报错
- [x] 反作弊不变：/api/case 仍只透传 voice 字段；无 secret/guilt/solution

## v0.7.3 R2 图片存储（2026-08-16）

设计：`docs/oc_r2_image_storage_design.md`（server proxy + SigV4，用户已确认）；
实施：`docs/oc_r2_image_storage_plan.md` 五任务全部完成。

- [x] `r2.mjs`：零依赖 SigV4 客户端（node:crypto + fetch，移植自用户 rh-comfyui-app），
  环境变量别名兼容 LianHuanAI `S3_API` 风格；单开关 `R2_IMAGES_ENABLED` 同时管上传与提供。
- [x] `test/r2.test.mjs`：11 项 node:test 全过，含 live 回环（真实上传 whodunit bucket 再取回逐字节比对）。
- [x] `comfyui/generate.mjs`：出图落盘后同步上传 R2（`characters/<caseId>/<id>_<variant>.png`），
  失败仅 `console.warn` 不中断；`--dry-run`/`--build-only` 不产生文件故不上传。
- [x] `server.js`：`/characters/*.png` 经 R2 代理（FIFO 缓存 50 张，R2 缺失/出错回退本地），
  非 PNG 直通静态服务；启动日志显示 R2 模式。
- [x] curl 验证（R2 开）：`zhao_logo.png` 本地文件移走后仍 200 image/png（937557 字节，来自 R2），
  二次请求走缓存；manifest.json 仍为 JSON（非 PNG 不拦截）；缺失图 404。
- [x] curl 回归（R2 关 `R2_IMAGES_ENABLED=0`）：同路径 200/404，无 R2 日志行。
- [x] `.env.example` 补 R2 段；`public/characters/` 已 gitignore 且已从 git 移除（commit 9fe6944），
  生图不再入库（用户目标：不占 GitHub 空间）。
- [x] 目录重构：`r2.mjs` 移入 `comfyui/cloudflareR2/`（与 ComfyUI 相关能力同目录，结构更清晰）；
  新增 `comfyui/cloudflareR2/sync.mjs` 批量上传脚本（不用重跑出图即可补传旧图）；
  `.env` 解析改为按 REPO_ROOT 回溯；server.js / generate.mjs / test 的 import 路径同步更新。
- [x] 全量补传（2026-08-16）：`sync.mjs` 上传 76 张全部成功，移走本地文件后 curl 仍 200（字节来自 R2）。
