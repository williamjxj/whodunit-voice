# 资源清单 (Resources)

## 运行需求表

| What | Needed? | Why |
|---|---|---|
| Node.js >= 18（实测 v22.21.1） | **Yes** | 核心运行时（内置 http/fetch，无需依赖） |
| `npm install` | **No** | 零第三方依赖，跳过 |
| .env 文件 | **Required** | DeepSeek API key（复制 .env.example） |
| DeepSeek API key | **Required** | 嫌疑人扮演与法官判定 |
| 浏览器（Chrome/Edge/Safari） | **Yes** | 语音识别/合成走浏览器原生 Web Speech API |
| Docker | **No** | 未使用 |
| 数据库 (PostgreSQL/Redis/SQLite) | **No** | 案件数据为本地 JSON 文件 |
| 云服务 | **No** | 本地运行；DeepSeek 为唯一外部调用 |
| 麦克风权限 | **Required（语音功能）** | 浏览器询问授权；无麦克风可纯打字 |

## 依赖清单

零 npm 依赖。运行时仅使用 Node.js 内置模块：

```
http        — Web 服务器
fs / path   — 静态文件与数据读取
url         — 路由解析
fetch       — 调用 DeepSeek API（Node 18+ 内置）
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
| `PORT` | 服务端口，默认 4310 |
| `HOST` | 监听地址，默认 127.0.0.1；当为 127.0.0.1 时服务端同时绑定 IPv6 `[::1]`（macOS 浏览器经 IPv6 访问 localhost，勿删） |

## 明确不需要的东西

- 不需要 Docker、数据库、Redis、消息队列、任何 npm 包、构建工具、外网部署。
- 不需要第三方语音 API（识别/合成均由浏览器内置完成）。
