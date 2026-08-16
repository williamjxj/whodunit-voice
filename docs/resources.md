# 资源清单 (Resources)

## 运行需求表

| What | Needed? | Why |
|---|---|---|
| Node.js >= 18（实测 v22.21.1） | **Yes** | 核心运行时（内置 http/fetch）；**多音色 TTS 需 Node >= 22**（原生 WebSocket），否则自动回退浏览器语音 |
| `npm install` | **No** | 零第三方依赖，跳过 |
| .env 文件 | **Required** | DeepSeek API key（复制 .env.example） |
| DeepSeek API key | **Required** | 嫌疑人扮演与法官判定 |
| DashScope API key（`DASHSCOPE_API_KEY`） | **可选，强烈建议** | 多音色 Sambert TTS（不配则回退浏览器单一语音） |
| Edge TTS（`EDGE_TTS_ENABLED=1`） | **可选（默认开）** | 免费多音色源（322+ 音色，无需 Key）；无 DashScope Key 时自动作为主音色源 |
| 本地 ComfyUI（`127.0.0.1:8188`） | **可选** | 生成人物画像用（国风4 / Animagine XL 4.0，见 [comfyui/README.md](../comfyui/README.md)）；已提交 76 张图，不跑 ComfyUI 也不影响游戏 |
| 浏览器（Chrome/Edge/Safari） | **Yes** | 语音识别/合成走浏览器原生 Web Speech API |
| Docker | **No** | 未使用 |
| 数据库 (PostgreSQL/Redis/SQLite) | **No** | 案件数据为本地 JSON 文件 |
| 云服务 | **No** | 本地运行；DeepSeek（对话）+ DashScope（TTS，可选）为外部调用 |
| 麦克风权限 | **Required（语音功能）** | 浏览器询问授权；无麦克风可纯打字 |

## 依赖清单

零 npm 依赖。运行时仅使用 Node.js 内置模块：

```
http        — Web 服务器
fs / path   — 静态文件与数据读取
url         — 路由解析
fetch       — 调用 DeepSeek API（Node 18+ 内置）
WebSocket   — 调用 DashScope Sambert TTS（Node 22+ 内置，可选）
crypto      — 生成 TTS 任务 UUID（node:crypto）
```

## 数据存储

| 数据 | 位置 | 类型 |
|---|---|---|
| 案件/嫌疑人/线索 | `data/cases/<caseId>/*.json` | 本地 JSON（只读，启动时载入内存） |
| 游戏进度（线索/分数/审问记录/提示/情绪） | 浏览器 localStorage | 单槽存档，随案件自动保存 |
| API key | `.env`（已 gitignore） | 仅服务端读取 |

## 环境变量

```bash
cp .env.example .env   # 然后填入真实 key
```

| Key | 用途 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API 认证（必填） |
| `DEEPSEEK_MODEL` | 模型 ID，默认 `deepseek-v4-flash` |
| `DEEPSEEK_BASE_URL` | API 地址，默认 `https://api.deepseek.com` |
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key，用于多音色 TTS（Sambert）。不配置时前端回退浏览器 speechSynthesis |
| `DASHSCOPE_TTS_URL` | Sambert WebSocket 地址，默认 `wss://dashscope.aliyuncs.com/api-ws/v1/inference` |
| `EDGE_TTS_ENABLED` | 微软 Edge TTS 免费音色源开关，默认 `1`（开启）；`0` 关闭 |
| `PORT` | 服务端口，默认 4310 |
| `HOST` | 监听地址，默认 127.0.0.1；当为 127.0.0.1 时服务端同时绑定 IPv6 `[::1]`（macOS 浏览器经 IPv6 访问 localhost，勿删） |

## 明确不需要的东西

- 不需要 Docker、数据库、Redis、消息队列、任何 npm 包、构建工具、外网部署。
- 不需要任何 npm 包、构建工具、外网部署。
- 语音识别由浏览器内置完成；语音合成按优先级：阿里云 Sambert（可选 Key）→
  微软 Edge TTS（免费，无需 Key）→ 浏览器 speechSynthesis 兜底。
- 人物画像已随仓库提交（`public/characters/`，76 张 PNG）；本地 ComfyUI 仅用于
  后续"换形象/重出图"（`node comfyui/generate.mjs`），非运行必需。

## 灵感来源 (Inspiration)

项目灵感来自两类趋势的交汇：

- **LLM 角色扮演 / 互动叙事**：ChatGPT 等对话模型出现后，GitHub 上涌现大量
  "把大模型当 NPC / 主持人" 的互动作品——AI 侦探推理游戏、AI 审讯模拟、AI 跑团
  （D&D 式多人叙事）等。本项目"嫌疑人由 LLM 实时扮演、法官由同一模型判定"即源于此。
- **语音交互**：浏览器原生 Web Speech API 让"开口对话"零依赖可行，配合 AI 语音
  陪伴类应用的流行，把"打字审问"升级为"开口审问，也能打字"。

架构取舍（案件 JSON 可插拔、零依赖 Node 服务、本地优先）参考了 GitHub 上
"零依赖小工具"与"AI 本地应用"类仓库的常见风格：能本地就不上云，能静态就不引框架。

## 开发工具链 (Tools used)

| 环节 | 工具 | 用途 |
|---|---|---|
| 构思 | ChatGPT Web（网页版） | 获取创意、讨论玩法与案件设定 |
| 改进 | Codex Desktop（桌面版） | 迭代功能、完善案件与修复问题 |
| 测试与调试 | VSCode + OpenCode | 浏览器实测（Playwright）、语音链路验证、视觉质检、代码审查与 git 管理 |
