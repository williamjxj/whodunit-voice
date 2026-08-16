# 人物图像生成（ComfyUI）

为每个案件角色生成统一人设的系列图像：

- **logo** — 头像标识（嫌疑人卡片、审问页头部、受害者简报位）
- **calm / uneasy / cornered** — 审问对话页的 2-3 张表情肖像，跟随情绪徽章自动切换
- **portrait** — 受害者/侦探的正式肖像

## 核心思路：如何保证"同一人"脸型一致

1. 每个角色先用 **txt2img** 生成 `logo`（固定种子 + 完整形象描述）；
2. 其余表情变体以 logo 为底图做 **img2img**（denoise 0.62，仅改表情/机位/光线），
   脸型、服装、气质保持一致；
3. 角色配置集中在 [`config/characters.mjs`](config/characters.mjs)，
   改提示词 → 重跑即出新图（"持续输出"）。

## 快速开始

```bash
# 1. 确保 ComfyUI 在 127.0.0.1:8188 运行（默认地址，可用 COMFY_URL 覆盖）
# 2. 全量生成所有角色（23 个角色 × logo+变体）
node comfyui/generate.mjs

# 3. 核对模型是否就位（列出 ComfyUI 实际 checkpoint + 匹配状态）
node comfyui/generate.mjs --list-models

# 只生成某个案件 / 某个人物 / 指定变体
node comfyui/generate.mjs --case jade-pavilion
node comfyui/generate.mjs --char shen
node comfyui/generate.mjs --char shen --variants logo,cornered

# 只生成 workflow JSON 不出图 / 先看计划
node comfyui/generate.mjs --build-only
node comfyui/generate.mjs --dry-run
```

输出到 `public/characters/<caseId>/<charId>_<variant>.png`，**前端已自动接入**：
图像存在就显示，不存在自动回退 emoji（无需改代码）。

> 生成器会先精确匹配 checkpoint 文件名，再按关键词模糊匹配（`guofeng4` / `animagine`），
> 所以从 Civitai 下载的文件名略有出入也能自动识别，不用改代码。

## 角色与模型匹配（动画风，2026-08 切换）

| 案件 | 默认 checkpoint | 风格 | 建议步数/CFG |
|---|---|---|---|
| 玉簪案（宋代中国） | `4Guofeng4XL_v12.safetensors` | 中国国风 2.5D 游戏 CG / 动画插画（轻松俏皮） | 18 步 / CFG 5.5 |
| Sterling（现代英伦） | `animagineXL40_v4Opt.safetensors` | 日式动漫 / 二次元游戏风 | 16 步 / CFG 5.0 |
| Midnight（1927 列车） | `animagineXL40_v4Opt.safetensors` | 动漫 noir（优雅复古） | 16 步 / CFG 5.0 |
| 侦探（玩家化身） | `animagineXL40_v4Opt.safetensors` | 日式动漫名侦探 | 16 步 / CFG 5.0 |

> 出图分辨率统一 768×1024：M3 18GB 跑全量 SDXL 时 832×1216 会触发内存 swap
> （实测单张 15+ 分钟）；768×1024 对 UI 插槽（头像/审问页肖像）完全够用且明显更快。
> Animagine Opt 官方推荐 DPM++ 2M SDE / beta，本机过慢，改用 dpmpp_2m / karras。

## 必需模型清单（checkpoints，放 ComfyUI 的 models/checkpoints）

工作流只依赖 checkpoint，**不需要** LoRA / 额外 VAE（这两个模型都内置 VAE）/ ControlNet /
IPAdapter。两个模型都是 SDXL（ε-pred），标准 KSampler 直接用，无需 v-pred 特殊节点：

| 文件（放在 models/checkpoints） | 用途 | 类型/体积参考 | 下载地址 |
|---|---|---|---|
| `4Guofeng4XL_v12.safetensors` | 玉簪案（宋代国风动画） | SDXL 2.5D 国风，约 6.9GB | [Civitai 国风4 #118009](https://civitai.com/models/118009) · [HuggingFace](https://huggingface.co/xiaolxl/GuoFeng4_XL) |
| `animagineXL40_v4Opt.safetensors` | Sterling + Midnight + 侦探（日式动漫） | SDXL 动漫 Opt 版，约 6.9GB | [Civitai Animagine XL 4.0 #1188071](https://civitai.com/models/1188071) · [HuggingFace](https://huggingface.co/cagliostrolab/animagine-xl-4.0) |

**文件名说明**：Civitai 下载的文件名可能带数字前缀或不同版本后缀（如 `4Guofeng4XL_v12.safetensors`、
`animagineXL40_v4Opt.safetensors`）。配置里已是实际下载的文件名；若以后换版本，生成器会按关键词
`guofeng4` / `animagine` 自动匹配，无需改代码。跑 `node comfyui/generate.mjs --list-models` 一眼确认。
Animagine 4.0 **Opt** 版官方推荐 DPM++ 2M SDE + beta + 22 步 + CFG 5.0；
本机 M3 为提速改用 dpmpp_2m + karras + 16 步（配置里改回即可切官方参数）。

**想先看动画效果（不下载也能试）**——本机已装：
| 文件 | 说明 |
|---|---|
| `iniverseMixSFWNSFW_realXLV1.safetensors` | 日式动漫 SDXL，可临时顶 Sterling/Midnight/侦探 |
| `ghostmix_v20Bakedvae.safetensors`（墨幽人造人） | 2.5D 国风插画，可临时顶玉簪案 |
| `ponyDiffusionV6XL` / `dreamshaper_8` | 通用插画/动漫风备用 |

**其他候选（按需替换，改 `characters.mjs` 里的 checkpoint 重跑即可）**：
| 模型 | 说明 |
|---|---|
| 天韵古风 TY Han SDXL（[Civitai #133228](https://civitai.com/models/133228)） | 更水墨、更古风的中国风 SDXL |
| FT_二次元国风人物（SD1.5） | 二次元国风人物立绘 |
| Illustrious-XL / NoobAI-XL | 当前最强二次元底模；注意多为 v-pred，ComfyUI 需 model_type 特殊节点，选 ε-pred 版则免 |

**性能**：M3 18GB + 外置盘 checkpoint 实测单张约 4-8 分钟（含模型载入/swap），
23 角色约 4-6 小时。想再快：把 `width/height` 降到 704×1024，或步数再降 2-4。
只想快速预览：临时把 checkpoint 换成 `iniverseMixSFWNSFW_realXLV1.safetensors`、steps 降到 18-20。
想更"扁平 2D 动画"：把 `characters.mjs` 里 `STYLE.jade` 的 `2.5D` 改成 `flat 2D animation` 再重跑。

## 变体命名与 UI 情绪映射

| 文件 | 用途 | UI 映射 |
|---|---|---|
| `<id>_logo.png` | 头像/卡片/受害者简报 | 固定使用 |
| `<id>_calm.png` | 审问页默认肖像 | 情绪 = 镇定 |
| `<id>_uneasy.png` | 审问页肖像 | 情绪 = 不安 |
| `<id>_cornered.png` | 审问页肖像 | 情绪 = 破绽毕露（急躁也复用此图） |

## 侦探形象（原创设计）

侦探图在 `public/characters/detective/`，目前仅作为可选素材，未接入 UI
（后续可做"选择你的侦探"入口）。设计为**原创原型**而非直接复制版权角色：
英伦烟斗侦探（福尔摩斯为公有领域原型）、狄仁杰（历史人物）、
少年名侦探（原创，不复制柯南形象）、和风绅士侦探、大学生名探。
如需"辨识度优先"，可在 `characters.mjs` 中自行调整提示词。

## 故障排查

- **连不上 ComfyUI**：确认 8188 端口在线（`curl http://127.0.0.1:8188/system_stats`），
  或 `COMFY_URL=http://localhost:8188 node comfyui/generate.mjs`
- **缺模型**：报错会指明 checkpoint 名；确认它在 ComfyUI 的 checkpoints 目录
  （本机多盘布局见 `.agents/skills/comfyui-model-locator/`）
- **出图慢**：M3 18GB + 外置盘 checkpoint，模型常驻后单张约 55-65 秒；
  首张或模型冷启动含载入时间（外置盘约 1-2 分钟）。批量不要开其它大内存应用。
- **内存不足（swap 变慢）**：已默认 768×1024 + 18/16 步；再慢可降到 704×1024
  或把步数再降 2-4，不要改回 832×1216（实测单张 15+ 分钟）
- **脸型不稳**：把 img2img 的 denoise 调低（0.5-0.6），或换同一 checkpoint 重出 logo
