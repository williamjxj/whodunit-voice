# TTS 语音方案研究报告（v0.5–v0.6）

> 面向决策者的研究 + 实验总结。结论先行：**建议双轨并行——Edge TTS 做免费默认源，
> 阿里云 Sambert 做高质量主源（有 Key 自动切换），浏览器语音最后兜底。**
> 该架构已实现并跑通，本文给出依据、实测数据、成本测算与可决策的选项。

---

## 1. 背景与目标

应用核心是"声音"：语音审问 + 语音回复。用户反馈原始问题：

1. 回答只有文字、没有声音（浏览器 speechSynthesis 在 macOS/Chrome 上不可靠）；
2. 不同角色要有不同声音，男角色男声、女角色女声（智能配音）；
3. STT 与 TTS 都要真正可用；
4. 调研免费/多音色的语音库（kimi / qwen / baidu / elevenlabs / heygen 等），能集成就集成；
   用户持有阿里云与 Kimi token，可走 API 使用官方音色库。

约束：项目零 npm 依赖、Node >= 18、反作弊（/api/case 不下发 secret/guilt/solution）、
i18n 中英双写。

---

## 2. 调研结论（逐项排除）

| 方案 | 结论 | 排除/采用理由 |
|---|---|---|
| Kimi API | ❌ 排除 | 官方明确不支持 TTS 与 ASR |
| ElevenLabs | ⚠️ 不选 | 免费仅 10k 字符/月；需注册；国内访问受限 |
| 浏览器 speechSynthesis | ⚠️ 兜底 | 免费但 macOS/Chrome 中文静默，音色单一 |
| 百度/讯飞等 | ⚠️ 不选 | 免费额度小、接入重，性价比不如 Edge/Sambert |
| **微软 Edge TTS** | ✅ 采用（免费源） | 322 音色 / 142 locale / 75 语言（live 实测）；免费、无 Key、无需注册；音质好 |
| **阿里云百炼 Sambert** | ✅ 采用（主源/质感源） | 官方 API、有 SLA；48kHz WAV；约 40 音色（含磁性男声/悬疑解说/多情感）；1 元/万字符、月 3 万字符免费额度；用户已有阿里云 token |
| CosyVoice（阿里百炼） | 🔮 未来备选 | 100+ 角色化音色（如龙三叔），更"配音演员"；1.5 元/万字符起，接入更重 |

---

## 3. 实验记录（2026-08-15 实测）

### 3.1 Edge TTS 协议验证（真实联网）

- 端点：`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
  + `TrustedClientToken` + `Sec-MS-GEC`（sha256(五分组取整的 Windows ticks + token)）+ `Sec-MS-GEC-Version`。
- 消息流：`speech.config`（文本帧）→ `ssml`（文本帧，`<prosody rate/pitch>` 调语速音调）
  → 二进制帧（前 2 字节头长 + `Path:audio` + MP3 数据）→ `turn.end` 结束。
- 实测结果（原生 Node WebSocket，零依赖）：
  - 中文 `zh-CN-XiaoxiaoNeural`（晓晓）：成功，合法 MP3，24kHz / 48kbps / mono，约 5.1s；
  - 英文 `en-US-EmmaMultilingualNeural`：成功，约 3.6s；
  - 日语 `ja-JP-NanamiNeural`：成功；
  - prosody 语速 +20% / 音调 −8Hz：成功生效；
  - live 音色清单：**322 voices / 142 locales**（zh-CN 8 个、en-US 17 个）。
- 风险应对：系统时钟偏差导致 403 时，抓服务端 `Date` 头校准一次后重试（已实现）。

### 3.2 阿里云 Sambert 协议验证

- 端点：`wss://dashscope.aliyuncs.com/api-ws/v1/inference`
  + 请求头 `Authorization: Bearer <DASHSCOPE_API_KEY>`；
  + `run-task` JSON：`payload.model=sambert-xxx-v1`、`input.text`、`parameters.format=wav`。
- 响应：二进制帧为音频；`task-started / result-generated / task-finished / task-failed` 事件。
- 实测结果：
  - 假 Key 握手失败：**0.8s 内返回 502 + 明确报错**，不会挂死（45s 超时兜底）；
  - 真实合成：**待用户补 Key 后验证**（协议与官方文档一致，代码已就绪）。

### 3.3 浏览器端验证

- 嫌疑人音色标签：钱伯年显示「🎙 云健 ♂」（Sambert 磁性男声 → Edge 云健自动映射）；
- 朗读链路：点击「🔊 听案件简报」出现「正在播放…… · 云夏」状态
  （证明 浏览器 → 服务器 → 微软 Edge → 解码 → Web Audio 播放 全链路贯通）；
- 无 DashScope Key 时 `provider:'sambert'` 自动降级 Edge 合成（200 + MP3，不再 502）；
- 反作弊复检：/api/case 仅透传 voice 字段，无 secret/guilt/solution 泄露。

---

## 4. 已实现功能（v0.5–v0.6）

### 服务端（server.js，保持零 npm 依赖）

- `POST /api/tts`：`{text, voice, rate?, pitch?, provider?}`，provider 支持
  `auto | sambert | edge`，返回 `audio/wav`（Sambert）或 `audio/mpeg`（Edge）；
  - 文本 ≤1000 字符；45s（Sambert）/ 30s（Edge）超时；内存缓存 ≤64 条；
- `GET /api/tts/voices`：双注册表（Sambert 21 + Edge 精选 40）+ `activeProvider`
  + `sambertToEdge` 映射；
- 自动优先级：`DASHSCOPE_API_KEY` 存在 → Sambert；否则 → Edge（免费）；
  都不可用 → 前端浏览器语音；
- `EDGE_TTS_ENABLED=0` 可关闭 Edge 源；Node < 22 无原生 WebSocket 时优雅降级。

### 数据层

- 三个案件 15 名嫌疑人全部配置 `voice` + `voiceRate` + `voicePitch`
  （男声/女声按性别匹配，按年龄/性格微调语速音调）；
- `SAMBERT_TO_EDGE` 21 条映射，保证免费源下角色人设不丢
  （例：磁性男声→云健、温柔女声→晓晓、萝莉→晓伊、悬疑解说→云希、
  Vivienne 法语腔→Denise、法官中文→云扬）。

### 前端（app.js）

- `speak()` 重写：服务端多音色 → Web Audio 播放；失败自动回退浏览器语音；
- 审问回复用嫌疑人专属音色；判决用法官音色；新增「🔊 听案件简报」旁白朗读；
- 状态指示（正在合成/播放 + 音色名）、嫌疑人音色标签、朗读按钮高亮；
- STT 保持浏览器 Web Speech API（Chrome/Edge/Safari，中文案自动切 zh-CN）；
- i18n 新增文案中英双写；TTS 开关持久化。

---

## 5. 三方对比（决策核心）

| 维度 | Edge TTS | 阿里云 Sambert | CosyVoice |
|---|---|---|---|
| 音色数量 | **322**（live 实测） | ~40（中文约 30） | **100+ 角色化** |
| 音质 | 好（24kHz MP3） | **更好**（16k/48kHz WAV） | 好（支持复刻音色） |
| 中文情感 | 单一语气/音色 | **多情感音色（知妙等）** | 角色化强 |
| 成本 | **免费** | 1 元/万字符；月 3 万字符免费额度 | v3.5-flash 0.8 元/万字符起 |
| 稳定性/合规 | 非官方接口，可能 403/改鉴权 | **官方 API + SLA**，限流 1200 RPM | 官方 API |
| 接入状态 | ✅ 已集成（当前默认） | ✅ 已集成（填 Key 即用） | ❌ 未集成（可扩展） |

---

## 6. 成本测算（单局游戏）

估算口径：一局 20–40 次提问 × 每次回复约 60–120 字符 + 简报/判决 ≈
**3000–6000 字符/局**。

| 方案 | 单局成本 | 每月免费额度 |
|---|---|---|
| Edge TTS | **0 元** | 无上限（实际） |
| Sambert（1 元/万字符） | 约 **0.3–0.6 分** | 3 万字符 ≈ 5–10 局免费 |
| CosyVoice flash（0.8 元/万字符） | 约 0.25–0.5 分 | 视活动 |

结论：**费用维度上三者几乎都可以忽略**，Sambert 单局成本在"一分钱以内"量级。
决策不应卡在成本，而应卡在稳定性与音色质感。

---

## 7. 风险与缓解

| 风险 | 说明 | 缓解 |
|---|---|---|
| Edge 非官方接口 | 微软可能改鉴权/限流/区域封锁 | 已实现时钟校准+重试；回退链自动降级；社区持续跟进协议 |
| Sambert 非零成本 | 欠费/Key 失效会 502 | 自动降级 Edge → 浏览器；服务端报错即切换，无需人工 |
| 浏览器语音不稳定 | macOS/Chrome 中文可能静默 | 已降级为最末位兜底，不再依赖它出声 |
| 语音合成延迟 | 影响对话节奏 | Edge 实测秒级；Sambert 官方 WebSocket 同样低延迟；均走服务端缓存 |

---

## 8. 决策点（供你判断）

### 决策 A：默认音色源
- **A1（推荐）**：双轨并行——Edge 免费默认 + Sambert 有 Key 自动优先生效（现状）；
- A2：只用 Edge（零成本，接受非官方波动）；
- A3：只用 Sambert（最稳，接受极小费用）。

### 决策 B：是否配置 DASHSCOPE_API_KEY
- **B1（推荐）**：配置。你有阿里云 token，免费额度 + 更高音质 + 官方稳定；
  一局游戏不到一分钱；欠费还能自动掉回 Edge；
- B2：不配置。保持纯免费，当前 Edge 已可用。

### 决策 C：是否升级 CosyVoice 角色化音色
- **C1（暂缓）**：现有 15 角色 + 40/322 音色已够用；
- C2（未来）：「每案专属声优」级体验时再上，100+ 角色音色更适合夸张人设，
  接入成本与费用都更高。

### 决策 D：是否给玩家音色选择权（可选迭代）
- D1（暂缓）：角色音色由剧本固定，保证人设一致；
- D2（未来）：玩家可在音色面板切换自己提问时的"侦探音色"或旁白音色。

---

## 9. 验证清单与待办

已完成：
- [x] Edge TTS 真实合成（中/英/日 + 语速音调），MP3 校验通过；
- [x] Sambert 协议确认 + 握手失败快速报错路径；
- [x] /api/tts 双 provider、自动优先级、缓存、时钟校准；
- [x] 15 嫌疑人音色数据 + 21 条 Sambert→Edge 映射（全部有效）；
- [x] 浏览器端音色标签、状态指示、朗读触发全链路；
- [x] 反作弊与 i18n 复检、语法检查、文档同步。

待办（需用户配合）：
- [ ] 用户提供 `DASHSCOPE_API_KEY` 后验证 Sambert 真实合成 + 15 音色逐一试听；
- [ ] 移动端 Safari/Chrome 播放验证（MP3/WAV 解码与自动播放策略）；
- [ ] 长文本（判决陈词）分段合成体验确认。

---

## 10. 一句话结论

**声音方案已经成型且免费可用：默认 Edge TTS（322 音色）保证开箱即响，
配置阿里云 Sambert 后自动升级为官方稳定 + 48kHz 高音质，两者成本均可忽略，
建议按 B1 把 Key 填上，其余按 A1/C1/D1 维持现状。**
