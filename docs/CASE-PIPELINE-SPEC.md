# 案件制作流水线（Case Pipeline）设计

> 目标：把"新增一个案件"从小时级降到 **30 分钟内**，并让案件质量可校验、可复现。
> 状态：设计稿 v2（2026-08-16 更新：生成引擎改为 **Kimi K3**；手机端已搁置）。
> 配套：[REVIEW.md](REVIEW.md) §3。

## 1. 背景与问题

现状：3 个案件（The Sterling Affair / 玉簪案 / The Midnight Meridian）全部手工维护
`data/cases/<id>/{case.json,suspects.json,clues.json}`，存在几个痛点：

1. **无校验**：字段缺失、嫌疑人 id 引用错、solution 的 killer 不在嫌疑人列表里，
   启动时只有静默 `console.warn`（缺文件才跳过），数据错误要等运行才发现。
2. **关键词靠手感**：线索 `keywords[]` 是否"玩家会说的话"没有量化手段，解锁率看运气。
3. **出图靠手工**：每个新角色的提示词要手写进 `comfyui/config/characters.mjs`，
   和案件数据两处维护，容易不同步。
4. **无法批量试玩**：加案件后没有自动化的"AI 玩家"冒烟测试，体验回归靠人肉。
5. **故事创作没被复用**：每次从头构思案件结构/嫌疑人动机/线索链条，质量取决于手感；
   没有把"好案件的骨架"沉淀成模板和提示词。

## 2. 目标

- **新增案件 = 一次命令 + 填内容**：脚手架生成骨架 → 填 JSON → 校验 → 自动出图 → 自动试玩冒烟。
- **数据即契约**：任何案件在启动前通过 schema 校验，坏数据直接报错而非静默跳过。
- **关键词可度量**：能统计"哪些关键词容易命中、哪些永远没人说"，指导写作。
- **AI 生成初稿**：用 **Kimi K3** 根据"故事圣经 + 案件大纲"生成完整案件包初稿
  （案情/嫌疑人/线索/结局），人只做审校与微调——把"写案件"变成"审案件"。
- **为创作者铺路**（远期）：同一套模板 + 校验器可以开放成 Case Studio 网页工具。

## 3. LLM 引擎：Kimi K3（生成 + 试玩）

### 3.1 为什么是 Kimi K3

- 旗舰推理模型（2.8T MoE，1M 上下文），长文叙事/多角色一致性明显强于 DeepSeek，
  适合生成完整案件包（一份输出含案情+5 嫌疑人+8-10 线索+结局）。
- OpenAI 兼容 Chat Completions API，零 SDK 依赖，和现有零依赖风格一致。

### 3.2 接入配置（.env 新增，不入库）

```bash
KIMI_API_KEY=sk-xxx
KIMI_MODEL=kimi-k3          # 默认 kimi-k3
KIMI_BASE_URL=https://api.moonshot.cn/v1   # 国际版 api.moonshot.ai/v1

# 降级引擎：Qwen（DashScope compatible-mode，用现有 DASHSCOPE_API_KEY）
LLM_ENGINE=auto             # auto | kimi | qwen（默认 auto：Kimi 优先）
QWEN_MODEL=qwen-max         # 可选 qwen-plus / qwen-turbo
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

接口：`POST {KIMI_BASE_URL}/chat/completions`，`Authorization: Bearer $KIMI_API_KEY`。
注意：K3 是思考模型（`reasoning_content` 输出思考过程，`temperature` 不可改）；
流水线里应**忽略 reasoning_content，只取 `choices[0].message.content`**，并请求
`response_format: {type: "json_object"}` 直接产出合法 JSON。
Qwen 走 DashScope compatible-mode（`qwen-max` 等，OpenAI 兼容）；json_object 模式下
客户端会自动保证消息里含 "json" 字样（DashScope 硬性要求）。

定价参考（2026-07，人民币/1M tokens）：输入 ¥2（缓存命中）/ ¥20（未命中）、输出 ¥100。
一个案件包初稿约 15-30k 输出 tokens → 单案生成成本约 ¥1.5-3；一次试玩（5 嫌疑人 ×
6 问）约 10-20k 输出 → ¥1-2。预算友好。

### 3.3 引擎降级（auto：Kimi 失败自动切 Qwen）

`scripts/llm.mjs` 提供统一 `chatLLM({system, user, json})`：
- `LLM_ENGINE=auto`（默认）：先 Kimi K3，Key 缺失/请求失败自动降级 Qwen；
- `LLM_ENGINE=kimi` / `LLM_ENGINE=qwen`：固定引擎；
- 已实测：Kimi K3 与 Qwen(qwen-max) 均连通；Qwen 需在 json 模式下消息含 "json"（客户端已自动处理）。

## 4. 架构

```
scripts/new-case.mjs（脚手架）
   → 读取 story 大纲 + 调用 Kimi K3 生成案件包初稿
   → data/cases/<caseId>/ 初稿 JSON（供人工审校）
   → 生成 comfyui/config 角色条目（占位提示词）
scripts/validate-cases.mjs（校验器）
   → 全量校验 data/cases/* （启动时 server 也可复用）
scripts/playtest-case.mjs（试玩冒烟，可选）
   → 用 Kimi K3 扮演玩家问 N 个问题，统计关键词命中率
comfyui/generate.mjs（已有）
   → 新角色一键出图
```

### 4.1 生成流程（new-case 脚手架）

```bash
node scripts/new-case.mjs --id my-case --lang zh --difficulty 2 \
  --title "新案件" --outline "一句/一段案情梗概（可选，不写则让 Kimi 自由创作）"
```

步骤：
1. 组装**故事圣经**系统提示词（见 §4.2），携带案件元信息（语言/难度/题材/字数要求）
2. 调用 Kimi K3（`response_format=json_object`）一次产出三份 JSON
   （case / suspects / clues），写入 `data/cases/<id>/`
3. 自动跑 `validate-cases`；失败则带着校验错误回炉一次（最多 2 次重试）
4. 输出"人工审校清单"（待补内容/存疑字段/建议调整的关键词）
- `comfyui/config/characters.mjs` 追加 5+1 个角色条目（占位 desc，可再精修）

### 4.2 故事圣经（系统提示词核心，沉淀为 `scripts/prompts/story-bible.md`）

提示词里固化的"好案件骨架"：
- **封闭密室原则**：真凶必然在嫌疑人中，动机/手法/时间线自洽，无超自然；
- **嫌疑人天平**：每名嫌疑人都有"说得通的动机 + 一个不想让人知道的秘密"，
  真凶的嫌疑度不能明显高于其他人（防止三问破案）；
- **线索链设计**：8-10 条线索必须覆盖"谁/怎么/为什么"三问，至少 2 条指向非真凶；
- **关键词纪律**：每条线索 4-8 个关键词 = 玩家自然会说的话（含口语变体、同义说法），
  禁止用"专有名词缩写"或"文档原句"当关键词；
- **结局与反哺**：solution 的动机要能被线索链支撑；epilogues 按
  solved_brilliant/solved_thin/wrong 三种结局各写一段有画面感的文字。

### 4.3 校验器（validate-cases.mjs）

校验规则（失败即退出码非 0）：
- 文件齐全；JSON 可解析；id 命名 `^[a-z0-9-]+$` 且全局唯一
- `case.json`：`lang ∈ {en,zh}`；`victim.id` 存在；`solution.killer` / `killerName` /
  `weapon` / `motive` / `summary` 齐全；`solution.killer ∈ suspects[].id`
- `suspects.json`：恰好 5 人（或 ≥3）；`guilt` 恰好 1 个 true；每人有
  personality/alibi/secret/revealRules/tells；`secret` 与 `guilt` 存在互斥要求（真凶的 secret
  不应是"我就是凶手"直白版）
- `clues.json`：8-10 条；`source` ∈ suspects.id ∪ {scene}；`keywords` 非空；
  线索关键词不与其他线索大面积重叠（避免一条线索同时解锁多条）
- 关键文本长度：briefing/scene/timeline 非空；`questions ≤ 6`
- **i18n 一致性**：`lang=zh` 时 `title` 有中文；`lang=en` 时 `titleEn` 合理

接入方式：`npm run validate`（scripts 加一行）；`server.js` 启动时也调用同一校验，
失败则打印明确错误并拒绝启动（替代现在的静默 warn）。

### 4.4 自动出图

脚手架把角色 id/名字/性别/角色写进 `characters.mjs` 后，直接复用现有
`node comfyui/generate.mjs --case my-case`。无需新开发，只需保证
脚手架生成的角色条目与 `validate-cases` 的 id 一致。

### 4.5 试玩冒烟（playtest-case.mjs，可选但推荐）

- 用 Kimi K3 扮演"普通玩家"，对每名嫌疑人问 5-8 个自然问句（从模板问题池随机），
- 统计：每条线索是否被解锁、平均解锁条数、命中率低的线索 → 报告
  `docs/playtest/<caseId>.md`
- 目的不是测 LLM 角色扮演，而是**量化关键词命中率**，指导补充同义词。
- 提示词同样放 `scripts/prompts/player-sim.md`，保证试玩口径跨案件一致。

### 4.6 Case Studio（远期，创作者工具）

- Web 表单录入（嫌疑人人设/线索/关键词/结局）→ 生成并校验 JSON → 打包下载
- 校验器复用同一规则；发布 = 一个 zip 丢进 `data/cases/`（或未来 R2 远程包）
- 该阶段需要新前端页面，另出 spec，不在本期范围

## 5. 里程碑

**实现进展（2026-08-16）**
- ✅ `scripts/llm.mjs`：Kimi K3 客户端（OpenAI 兼容、json 模式、reasoning_effort=low、超时/重试）
- ✅ `scripts/validate-cases.mjs`：全量校验器（`npm run validate`；现有 6 案全绿，
  并顺手修复了 sterling 缺失的 lang/titleEn）
- ✅ `scripts/gen-cases.mjs`：三步生成器（核心 → 嫌疑人 → 线索）。
  **实测**：K3 长请求（>5-8 分钟）会被网络切断，故拆成小请求 + 重试退避；
  已用 Kimi K3 生成 3 个新案件（灯影幻戏 / 白牡丹 / The Halcyon Voyage），
  全部通过校验并接入游戏（服务端 6 案）。
- ✅ 新案件角色出图（M2 余项）：18 角色 / 66 张图已生成并直传 R2
  （`generate.mjs --r2`：上传后删本地；webui 从 R2 读取），scripts/r2-reconcile.mjs 对账。
- ⏳ 待办：server 启动时接入校验器（拒绝坏数据启动）；playtest 冒烟（M3）

| 阶段 | 内容 | 验收 |
|---|---|---|
| M1 | scripts/llm.mjs（Kimi K3）+ validate-cases + npm run validate + server 启动校验 | ✅ 前两项完成；⏳ server 启动校验待接入 |
| M2 | new-case 脚手架（Kimi 生成初稿 → 校验 → 回炉）+ 出图打通 | 一条命令生成一个"能跑"的新案初稿并能出全角色图 |
| M3 | playtest 冒烟（Kimi 扮演玩家）+ 关键词报告 | 能对任意案件产出命中率报告 |
| M4 | （可选）Case Studio v0 | 表单生成合法案件包 |

## 6. 不做的事（本期）

- 不做案件编辑器 UI（M4 之前）
- 不做远程案件市场/下载器（依赖 R2 方案落地后再议）
- 不改游戏运行逻辑（校验器只保证数据合法，不改变玩法）
- 不做手机端（已搁置，见 MOBILE-APP-SPEC 状态）

## 7. 待决问题

- Kimi K3 生成初稿后，人审校的预期工作量是多少？（目标：只改 10-20% 内容）
- 故事圣经 v0 先覆盖哪些题材？（现代/古典/科幻/奇幻，还是跟随现有三案风格）
- 试玩冒烟预算：默认每次跑 5 嫌疑人 × 6 问（约 ¥1-2）；是否要 `--dry` 只做数据校验？
