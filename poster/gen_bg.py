#!/usr/bin/env python3
"""Generate noir poster backgrounds via the local ComfyUI API (Mode A direct)."""
import json, sys, time, urllib.request, urllib.parse

BASE = "http://localhost:8188"
POSITIVE = (
    "film noir detective murder mystery, moody atmospheric scene inside a dim study at night, "
    "rain-streaked window with blurred city lights, vintage wooden desk covered with yellowed "
    "case files and photographs, brass magnifying glass resting on a crime scene photo, "
    "antique bronze Chinese wine flask and a small oil lantern casting warm amber glow, "
    "wisps of cigarette smoke curling through a shaft of pale light, venetian blind shadows "
    "on the wall, deep black shadows, high contrast chiaroscuro lighting, mostly black and "
    "white with warm amber highlights, cinematic composition, large dark negative space at "
    "top and bottom of the frame, photorealistic, highly detailed"
)
NEGATIVE = (
    "text, letters, words, watermark, signature, logo, people, person, face, hands, "
    "color, oversaturated, cartoon, illustration, low quality, blurry, jpeg artifacts"
)
CKPT = "juggernautXL_ragnarokBy.safetensors"

def workflow(seed):
    return {
        "3": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": 28, "cfg": 6.5, "sampler_name": "dpmpp_2m",
            "scheduler": "karras", "denoise": 1.0,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1360, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": POSITIVE, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "poster_noir", "images": ["8", 0]}},
    }

def post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))

def get(path):
    return json.load(urllib.request.urlopen(BASE + path, timeout=30))

def run(seed, outpath):
    pid = post("/prompt", {"prompt": workflow(seed), "client_id": "poster-gen"})["prompt_id"]
    print(f"seed={seed} prompt_id={pid}", flush=True)
    for _ in range(180):
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
                    print(f"saved {outpath} ({len(data)} bytes)")
            return True
    print(f"TIMEOUT seed={seed}")
    return False

if __name__ == "__main__":
    seeds = [int(sys.argv[1]), int(sys.argv[2])]
    outs = [sys.argv[3], sys.argv[4]]
    print("system_stats:", json.load(urllib.request.urlopen(BASE + "/system_stats", timeout=10)).get("system", {}).get("comfyui_version", "?"))
    for s, o in zip(seeds, outs):
        run(s, o)
