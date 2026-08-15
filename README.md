# Whodunit Voice - 语音互动探案

<p align="center">
  <img src="poster/poster.png" alt="Whodunit Voice 语音互动探案海报：开口，就能破案。🎙️开口审问 AI 嫌疑人 🔍细听解锁线索 ⚖️带着证据指控真凶" width="380" style="max-width:100%;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.2)">
</p>

一个浏览器端的**语音驱动互动谋杀推理游戏**：用声音（或打字）审问嫌疑人，
收集证据，指控真凶。嫌疑人由 DeepSeek V4 Flash 实时扮演，法官由同一模型判定指控。
案件与全部数据为虚构（fake data）。

## 快速开始

```bash
cd /Users/william.jiang/my-tests/my-fun/whodunit-voice
cp .env.example .env        # 填入 DEEPSEEK_API_KEY
node server.js              # Node >= 18，零依赖，无需 npm install
```

打开 http://127.0.0.1:4310 ，选择一个案件开始。

## 内置案件

| 案件 | 语言 | 概要 |
|---|---|---|
| The Sterling Affair | English | 科技富豪 Victor Sterling 死于书房，5 名嫌疑人，真凶 CFO Marcus Chen |
| 玉簪案 | 中文 | 临安绸缎庄东家赵文远被砒霜毒杀，5 名嫌疑人，真凶账房钱伯年 |
| The Midnight Meridian | English | 1927 年豪华列车密室命案：魔术师 Aldous Vance 被刺死在锁死的包厢里，5 名嫌疑人，真凶对手魔术师 Sebastian Croft |

UI、语音识别与朗读语言自动跟随案件语言（en-US / zh-CN）。

## 玩法

1. 选择案件，阅读简报与时间线，接案。
2. 阅读**案发现场**与**人物关系图**（受害者居中、嫌疑人环绕的关系网），再接案。
3. 选择嫌疑人审问。点 🎤 说话（Chrome/Edge/Safari），或直接打字，也可以用**推荐提问**一键发问。
4. 观察嫌疑人头顶的**情绪徽章**（镇定/不安/急躁/破绽毕露）与其**小动作**——压力越大，破绽越多。
5. 提问命中隐藏关键词会解锁线索（+20 分/条），自动进入证据板（按“案发现场/嫌疑人”分组）。
6. 卡住时可在证据板点 💡 **提示**（每条 −5 分，每案 3 次）。
7. 掌握证据后点 ⚖️ Accuse：选嫌疑人、填动机、勾选引用的证据。
8. 法官给出判定、评分、**关键证据反馈**、**成就**与**结案复盘**（漏掉的线索+提示）。

进度会自动保存在浏览器本地：刷新或关页后，案件卡片会显示 ▶ 继续，简报页可一键续玩。
最佳得分按案件记录，展示在案件卡片与判决页。

## 架构

```
浏览器 (语音识别/合成 + i18n UI)
   └─ fetch → Node 零依赖服务器 (server.js)
                 └─ DeepSeek API (deepseek-v4-flash)
```

- 案件包：`data/cases/<caseId>/`（case.json / suspects.json / clues.json，可插拔）
- 后端：`server.js`（静态服务 + /api/cases + /api/case + /api/chat + /api/accuse + /api/health）
- 前端：`public/index.html`、`public/styles.css`、`public/app.js`（含 I18N 字典）

## 关键设计

- **API key 安全**：DeepSeek key 只存在服务端 `.env`，前端通过同源 API 代理调用。
- **真相防作弊**：凶手/动机只存服务端，`/api/case` 不下发 solution/guilt/secret。
- **多案件可插拔**：新增案件 = 新建 `data/cases/<id>/` 三个 JSON，无需改代码。
- **线索确定性**：线索解锁是关键词规则匹配，不依赖 LLM，行为可预期。
- **LLM 角色约束**：每名嫌疑人带 personality / secret / revealRules，控制隐瞒与崩溃时机。
- **审问状态观察**：嫌疑人回复末尾携带隐藏的舞台提示（mood/tell），服务端解析后用于界面情绪徽章，不影响角色扮演正文。
- **存档续玩**：线索/分数/审问记录/提示次数/情绪状态写入 localStorage，随案件自动保存。
- **零依赖**：Node 18+ 内置 http/fetch 即可运行。

## 常见问题

- **听不到语音回复**：点 🔊 确认开启；允许浏览器使用语音合成。
- **语音识别不工作**：Firefox 不支持 Web Speech 识别，请用 Chrome/Edge/Safari，或直接打字。
- **"证人突然沉默（DeepSeek 不可用）"**：API key 无效、额度不足或网络问题，检查 `.env` 后重试。
- **想重玩**：结局页点"再玩一次"；想换案件点"换个案件"。

## 文档

- [SPEC.md](docs/SPEC.md) - 产品规格、假数据模型、API 契约、v0.2 更新
- [PLAN.md](docs/PLAN.md) - 实施计划与两轮验证记录
- [resources.md](docs/resources.md) - 运行资源清单

## 安全提示

- `.env` 已 gitignore，不要提交真实 API key。
- 语音数据不会离开浏览器（识别在本地进行）。
