#!/usr/bin/env python3
"""Generate Dividend Dashboard sprite assets on Evans ComfyUI (Z-Image Turbo).

Co-tenancy: runs the papercraft GPU guard before every submit; aborts on guard
failure. One 8-step 1024x1024 gen per asset, outputs copied into public/sprites.
"""
import json
import pathlib
import random
import shutil
import subprocess
import sys
import urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
SPRITES = REPO / "public" / "sprites"
WORKFLOW = pathlib.Path.home() / ".agents/skills/comfyui/workflows/z_image_turbo.json"
COMFY = str(pathlib.Path.home() / ".venvs/comfy-mcp/bin/comfy")
HOST, PORT = "192.168.5.168", 8188
GUARD = str(pathlib.Path.home() / ".agents/skills/comfyui/scripts/evans_gpu_guard.sh")

STYLE = (
    "Stardew Valley style pixel art sprite, 3/4 top-down RPG game view, crisp pixel edges, "
    "warm saturated palette, soft dark outlines, lighting from top-left, centered subject, "
    "flat solid magenta background, no text, no watermark, no drop shadow"
)

CROP_STAGE_TMPL = (
    "pixel art sprite sheet: five growth stages of a {crop} in one horizontal row, evenly "
    "spaced with equal cell sizes: 1 seeds freshly planted in a small soil mound, "
    "2 tiny sprouting ball with first leaves, 3 bigger leafy young plant, "
    "4 near-ready tall plant with buds, 5 mature harvest-ready {mature}. "
)

ASSETS = [
    ("house-cabin", "a small wooden starter farmhouse cottage: brown plank walls, steep thatched roof, stone chimney, two small windows with red flower boxes, wooden door with stone step. " + STYLE),
    ("house-barn", "a medium red barn farmhouse: dark shingled roof, hayloft door above double doors, white-trimmed windows with red flower boxes, stone chimney. " + STYLE),
    ("house-manor", "a large two-story manor farmhouse: cream plaster walls with timber frame, steep red tile roof, dormer windows, stone chimney. " + STYLE),
    ("tree-oak", "one tall oak tree: wide lobed leafy canopy in three tones of green with dappled highlights, thick brown trunk with root flare. " + STYLE),
    ("crop-wheat", CROP_STAGE_TMPL.format(crop="wheat crop", mature="golden drooping wheat heads") + STYLE),
    ("crop-carrot", CROP_STAGE_TMPL.format(crop="carrot crop", mature="feathery green carrot tops with orange root visible at the soil line") + STYLE),
    ("crop-pumpkin", CROP_STAGE_TMPL.format(crop="pumpkin crop", mature="leafy vine with one large ridged orange pumpkin and curly tendril") + STYLE),
    ("crop-tomato", CROP_STAGE_TMPL.format(crop="tomato plant", mature="leafy stems with clusters of red tomatoes") + STYLE),
    ("crop-corn", CROP_STAGE_TMPL.format(crop="corn crop", mature="tall corn stalks with yellow cobs and green husks") + STYLE),
    ("crop-potato", CROP_STAGE_TMPL.format(crop="potato plant", mature="leafy green mound with small purple flowers") + STYLE),
    ("crop-berry", CROP_STAGE_TMPL.format(crop="berry bush", mature="canes with clusters of purple berries") + STYLE),
    ("crop-tulip", CROP_STAGE_TMPL.format(crop="tulip", mature="pink tulip blooms with long green leaves") + STYLE),
    ("props-sheet", "pixel art sprite sheet, exactly 4 columns by 2 rows on flat magenta background: row 1: a scarecrow on a wooden post, a round golden haystack, a pile of cut logs, a wooden water trough; row 2: a white chicken standing, a white chicken pecking at the ground, a small flowering green bush, a grey boulder. " + STYLE),
    ("animals-sheet", "pixel art sprite sheet, exactly 4 columns by 2 rows on flat magenta background, the SAME consistent farmer character design in every cell: row 1: a pink farm pig standing, a pink farm pig rooting its snout into the ground, a brown and white dairy cow standing, a brown and white dairy cow grazing with head down; row 2: the same Harvest Moon style farmer with straw hat and blue overalls in all four frames: standing facing forward, walking with one leg forward, walking with the other leg forward, bending to tend crops with a hoe. keep every character fully inside its own cell with clear gaps between cells. " + STYLE),
    ("ground-grass", "seamless tileable Stardew Valley style pixel art grass field ground texture, strict top-down view, extremely dense fine 16-bit grass detail: individual small blades in four tones of green, irregular clumps and tufts, subtle organic tone drift across the tile, a few tiny lighter highlight blades, no flowers, no props, no path, no objects, even flat lighting, full-frame texture only, edge-to-edge grass"),
    ("actions-sheet", "pixel art sprite sheet, exactly 4 columns by 2 rows on flat magenta background, the same Harvest Moon style farmer with straw hat and blue overalls in every cell: row 1: farmer watering crops with a watering can tilted, water pouring out; farmer watering with the can in a slightly different position; farmer bending down harvesting a crop; farmer bending down harvesting in a slightly different position. row 2: farmer scattering seeds with arm out; farmer scattering seeds in a slightly different position; a white butterfly with wings open; a white butterfly with wings closed. keep every sprite fully inside its own cell with clear gaps. " + STYLE),
    ("props2-sheet", "pixel art sprite sheet, exactly 4 columns by 2 rows on flat magenta background: row 1: a stone water well with wooden roof; a wooden chicken coop with ramp; a red mailbox on a wooden post with raised flag; wooden crates and hessian sacks. row 2: four frames of the same wooden windmill with rotating blades at 0 degrees, 45 degrees, 90 degrees, 135 degrees, tower centered and identical in every frame. keep every sprite fully inside its own cell with clear gaps. " + STYLE),
    ("trees2-sheet", "pixel art sprite sheet, exactly 4 columns by 2 rows on flat magenta background, every sprite small enough to sit fully inside its own cell with wide clear magenta gaps between cells: row 1: a pink cherry blossom tree; a tall green pine tree; an apple tree with red apples; a broad green elm tree. row 2: a tulip flower bed; a mixed colorful flower bed; a wooden hay cart with wheels; a stack of wooden crates. nothing crosses cell boundaries. " + STYLE),
    ("sleep-sheet", "pixel art sprite sheet, exactly 4 columns by 2 rows on flat magenta background: row 1: a brown and white dairy cow lying down asleep with eyes closed; a white chicken sleeping with head tucked down; a white duck sleeping with beak tucked into its wing; a tabby cat curled up in a ball asleep. row 2: a friendly brown farm dog standing facing forward; the same brown farm dog mid-stride walking; a black metal lantern on a wooden post with a warm candle flame; the Harvest Moon style farmer with straw hat and blue overalls walking with a red umbrella held up. keep every sprite fully inside its own cell with clear gaps. " + STYLE),
    ("animals2-sheet", "pixel art sprite sheet, exactly 4 columns by 2 rows on flat magenta background: row 1: a white duck swimming; a white duck flapping its wings; a tabby cat sitting; a tabby cat walking. row 2: a brown horse standing; a brown horse grazing with head down; a grey goat standing; a brown rabbit with long ears. keep every sprite fully inside its own cell with clear gaps. " + STYLE),
    ("ground-path", "seamless tileable Stardew Valley style pixel art dirt path ground texture, strict top-down view, extremely dense 16-bit packed earth detail: small stones and pebbles, darker trampled center band, slightly lighter worn edges, fine grain speckle, no grass border, no objects, even flat lighting, full-frame texture only, edge-to-edge dirt"),
]


QWEN_TEMPLATE: dict = {
    "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "qwen_image_2.1_int8_convrot.safetensors", "weight_dtype": "default"}},
    "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_8b_int8_convrot.safetensors", "type": "qwen_image", "device": "default"}},
    "3": {"class_type": "TextEncodeQwenImage21", "inputs": {"clip": ["2", 0], "prompt": "", "negative_prompt": "", "resolution": 1024}},
    "4": {"class_type": "KSampler", "inputs": {"seed": 42, "steps": 24, "cfg": 3.5, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0, "model": ["1", 0], "positive": ["3", 0], "negative": ["3", 1], "latent_image": ["3", 2]}},
    "5": {"class_type": "VAEDecode", "inputs": {"samples": ["4", 0], "vae": ["6", 0]}},
    "6": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"}},
    "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "dd_qwen", "images": ["5", 0]}},
}


def guard() -> bool:
    r = subprocess.run(["bash", GUARD, "--warn"], capture_output=True, text=True)
    ok = r.returncode == 0
    if not ok:
        print(f"[guard] exit {r.returncode}: {r.stdout.strip()} {r.stderr.strip()}", flush=True)
    return ok


def comfy_history(prompt_id: str) -> dict:
    with urllib.request.urlopen(f"http://{HOST}:{PORT}/history/{prompt_id}", timeout=30) as res:
        return json.load(res)


def outputs_for(prompt_id: str) -> list[str]:
    hist = comfy_history(prompt_id).get(prompt_id, {})
    names = []
    for item in hist.get("outputs", {}).values():
        for img in item.get("images", []):
            names.append(img.get("filename", ""))
    return [n for n in names if n]


def main() -> None:
    SPRITES.mkdir(parents=True, exist_ok=True)
    args = sys.argv[1:]
    engine_qwen = "--qwen" in args
    args = [a for a in args if a != "--qwen"]
    only = args or None
    tmpl = QWEN_TEMPLATE if engine_qwen else json.loads(WORKFLOW.read_text())
    results = {}
    for name, prompt in ASSETS:
        if only and name not in only:
            continue
        if not guard():
            sys.exit(1)
        wf = json.loads(json.dumps(tmpl))
        if engine_qwen:
            wf["3"]["inputs"]["prompt"] = prompt
            wf["4"]["inputs"]["seed"] = random.randint(1, 2**31 - 1)
            wf["7"]["inputs"]["filename_prefix"] = f"dd_{name}"
        else:
            wf["4"]["inputs"]["text"] = prompt
            wf["8"]["inputs"]["seed"] = random.randint(1, 2**31 - 1)
            wf["10"]["inputs"]["filename_prefix"] = f"dd_{name}"
        tmp = SPRITES / f".wf_{name}.json"
        tmp.write_text(json.dumps(wf))
        print(f"[gen:{ 'qwen' if engine_qwen else 'zimage' }] {name}: submitting", flush=True)
        run = subprocess.run(
            [COMFY, "--json", "run", "--workflow", str(tmp), "--host", HOST, "--port", str(PORT), "--wait"],
            capture_output=True, text=True, timeout=900,
        )
        tmp.unlink(missing_ok=True)
        if run.returncode != 0:
            print(f"[gen] {name}: FAILED\n{run.stdout[-400:]}\n{run.stderr[-400:]}", flush=True)
            results[name] = "failed"
            continue
        prompt_id = None
        for line in run.stdout.splitlines():
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                prompt_id = obj.get("prompt_id") or obj.get("promptId") or (obj.get("prompt") or [None, None, None])[1] if isinstance(obj.get("prompt"), list) else obj.get("prompt_id") or obj.get("promptId")
                if isinstance(prompt_id, list):
                    prompt_id = prompt_id[1]
        if not prompt_id:
            m = None
            for line in run.stdout.splitlines():
                if '"prompt_id"' in line or "prompt_id" in line:
                    import re
                    m = re.search(r'"prompt_id"\s*:\s*"([^"]+)"', line)
                    if m:
                        prompt_id = m.group(1)
        if not prompt_id:
            print(f"[gen] {name}: no prompt_id in output:\n{run.stdout[-600:]}", flush=True)
            results[name] = "no-id"
            continue
        names = outputs_for(prompt_id)
        if not names:
            print(f"[gen] {name}: no outputs for {prompt_id}", flush=True)
            results[name] = "no-output"
            continue
        url = f"http://{HOST}:{PORT}/view?filename={urllib.request.quote(names[0])}&type=output"
        raw_dir = REPO / "tools" / "raw"
        raw_dir.mkdir(parents=True, exist_ok=True)
        dest = raw_dir / f"{name}.png"
        with urllib.request.urlopen(url, timeout=60) as res, open(dest, "wb") as fh:
            shutil.copyfileobj(res, fh)
        print(f"[gen] {name}: OK -> {dest} ({dest.stat().st_size} bytes)", flush=True)
        results[name] = "ok"
    print("[gen] summary:", json.dumps(results), flush=True)


if __name__ == "__main__":
    main()
