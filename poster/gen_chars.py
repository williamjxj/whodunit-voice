#!/usr/bin/env python3
"""Generate noir character portraits for the 玉簪案 (Jade Hairpin Affair) cast
via the local ComfyUI API. Reuses the poster workflow (Mode A direct).

Each character gets a deterministic seed (hash of id) so reruns are reproducible.
Pass a list of character ids as argv; default = all.
"""
import json, sys, time, urllib.request, urllib.parse

BASE = "http://localhost:8188"
CKPT = "juggernautXL_ragnarokBy.safetensors"
OUTDIR = "poster/chars"

# Shared style: film noir + Southern Song dynasty, B&W with warm amber (matches poster)
STYLE = (
    "film noir character portrait, Southern Song dynasty China circa 1200, "
    "silk merchant mansion in Lin'an, chiaroscuro lighting, deep black shadows, "
    "mostly black and white with warm amber candlelight rim lighting, "
    "cinematic, photorealistic, highly detailed, dramatic moody atmosphere"
)
NEGATIVE = (
    "text, letters, words, watermark, signature, logo, multiple people, two people, "
    "cartoon, illustration, painting, color photo, oversaturated, low quality, blurry, "
    "deformed hands, extra fingers, bad anatomy, jpeg artifacts"
)

CHARS = {
    # 被害人：赵文远 锦绣堂东家
    "zhao_wenyuan": (
        "portrait of a shrewd 54-year-old Chinese silk merchant magnate, "
        "Song dynasty dark embroidered round-collar robe (panling) with subtle woven silk patterns, "
        "round black silk hat, thin scholarly mustache, stern calculating eyes, "
        "one hand resting on a bronze abacus on a dark wooden desk piled with account ledgers, "
        "warm amber oil lamp glow from the side, ominous deep shadows closing in around him, "
        + STYLE
    ),
    # 夫人：沈月娥 端庄持重，紧张时用帕子擦杯沿
    "shen_yuee": (
        "portrait of a dignified 50-year-old Chinese noblewoman, matriarch of a wealthy Song dynasty household, "
        "hair in a neat black bun with silver hairpins, elegant dark patterned high-collar robe, jade earrings, "
        "composed stern face, dabbing a silk handkerchief at the corner of her lips, "
        "seated in a dim mansion hall, half her face swallowed by shadow, warm amber lantern light, "
        + STYLE
    ),
    # 真凶：钱伯年 账房，偷看更漏，算盘
    "qian_bonian": (
        "portrait of a sly 46-year-old Chinese accountant, thin wiry build, "
        "plain dark Song dynasty robe, oiled black hair, squinting calculating eyes, "
        "slight nervous sweat on his forehead, ink-stained fingers resting on an abacus, "
        "a bronze water clock (clepsydra) ticking in the dark background, "
        "dim study lit by a single candle, guilty tense atmosphere, "
        + STYLE
    ),
    # 女儿：赵采薇 爱唱戏，玉簪，倔强
    "zhao_caiwei": (
        "portrait of a beautiful headstrong 20-year-old Chinese young lady of a Song dynasty merchant family, "
        "jade hairpin in her black hair, subtle opera rouge on her cheeks, "
        "defiant stubborn expression with slightly teary eyes, holding a folded opera fan, "
        "elegant patterned robe, standing in a moonlit garden at night, "
        "pale moonlight mixing with warm lantern glow, bamboo noir shadows, "
        + STYLE
    ),
    # 管家：周福 提灯，钥匙
    "zhou_fu": (
        "portrait of an anxious elderly 58-year-old Chinese steward, "
        "worn plain grey Song dynasty robe, gray hair and gray goatee, worried timid face, slight stoop, "
        "holding a brass lantern, iron keys hanging from his waist sash, "
        "standing in a dark courtyard corridor at night, warm lantern glow, deep noir shadows, "
        + STYLE
    ),
    # 郎中：孙半仙 药箱葫芦
    "sun_banxian": (
        "portrait of a scruffy 60-year-old Chinese itinerant quack doctor, "
        "faded traveling robe with wide sleeves, wispy white beard, thin sly eyes, half-toothed grin, "
        "carrying a cloth medicine satchel and a gourd medicine bottle on a shoulder strap, "
        "leaning against a wooden doorframe in a dim alley at night, candlelight from a nearby window, "
        + STYLE
    ),
}


def workflow(seed, positive):
    return {
        "3": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": 28, "cfg": 6.5, "sampler_name": "dpmpp_2m",
            "scheduler": "karras", "denoise": 1.0,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1360, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "char_noir", "images": ["8", 0]}},
    }


def post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))


def get(path):
    return json.load(urllib.request.urlopen(BASE + path, timeout=30))


def run(char_id, seed):
    import os
    os.makedirs(OUTDIR, exist_ok=True)
    outpath = f"{OUTDIR}/{char_id}_{seed}.png"
    pid = post("/prompt", {"prompt": workflow(seed, CHARS[char_id][0]), "client_id": "char-gen"})["prompt_id"]
    print(f"[{char_id}] seed={seed} prompt_id={pid}", flush=True)
    for _ in range(240):
        time.sleep(2)
        try:
            h = get(f"/history/{pid}")
        except Exception:
            continue
        if pid in h:
            for node_id, o in h[pid]["outputs"].items():
                for img in o.get("images", []):
                    q = urllib.parse.urlencode(img)
                    data = urllib.request.urlopen(f"{BASE}/view?{q}", timeout=60).read()
                    with open(outpath, "wb") as f:
                        f.write(data)
                    print(f"saved {outpath} ({len(data)} bytes)", flush=True)
            return True
    print(f"TIMEOUT {char_id}")
    return False


if __name__ == "__main__":
    ids = sys.argv[1:] or list(CHARS.keys())
    print("system_stats:", json.load(urllib.request.urlopen(BASE + "/system_stats", timeout=10))
          .get("system", {}).get("comfyui_version", "?"))
    for cid in ids:
        if cid not in CHARS:
            print(f"unknown char: {cid}; available: {list(CHARS.keys())}")
            continue
        seed = int.from_bytes(json.dumps(cid).encode(), "big") % (2**31)  # deterministic per character
        run(cid, seed)
