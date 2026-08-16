# 手机端应用设计（Mobile App Spec）

> 目标：让玩家在 iPhone / Android 手机上完整体验"开口审问"。
> 状态：**已搁置（2026-08-16）**——用户决定先专注案件制作流水线（CASE-PIPELINE-SPEC），
> 手机端涉及原生壳/语音识别/上架等较多改动与挑战，暂不投入。本文保留为后续评估参考，
> 恢复前无需修改，也不进入路线图执行。配套：[MOBILE-APP-PLAN.md](MOBILE-APP-PLAN.md)。

## 1. 现状架构（先回答"前端是什么"）

前端是**零框架纯静态 SPA**：
- `public/index.html`（页面骨架）
- `public/app.js`（全部逻辑：案件加载/审问/线索/指控/i18n/语音识别与合成）
- `public/styles.css`（样式）

与后端同源通信（`127.0.0.1:4310`，无 CORS），API：
`/api/cases`、`/api/case`、`/api/chat`、`/api/accuse`、`/api/tts`、`/api/tts/voices`、`/api/health`。
目前**没有** PWA manifest / Service Worker / 移动端适配。

这决定了手机端的最优路径：**尽量复用现有 app.js + HTML/CSS，不重写 UI**。

## 2. 关键平台约束（决定方案走向）

| 约束 | 影响 |
|---|---|
| **iOS Safari 不支持 Web Speech 识别**（SpeechRecognition 在 iOS 不可用） | iPhone 上"开口审问"必须走原生壳 + 原生语音识别，或服务端 STT；PWA 在 iOS 无法语音输入（只能打字） |
| Android Chrome / WebView 支持 Web Speech | Android 上 PWA / WebView 均可语音，成本低 |
| 麦克风权限 | 浏览器/应用都需要用户授权（secure context 才给 Web Speech） |
| HTTPS | 语音识别与 TTS 的 Web Audio 均要求 secure context；上线必须 HTTPS |
| 应用商店 | iOS 上架需开发者账号（$99/年）；Android 上架 Play 需 $25 一次性 |

## 3. 方案对比

| 方案 | 成本 | 语音识别 | 上架 | 结论 |
|---|---|---|---|---|
| **A. PWA** | 最低（1-2 天） | Android ✅ / iOS ❌ | 不通过商店 | **先做**：立即可玩、Android 完整体验 |
| **B. Capacitor 封装**（Ionic 生态，复用现有 Web 前端） | 中（1-2 周） | 两端 ✅（原生插件补 iOS） | ✅ App Store + Play | **主推**：一套前端双端上架 |
| C. React Native / Flutter 重写 | 高（1-2 月） | ✅ | ✅ | 不推荐：重写 UI，失去现有零框架优势 |

**推荐路线：先 A 后 B。**

## 4. 目标架构（B 阶段）

```
iOS App（Capacitor WebView）
   ├─ 加载打包后的 public/（本地静态资源）
   ├─ 语音识别：capacitor-speech-recognition（原生 SFSpeechRecognizer）
   ├─ 麦克风权限：原生权限弹窗
   └─ fetch → 后端 API（HTTPS 域名 + CORS 白名单）

Android App（Capacitor WebView，Chromium）
   ├─ 语音识别：Web Speech（WebView 支持）或同一原生插件统一
   └─ 其余同上

后端 server.js
   ├─ 增加 CORS 白名单（仅允许本 App 域名/来源）
   ├─ 生产环境 HTTPS（域名 + 证书，反代或直接 TLS）
   └─ 可选：/api/tts 增加缓存与流式输出优化移动网络
```

## 5. 语音方案细节

### 5.1 输入（STT）

- **Android**：优先 Web Speech（零改动）；若 WebView 兼容性问题，降级用同一原生插件。
- **iOS**：原生插件 `capacitor-speech-recognition`（免费，on-device 识别，中文/英文随系统语言），
  app.js 需加一个"语音输入适配层"：有原生桥时调原生，否则回退 Web Speech，再否则打字。
- **兜底**（可选）：服务端 STT（如 DashScope Paraformer 按量计费），
  用于原生插件不可用/多语言不稳的场景。**是否启用由用户决定（涉及费用）。**

### 5.2 输出（TTS）

现有服务端链路（Sambert → Edge TTS → 浏览器兜底）在 WebView 中照常工作（Web Audio 播放），
基本无需改动；只需保证网络策略允许混合内容（HTTPS 页面 + 同域 API 音频）。

## 6. 移动端 UX 适配（app.js/styles.css 小改）

- viewport 与安全区（`viewport-fit=cover` + `env(safe-area-inset-*)`）
- 触摸目标 ≥ 44px；审问输入框适配虚拟键盘（`visualViewport` 监听）
- 麦克风按钮在 iOS 无语音能力时自动降级为"打字提示"
- 后台切回后 Web Audio 恢复（`visibilitychange` 处理）
- PWA 阶段：manifest（图标/名称/主题色）+ 离线壳（Service Worker 缓存静态资源；API 仍需在线）

## 7. 范围与不做的事

- 本期**不改后端数据模型、不改案件结构、不改玩法**
- 不做账号系统/云存档（列为 P3 单独设计）
- 不做 React Native / Flutter 重写
- 不上架"纯 PWA"到应用商店（商店分发由 Capacitor 阶段承担）

## 8. 待决问题（需要用户拍板）

1. iOS 语音识别：原生插件方案是否接受？（免费，on-device；不支持 Web Speech 的兜底）
2. 是否启用服务端 STT 兜底（按量付费）？
3. 是否申请 App Store 开发者账号（$99/年）与 Play 开发者账号（$25）？
4. 生产域名选哪个（需要 HTTPS + CORS 白名单）？
