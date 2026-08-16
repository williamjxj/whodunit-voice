# 手机端应用实施计划（Mobile App Plan）

> 配套：[MOBILE-APP-SPEC.md](MOBILE-APP-SPEC.md)。状态：**已搁置（2026-08-16）**，
> 暂不执行；如后续恢复，从 M0 决策门重新确认再启动。
> 原则：先 PWA（1-2 天可玩），再 Capacitor 上架（1-2 周）；每一步可独立验收。

## M0 决策门（用户确认后启动）

- [ ] 确认 iOS 语音走原生插件（免费 on-device）
- [ ] 确认是否启用服务端 STT 兜底（按量付费）
- [ ] 确认 App Store / Play 开发者账号预算
- [ ] 确认生产域名（HTTPS）

## M1 PWA 化（预计 1-2 天）

目标：手机浏览器访问即"像 App"，Android 可安装、可语音。

- [ ] `public/manifest.webmanifest`：名称/图标（可用现有角色图或 🔍 图标）/主题色/display standalone
- [ ] 图标：192/512 PNG（由现有 ComfyUI 或现有素材派生）
- [ ] `public/sw.js`：缓存静态资源（index.html/app.js/styles.css/characters 图片走缓存优先；
      API 请求不缓存）
- [ ] `index.html` 注册 Service Worker + `<meta name="theme-color">` + apple-touch-icon
- [ ] viewport 适配：`viewport-fit=cover`、安全区 CSS、触摸目标 ≥44px
- [ ] 语音适配层 v0：`getSpeechRecognition()` 统一封装（Web Speech；预留原生桥接口）
- [ ] 验证：Playwright 手机视口（iPhone/Android UA）实测案件选择 → 审问 → 打字提问链路；
      Android Chrome 真实设备语音冒烟（如有）

## M2 Capacitor 封装（预计 1-1.5 周）

目标：iOS + Android 原生应用，复用 100% 现有前端。

- [ ] 初始化 Capacitor 项目（`capacitor.config.ts`：appId 如 `com.whodunit.voice`、webDir 指向打包后的 public）
- [ ] 构建脚本：`npm run build:mobile`（复制/打包 public 静态资源到原生壳）
- [ ] iOS：`npx cap add ios`；Android：`npx cap add android`
- [ ] 原生语音插件 `capacitor-speech-recognition` 接入；app.js 语音适配层完成
      （`window.WhodunitVoiceBridge`：有原生桥 → 原生识别 → 文本回填输入框 → send）
- [ ] 麦克风/录音权限配置（iOS `Info.plist` NSSpeechRecognitionUsageDescription；
      Android `RECORD_AUDIO`）
- [ ] 后端 CORS 白名单（生产域名）+ HTTPS 部署（反代 nginx/caddy 或 Node TLS）
- [ ] 离线/弱网：TTS 音频请求超时与重试；图片懒加载已有
- [ ] 验证：
  - iOS 模拟器：语音识别（英文+中文各 1 次）、审问、TTS 播放
  - Android 模拟器：同上
  - 真实 iPhone 冒烟（如有设备）

## M3 上架准备（预计 3-5 天，需账号/资料）

- [ ] App 图标/启动屏（商店规范尺寸）
- [ ] 隐私政策页（麦克风用途；语音识别在设备端/服务端说明）
- [ ] App Store：ASO 文案（名称/副标题/截图/描述）
- [ ] Play：应用签名（Play App Signing）
- [ ] 后端生产环境加固：限流 + 请求体大小限制 + 错误日志（上线前必须，见 REVIEW.md §1.2）
- [ ] 提审并处理反馈（重点：麦克风权限用途说明、语音数据去向）

## M4 上线后迭代（候选）

- 服务端 STT 兜底（如决策启用）
- 云存档/账号（P3，另行设计）
- 案件流水线配合（CASE-PIPELINE-SPEC）保证上线后有新内容可推

## 风险与依赖

| 风险 | 缓解 |
|---|---|
| iOS WebView 语音识别兼容性 | 原生插件兜底 + 打字永远可用 |
| 商店审核（麦克风权限） | 权限用途文案写清楚；语音数据（服务端 TTS）不含识别音频上传（原生识别在设备端） |
| CORS/HTTPS 配置错误 | 先在 M1 用 PWA 验证同一域名部署，再套 Capacitor |
| Capacitor 版本与前端零框架兼容 | 前端是纯静态，无框架冲突风险，成本主要在原生插件与打包 |

## 验收标准（整体）

1. iPhone Safari 打开 PWA：能打字玩完整局（案件 → 审问 → 线索 → 指控），TTS 有声
2. iPhone App：能用语音提问（中文/英文），其余与桌面体验一致
3. Android App：语音提问可用，安装图标正常，能完整通关
4. 后端生产环境：HTTPS + CORS 白名单 + 限流，无明文密钥
