/* 人物角色配置库 — 每个角色 = 形象提示词 + 表情变体 + 出图参数。
   编辑此文件后运行 `node comfyui/generate.mjs` 即可批量/单人生成。

   画风策略（2026-08 切换）：
   - 玉簪案（宋代中国）→ 中国国风动画 / 2.5D 游戏 CG 风
     checkpoint: 4Guofeng4XL_v12.safetensors（GuoFeng4 XL v1.2，18 步 / CFG 5.5 / dpmpp_2m karras）
   - Sterling / Midnight / 侦探 → 日本动漫 / 二次元游戏风
     checkpoint: animagineXL40_v4Opt.safetensors（Animagine XL 4.0 Opt，16 步 / CFG 5.0 /
     dpmpp_2m karras；官方推荐 DPM++ 2M SDE/beta 在本机 M3 上过慢，故用更快组合）
   两个模型都是 SDXL（ε-pred），标准 KSampler 即可，无需 v-pred 特殊处理。
   分辨率 768×1024（M3 18GB 全量 SDXL 内存吃紧，832×1216 会触发 swap、单张 15+ 分钟；
   768×1024 对 UI 插槽（头像/审问页肖像）完全够用）。 */

/* 负面提示词：禁写实、禁真人照片、禁低质量；
   不再禁 cartoon/anime，也不再禁 3d render（GuoFeng4 本身就是 2.5D CG 游戏风）。 */
export const NEGATIVE = 'lowres, bad anatomy, bad hands, extra fingers, deformed hands, missing fingers, extra limbs, mutated, disfigured, blurry, jpeg artifacts, watermark, signature, text, logo, duplicate, cropped, out of frame, multiple people, photorealistic, realistic photo, photograph, film photography, 8k uhd, dslr, cinematic photo, live action, plastic skin';

/* 动画风正向风格标签：
   - 玉簪案：国风 2.5D 游戏插画（GuoFeng4 官方风格：2.5D、CG、游戏、建模质感）
   - 其余：Animagine XL 4.0 官方质量标签（masterpiece, best quality, very aesthetic, absurdres）+ 日式动漫扁平插画 */
const STYLE = {
  jade: 'masterpiece, best quality, guofeng Chinese ancient-style game character, 2.5D anime illustration, clean lineart, cel shading, vibrant elegant colors, detailed hanfu textile, game splash art, expressive eyes, charming and playful mood',
  sterling: 'masterpiece, best quality, very aesthetic, absurdres, anime style, 2D illustration, cel shading, clean lineart, vibrant flat colors, game character art, expressive eyes, dynamic composition',
  midnight: 'masterpiece, best quality, very aesthetic, absurdres, anime style, 1927 art deco noir, dramatic rim lighting, cel shading, clean lineart, moody atmospheric colors, game character art, expressive eyes',
  detective: 'masterpiece, best quality, very aesthetic, absurdres, anime style, 2D illustration, cel shading, clean lineart, vibrant flat colors, game character art, dramatic lighting, expressive eyes',
};

const SETTING = {
  jade: 'Song dynasty Chinese manor, lantern light, traditional architecture, soft warm glow',
  sterling: 'Blackwell Manor, modern English manor interior, cozy lamp light',
  midnight: '1927 luxury train compartment, art deco, noir, warm lamp light',
};

/* 模型别名表：key 是配置里写的推荐文件名，value 是模糊匹配关键词。
   生成器会先精确匹配，再按关键词在 ComfyUI 的 checkpoint 列表里模糊匹配，
   因此你从 Civitai 下载的文件名略有出入（如 v12_fp32）也能自动识别。 */
export const CHECKPOINT_ALIASES = {
  '4Guofeng4XL_v12.safetensors': ['guofeng4', 'guofeng', 'guofeng4xl'],
  'animagineXL40_v4Opt.safetensors': ['animagine'],
};

const N = (seed) => seed;

/* 快捷构造：desc 是角色固定形象，variant 是表情/机位/场景变化 */
const C = (c) => c;

export const characters = [
  /* ================= 玉簪案（宋代，国风动画 / 2.5D 游戏 CG，GuoFeng4 XL） ================= */
  C({
    id: 'zhao', caseId: 'jade-pavilion', name: '赵文远', role: '东家 · 受害者', gender: 'male',
    checkpoint: '4Guofeng4XL_v12.safetensors', steps: 18, cfg: 5.5, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.jade, setting: SETTING.jade,
    desc: 'A dignified 52-year-old Chinese silk merchant of the Song dynasty, round prosperous face, short dark beard, deep burgundy brocade robe with dark gold cloud patterns, jade hairpin in topknot, jade thumb ring, stern but composed',
    variants: ['logo', 'portrait'],
    logo: { seed: N(1001), prompt: 'head-and-shoulders formal portrait, centered, calm authoritative expression, plain dark backdrop' },
    portrait: { seed: N(1002), prompt: 'formal ancestral-style portrait seated in a memorial hall, incense smoke drifting, candlelight, dignified and composed' },
  }),
  C({
    id: 'shen', caseId: 'jade-pavilion', name: '沈月娥', role: '赵夫人 · 正室', gender: 'female',
    checkpoint: '4Guofeng4XL_v12.safetensors', steps: 18, cfg: 5.5, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.jade, setting: SETTING.jade,
    desc: 'A refined 50-year-old Chinese noblewoman of the Song dynasty, elegant mature face, gentle severe eyes, hair in a low bun with gold hairpins and jade comb, deep purple embroidered silk ruqun with cloud patterns, pearl earrings, dignified and reserved',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(1011), prompt: 'head-and-shoulders portrait, centered, composed, plain dark backdrop' },
    calm: { seed: N(1012), prompt: 'seated in a lantern-lit manor hall, hands folded, poised and watchful, soft warm light' },
    uneasy: { seed: N(1013), prompt: 'in the manor hall, lips pressed, eyes slightly averted, fingers gripping a silk handkerchief, tense, dimmer light' },
    cornered: { seed: N(1014), prompt: 'cornered and distressed, hand pressed to chest, face pale, eyes wide, lanterns flickering, dramatic shadows' },
  }),
  C({
    id: 'qian', caseId: 'jade-pavilion', name: '钱伯年', role: '锦绣堂账房 · 真凶', gender: 'male',
    checkpoint: '4Guofeng4XL_v12.safetensors', steps: 18, cfg: 5.5, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.jade, setting: SETTING.jade,
    desc: 'A shrewd 46-year-old Chinese accountant of the Song dynasty, thin narrow face, sharp calculating eyes, thin mustache and goatee, gray-blue cotton changshan robe, abacus hanging at his waist, ink-stained fingers, sly guarded demeanor',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(1021), prompt: 'head-and-shoulders portrait, forced polite smile, abacus visible, plain dark backdrop' },
    calm: { seed: N(1022), prompt: 'sitting at a ledger desk with abacus and paper scrolls, polite smile that does not reach his eyes, candlelight' },
    uneasy: { seed: N(1023), prompt: 'sweating slightly, eyes darting sideways, dabbing his forehead with a sleeve, ledger papers scattered, uneasy posture' },
    cornered: { seed: N(1024), prompt: 'backed against a bookshelf, defensive and shouting, ink brush clutched in hand, face flushed, harsh shadows' },
  }),
  C({
    id: 'caiwei', caseId: 'jade-pavilion', name: '赵采薇', role: '独女 · 爱唱戏', gender: 'female',
    checkpoint: '4Guofeng4XL_v12.safetensors', steps: 18, cfg: 5.5, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.jade, setting: SETTING.jade,
    desc: 'A spirited 20-year-old Chinese lady of the Song dynasty, bright youthful face, bold defiant eyes, hair in twin loops with peach blossom hairpins, pink embroidered silk dress with butterfly patterns, painted folding fan in hand, lively and headstrong',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(1031), prompt: 'head-and-shoulders portrait, cheerful but stubborn, fan in hand, plain dark backdrop' },
    calm: { seed: N(1032), prompt: 'standing in a moonlit garden beside a rockery, holding a fan, chin raised, cool daylight' },
    uneasy: { seed: N(1033), prompt: 'in the garden at dusk, looking over her shoulder, biting her lip, fan half-closed, nervous' },
    cornered: { seed: N(1034), prompt: 'tearful and defiant, shouting with clenched fists, fan dropped, dark night garden, rain starting' },
  }),
  C({
    id: 'zhoufu', caseId: 'jade-pavilion', name: '周福', role: '赵府管家', gender: 'male',
    checkpoint: '4Guofeng4XL_v12.safetensors', steps: 18, cfg: 5.5, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.jade, setting: SETTING.jade,
    desc: 'A loyal 58-year-old Chinese steward of the Song dynasty, weathered honest face, deep wrinkles, graying sideburns, gray hemp servant robe, cloth belt with a large key ring, humble stooped posture, worried kindly eyes',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(1041), prompt: 'head-and-shoulders portrait, worried frown, keys visible, plain dark backdrop' },
    calm: { seed: N(1042), prompt: 'standing by the manor gatehouse with keys and a ledger, respectful, uneasy politeness' },
    uneasy: { seed: N(1043), prompt: 'wringing his hands, glancing nervously at the study door, lantern light flickering' },
    cornered: { seed: N(1044), prompt: 'on his knees pleading, tears, keys fallen on the floor, torchlit night, desperate' },
  }),
  C({
    id: 'sun', caseId: 'jade-pavilion', name: '孙半仙', role: '走街郎中 · 旧相识', gender: 'male',
    checkpoint: '4Guofeng4XL_v12.safetensors', steps: 18, cfg: 5.5, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.jade, setting: SETTING.jade,
    desc: 'A roguish 60-year-old Chinese street doctor of the Song dynasty, wizened face, mischievous squinting eyes, long white beard, patched dark robe, straw hat on his back, medicine gourd at waist, herbal medicine box, sly folk-healer charm',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(1051), prompt: 'head-and-shoulders portrait, sly grin, gourd visible, plain dark backdrop' },
    calm: { seed: N(1052), prompt: 'at a bamboo medicine stall weighing herbs, talkative grin, warm afternoon light' },
    uneasy: { seed: N(1053), prompt: 'clutching his medicine box, eyes wide, stammering, sweating, dim alley' },
    cornered: { seed: N(1054), prompt: 'backed against a wall, medicine box spilled, frightened, pleading, harsh light' },
  }),

  /* ================= Sterling Affair（现代英伦庄园，日式动漫，Animagine XL 4.0） ================= */
  C({
    id: 'victor', caseId: 'sterling-affair', name: 'Victor Sterling', role: 'Victim · Tech Billionaire', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.sterling, setting: SETTING.sterling,
    desc: 'A powerful 55-year-old British tech billionaire, silver-gray hair swept back, chiseled weathered face, tailored charcoal three-piece suit, white shirt with black tie, signet ring, cold authoritative gaze',
    variants: ['logo', 'portrait'],
    logo: { seed: N(2001), prompt: 'head-and-shoulders portrait, centered, composed, dark study backdrop' },
    portrait: { seed: N(2002), prompt: 'formal portrait in a wood-paneled library, fireplace glow, composed and commanding' },
  }),
  C({
    id: 'evelyn', caseId: 'sterling-affair', name: 'Evelyn Sterling', role: 'Widow · Socialite', gender: 'female',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.sterling, setting: SETTING.sterling,
    desc: 'A poised 47-year-old British socialite, elegant mature face, icy blue eyes, perfect makeup, champagne silk evening dress, pearl necklace and drop earrings, immaculate blonde updo, ice-cool composure',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(2011), prompt: 'head-and-shoulders portrait, centered, composed, dark manor backdrop' },
    calm: { seed: N(2012), prompt: 'sitting in the east drawing room with a coffee cup, elegant posture, cold polite smile' },
    uneasy: { seed: N(2013), prompt: 'standing by a rain-streaked window, gripping a letter, eyes averted, tense jaw' },
    cornered: { seed: N(2014), prompt: 'pressed against a mantelpiece, pale and defensive, candlelight shaking, cornered' },
  }),
  C({
    id: 'marcus', caseId: 'sterling-affair', name: 'Marcus Chen', role: 'CFO · Business Partner', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.sterling, setting: SETTING.sterling,
    desc: 'A smooth 52-year-old Chinese-American CFO, slicked-back dark hair with gray temples, handsome but calculating face, tailored dark gray suit, gold wristwatch, confident polished smile, finance shark',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(2021), prompt: 'head-and-shoulders portrait, centered, polished smile, dark office backdrop' },
    calm: { seed: N(2022), prompt: 'standing in a grand library with ledgers, confident stance, hands clasped behind back' },
    uneasy: { seed: N(2023), prompt: 'loosening his tie, sweating, glancing at the door, papers scattered on a desk' },
    cornered: { seed: N(2024), prompt: 'backed against a bookshelf, shouting defensively, face flushed, harsh light' },
  }),
  C({
    id: 'sofia', caseId: 'sterling-affair', name: 'Sofia Reyes', role: 'Daughter · Musician', gender: 'female',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.sterling, setting: SETTING.sterling,
    desc: 'A rebellious 24-year-old Latina-American musician, dark wavy hair, smoky eyes, leather jacket over a band tee, silver chain necklace, guitar strap, defiant smirk, punk rock energy',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(2031), prompt: 'head-and-shoulders portrait, centered, defiant smirk, dim venue backdrop' },
    calm: { seed: N(2032), prompt: 'smoking on a manor terrace at dusk, arms crossed, blunt stare' },
    uneasy: { seed: N(2033), prompt: 'pacing a garden path, hugging herself, looking back at the house, nervous' },
    cornered: { seed: N(2034), prompt: 'cornered in a corridor, angry and tearful, pointing a finger, harsh shadows' },
  }),
  C({
    id: 'alan', caseId: 'sterling-affair', name: 'Dr. Alan Whitfield', role: 'Family Physician', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.sterling, setting: SETTING.sterling,
    desc: 'A weary 58-year-old British family physician, thinning gray hair, silver-rimmed glasses, rumpled tweed jacket over a waistcoat, loosened tie, tired warm eyes, gentle fidgety manner',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(2041), prompt: 'head-and-shoulders portrait, centered, tired kind smile, study backdrop' },
    calm: { seed: N(2042), prompt: 'sitting in a study holding a half-smoked cigarette, pensive, soft lamp light' },
    uneasy: { seed: N(2043), prompt: 'fidgeting with his glasses, sweating, glancing away, medical bag at his feet' },
    cornered: { seed: N(2044), prompt: 'standing in a doorway, pale and shaking, hands raised defensively, harsh light' },
  }),
  C({
    id: 'nora', caseId: 'sterling-affair', name: 'Nora Kim', role: 'Head Housekeeper', gender: 'female',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.sterling, setting: SETTING.sterling,
    desc: 'A precise 39-year-old Korean-British head housekeeper, sleek dark hair in a low bun, black dress uniform with white apron and a silver key pin, sharp observant eyes, professional reserved demeanor',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(2051), prompt: 'head-and-shoulders portrait, centered, composed, manor hallway backdrop' },
    calm: { seed: N(2052), prompt: 'standing in a grand hallway with a silver tray, upright and watchful' },
    uneasy: { seed: N(2053), prompt: 'in a corridor at night, glancing at a half-open door, clutching a locket, tense' },
    cornered: { seed: N(2054), prompt: 'backed against a wall, holding the locket to her chest, pale, defensive, dark' },
  }),

  /* ================= Midnight Meridian（1927 列车，动漫 noir，Animagine XL 4.0） ================= */
  C({
    id: 'aldous', caseId: 'midnight-meridian', name: 'Aldous Vance', role: 'Victim · Great Magician', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.midnight, setting: SETTING.midnight,
    desc: 'A theatrical 45-year-old stage magician of 1927, slicked dark hair with a sharp widow peak, waxed handlebar mustache, black tailcoat with red silk lining, silver-tipped cane, hypnotic confident eyes, spotlight glamour',
    variants: ['logo', 'portrait'],
    logo: { seed: N(3001), prompt: 'head-and-shoulders portrait, centered, composed, dark velvet backdrop' },
    portrait: { seed: N(3002), prompt: 'portrait in a train compartment, dramatic stage lighting, composed and grand' },
  }),
  C({
    id: 'sebastian', caseId: 'midnight-meridian', name: 'Sebastian Croft', role: 'Rival Magician · 真凶', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.midnight, setting: SETTING.midnight,
    desc: 'A charming 38-year-old rival magician of 1927, tousled dark hair, sharp angular face with a mocking smirk, black high-collar magician coat with a crimson cravat, playing card fanned in hand, theatrical wounded pride',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(3011), prompt: 'head-and-shoulders portrait, centered, cocky smirk, dark velvet backdrop' },
    calm: { seed: N(3012), prompt: 'in a train corridor doing a card flourish, confident grin, warm compartment light' },
    uneasy: { seed: N(3013), prompt: 'in a compartment, clutching a torn card, glancing at the door, sweating, dim light' },
    cornered: { seed: N(3014), prompt: 'backed against a train window, furious and cornered, cards scattered, harsh shadows' },
  }),
  C({
    id: 'vivienne', caseId: 'midnight-meridian', name: 'Vivienne Vance', role: 'Stage Partner · Widow', gender: 'female',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.midnight, setting: SETTING.midnight,
    desc: 'A magnetic 41-year-old stage star of 1927, porcelain face with ruby lips, dark bobbed hair with a jeweled headband, emerald velvet gown with a feather stole, long pearl strands, enigmatic stage smile',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(3021), prompt: 'head-and-shoulders portrait, centered, enigmatic smile, dark velvet backdrop' },
    calm: { seed: N(3022), prompt: 'in a compartment adjusting her gloves, poised like on stage, art deco mirror light' },
    uneasy: { seed: N(3023), prompt: 'in a corridor, touching her collarbone, looking away, silk handkerchief in hand, nervous' },
    cornered: { seed: N(3024), prompt: 'cornered against a compartment door, pale, forced smile, dramatic shadows' },
  }),
  C({
    id: 'henri', caseId: 'midnight-meridian', name: 'Henri Beaumont', role: 'Financier · Patron', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.midnight, setting: SETTING.midnight,
    desc: 'A blustering 55-year-old financier of 1927, ruddy face with silver sideburns, heavy three-piece suit with a watch chain, gold pocket watch, cigar, overbearing entitled demeanor',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(3031), prompt: 'head-and-shoulders portrait, centered, smug scowl, dark club backdrop' },
    calm: { seed: N(3032), prompt: 'in a compartment with a brandy glass, puffed chest, condescending grin' },
    uneasy: { seed: N(3033), prompt: 'adjusting his tie nervously, cigar smoke, glancing at papers, tense' },
    cornered: { seed: N(3034), prompt: 'red-faced and shouting, pointing a finger, papers crumpled, harsh light' },
  }),
  C({
    id: 'maggie', caseId: 'midnight-meridian', name: 'Maggie Vance', role: 'Tabloid Journalist', gender: 'female',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.midnight, setting: SETTING.midnight,
    desc: 'A sharp 44-year-old tabloid journalist of 1927, sleek bob under a newsboy cap, belted trench coat, cigarette in hand, hard knowing eyes, notebook and pencil, cynical smirk',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(3041), prompt: 'head-and-shoulders portrait, centered, cynical smirk, smoky backdrop' },
    calm: { seed: N(3042), prompt: 'in the smoking lounge writing in a notebook, cigarette smoke curling, sharp gaze' },
    uneasy: { seed: N(3043), prompt: 'hiding a photograph behind her back, glancing sideways, tense, dim lounge' },
    cornered: { seed: N(3044), prompt: 'cornered against a window, notebook clutched, defiant and pale, harsh light' },
  }),
  C({
    id: 'amos', caseId: 'midnight-meridian', name: 'Amos Grey', role: 'Conductor', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.midnight, setting: SETTING.midnight,
    desc: 'A weary 49-year-old train conductor of 1927, weathered kind face with a thick mustache, dark blue uniform with brass buttons and gold stripes, pocket watch on a chain, ticket punch, tired honest eyes',
    variants: ['logo', 'calm', 'uneasy', 'cornered'],
    logo: { seed: N(3051), prompt: 'head-and-shoulders portrait, centered, weary honesty, dark train backdrop' },
    calm: { seed: N(3052), prompt: 'punching tickets in a corridor, upright and methodical, warm lamp light' },
    uneasy: { seed: N(3053), prompt: 'polishing his ticket punch with his thumb, glancing at a compartment door, uneasy' },
    cornered: { seed: N(3054), prompt: 'backed against the train door, ticket punch fallen, pale and shaken, harsh light' },
  }),

  /* ================= 侦探（玩家化身，原创形象，动漫风，Animagine XL 4.0） ================= */
  C({
    id: 'sherlock', caseId: 'detective', name: 'Sherlock 福尔摩斯风', role: '英伦名侦探', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.detective, setting: 'late-1800s London, foggy gaslit streets',
    desc: 'A brilliant English consulting detective, sharp hawk-like features, piercing blue eyes, deerstalker cap and long woolen cape, briar pipe, intense analytical gaze, intellectual intensity',
    variants: ['logo', 'portrait'],
    logo: { seed: N(4001), prompt: 'head-and-shoulders portrait, centered, intense gaze, foggy London backdrop' },
    portrait: { seed: N(4002), prompt: 'full three-quarter portrait beside a desk with a magnifying glass and case files, dramatic lamplight' },
  }),
  C({
    id: 'di_renjie', caseId: 'detective', name: '狄仁杰风', role: '大唐神探', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.detective, setting: 'Tang dynasty imperial court, grand hall, silk banners',
    desc: 'A majestic Tang dynasty Chinese magistrate, crimson official robe with gold roundels, black putou headdress, long dark beard, jade tablet in hand, wise stern presence, imperial court bearing',
    variants: ['logo', 'portrait'],
    logo: { seed: N(4011), prompt: 'head-and-shoulders portrait, centered, wise stern gaze, court backdrop' },
    portrait: { seed: N(4012), prompt: 'standing in a court hall holding a jade tablet, silk robes flowing, dramatic light' },
  }),
  C({
    id: 'boy_detective', caseId: 'detective', name: '少年名侦探', role: '少年侦探（原创）', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.detective, setting: 'modern Japanese city street, neon and rain',
    desc: 'An original young genius detective boy, spiky black hair, large round glasses, confident smirk, blue tailored blazer with shorts and a red bow tie, mystery novel vibe, energetic and clever',
    variants: ['logo', 'portrait'],
    logo: { seed: N(4021), prompt: 'head-and-shoulders portrait, centered, confident smirk, city backdrop' },
    portrait: { seed: N(4022), prompt: 'pointing forward confidently with a magnifying glass, dynamic pose, rainy neon street' },
  }),
  C({
    id: 'japanese_gentleman', caseId: 'detective', name: '和风绅士侦探', role: '名侦探（原创）', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.detective, setting: 'Taisho-era Tokyo, paper lanterns, elegant study',
    desc: 'An elegant Japanese gentleman detective, slicked hair, high-collar dark coat, monocle, faint enigmatic smile, Taisho-era Tokyo, soft dramatic light, refined mysterious aura',
    variants: ['logo', 'portrait'],
    logo: { seed: N(4031), prompt: 'head-and-shoulders portrait, centered, enigmatic smile, lantern backdrop' },
    portrait: { seed: N(4032), prompt: 'seated in an elegant study with a cup of tea and case notes, soft window light' },
  }),
  C({
    id: 'japanese_student', caseId: 'detective', name: '大学生名侦探', role: '名探（原创）', gender: 'male',
    checkpoint: 'animagineXL40_v4Opt.safetensors', steps: 16, cfg: 5.0, sampler: 'dpmpp_2m', scheduler: 'karras',
    width: 768, height: 1024, style: STYLE.detective, setting: 'rainy Japanese university town, dim alleys',
    desc: 'A sharp university-student detective, wavy dark hair, intense thoughtful eyes, dark student uniform with a high collar, holding a notebook, rainy Tokyo street, earnest and brilliant',
    variants: ['logo', 'portrait'],
    logo: { seed: N(4041), prompt: 'head-and-shoulders portrait, centered, thoughtful gaze, rainy backdrop' },
    portrait: { seed: N(4042), prompt: 'standing under an umbrella with a notebook, deep in thought, rainy street lamps' },
  }),
];

export function buildPrompt(char, variant) {
  const v = char[variant] || { prompt: 'head-and-shoulders portrait, centered, plain backdrop' };
  return `${char.desc}, ${v.prompt}, ${char.setting}, ${char.style}`;
}
