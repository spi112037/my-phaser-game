"""
ComfyUI one-click anime image generator.

Usage:
  python generate_image.py --prompt "catgirl knight"

Requirements:
  pip install requests
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import random
import shutil
import sys
import time
from typing import Dict, List

import requests


COMFY_API_BASE = os.environ.get("COMFY_API_BASE", "http://127.0.0.1:8188").rstrip("/")
OUTPUT_DIR = os.path.join(".", "outputs")

DEFAULT_STYLE_PREFIX = (
    "anime style, masterpiece, best quality, detailed face, clean lineart, "
    "soft lighting, cinematic, high detail"
)
DEFAULT_NEGATIVE = "lowres, blurry, bad anatomy, watermark, text, logo, extra fingers, deformed"

STYLE_PRESETS = {
    "bright": {
        "prefix": (
            "bright anime card art, masterpiece, best quality, vibrant colors, "
            "clean lineart, soft daylight, cheerful fantasy, high detail"
        ),
        "negative_extra": "dark, gloomy, horror, low key lighting, monochrome, heavy shadow",
    },
    "neutral": {
        "prefix": (
            "anime style, masterpiece, best quality, detailed face, clean lineart, "
            "soft lighting, high detail"
        ),
        "negative_extra": "",
    },
    "dark": {
        "prefix": DEFAULT_STYLE_PREFIX,
        "negative_extra": "",
    },
}

DEFAULT_STEPS = 25
DEFAULT_CFG = 7.0
DEFAULT_SAMPLER = "euler"
DEFAULT_WIDTH = 768
DEFAULT_HEIGHT = 1152
DEFAULT_STYLE_MODE = "bright"
DEFAULT_DENOISE_REF = 0.68
PREFERRED_CKPT_KEYWORDS = [
    "animagine",
    "anime",
    "anything",
]

REQUEST_TIMEOUT = 35
POLL_INTERVAL_SEC = 1.2
POLL_TIMEOUT_SEC = 300


def configure_stdio() -> None:
    """Force UTF-8 safe output on Windows terminals."""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if not stream:
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # py3.7+
        except Exception:
            pass


def safe_print(*args) -> None:
    text = " ".join(str(x) for x in args)
    try:
        print(text)
    except UnicodeEncodeError:
        encoded = text.encode("utf-8", errors="replace").decode("utf-8", errors="replace")
        print(encoded)


def ensure_output_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def resolve_style_preset(style_mode: str) -> Dict[str, str]:
    key = (style_mode or DEFAULT_STYLE_MODE).strip().lower()
    return STYLE_PRESETS.get(key, STYLE_PRESETS[DEFAULT_STYLE_MODE])


def build_positive_prompt(user_prompt: str, style_mode: str) -> str:
    preset = resolve_style_preset(style_mode)
    style_prefix = str(preset.get("prefix") or DEFAULT_STYLE_PREFIX)
    user_prompt = (user_prompt or "").strip()
    if not user_prompt:
        return style_prefix
    return f"{style_prefix}, {user_prompt}"


def build_negative_prompt(style_mode: str) -> str:
    preset = resolve_style_preset(style_mode)
    extra = str(preset.get("negative_extra") or "").strip()
    if not extra:
        return DEFAULT_NEGATIVE
    return f"{DEFAULT_NEGATIVE}, {extra}"


def request_json(method: str, url: str, **kwargs) -> Dict:
    try:
        resp = requests.request(method, url, timeout=REQUEST_TIMEOUT, **kwargs)
        resp.raise_for_status()
        return resp.json() if resp.text else {}
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(f"Cannot connect to ComfyUI API at {COMFY_API_BASE}") from exc
    except requests.exceptions.HTTPError as exc:
        detail = ""
        try:
            detail = json.dumps(resp.json(), ensure_ascii=False)
        except Exception:
            detail = resp.text
        raise RuntimeError(f"ComfyUI HTTP error: {exc}\n{detail}") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"ComfyUI request failed: {exc}") from exc


def check_comfy_online() -> None:
    request_json("GET", f"{COMFY_API_BASE}/object_info")


def choose_checkpoint_name() -> str:
    object_info = request_json("GET", f"{COMFY_API_BASE}/object_info")
    node_info = object_info.get("CheckpointLoaderSimple", {})
    required = node_info.get("input", {}).get("required", {})
    ckpt_candidates: List[str] = []

    if "ckpt_name" in required and isinstance(required["ckpt_name"], list) and required["ckpt_name"]:
        first_entry = required["ckpt_name"][0]
        if isinstance(first_entry, list):
            ckpt_candidates = [str(x) for x in first_entry]

    if not ckpt_candidates:
        raise RuntimeError("No checkpoint found in ComfyUI CheckpointLoaderSimple.")

    env_ckpt = os.environ.get("COMFY_CHECKPOINT", "").strip()
    if env_ckpt and env_ckpt in ckpt_candidates:
        return env_ckpt

    lowered = [(c, c.lower()) for c in ckpt_candidates]
    for kw in PREFERRED_CKPT_KEYWORDS:
        for c, lc in lowered:
            if kw in lc:
                return c

    return ckpt_candidates[0]


def prepare_style_reference(style_ref_path: str) -> str:
    src = os.path.abspath(str(style_ref_path or "").strip())
    if not src or not os.path.isfile(src):
        return ""
    input_dir = os.environ.get("COMFY_INPUT_DIR", "").strip()
    if not input_dir:
        return ""
    os.makedirs(input_dir, exist_ok=True)
    ext = os.path.splitext(src)[1].lower() or ".png"
    target_name = f"style_reference_auto{ext}"
    dst = os.path.join(input_dir, target_name)
    shutil.copyfile(src, dst)
    return target_name


def build_workflow(
    *,
    positive: str,
    negative: str,
    ckpt_name: str,
    seed: int,
    steps: int,
    cfg: float,
    sampler_name: str,
    width: int,
    height: int,
    style_ref_input_name: str,
    denoise_ref: float,
) -> Dict:
    if style_ref_input_name:
        return {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt_name}},
            "2": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["1", 1]}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
            "4": {"class_type": "LoadImage", "inputs": {"image": style_ref_input_name}},
            "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
            "6": {
                "class_type": "KSampler",
                "inputs": {
                    "model": ["1", 0],
                    "positive": ["2", 0],
                    "negative": ["3", 0],
                    "latent_image": ["5", 0],
                    "seed": int(seed),
                    "steps": int(steps),
                    "cfg": float(cfg),
                    "sampler_name": sampler_name,
                    "scheduler": "normal",
                    "denoise": float(denoise_ref),
                },
            },
            "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
            "8": {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": "api_gen"}},
        }

    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt_name}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "seed": int(seed),
                "steps": int(steps),
                "cfg": float(cfg),
                "sampler_name": sampler_name,
                "scheduler": "normal",
                "denoise": 1.0,
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "api_gen"}},
    }


def submit_prompt(workflow: Dict) -> str:
    payload = {"prompt": workflow}
    resp = request_json("POST", f"{COMFY_API_BASE}/prompt", json=payload)
    prompt_id = resp.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"ComfyUI returned no prompt_id: {resp}")
    return str(prompt_id)


def wait_for_history(prompt_id: str) -> Dict:
    deadline = time.time() + POLL_TIMEOUT_SEC
    history_url = f"{COMFY_API_BASE}/history/{prompt_id}"

    while time.time() < deadline:
        data = request_json("GET", history_url)
        item = data.get(prompt_id)
        if item:
            return item
        time.sleep(POLL_INTERVAL_SEC)

    raise RuntimeError(f"Timeout waiting history: {POLL_TIMEOUT_SEC}s, prompt_id={prompt_id}")


def extract_image_entries(history_item: Dict) -> List[Dict]:
    outputs = history_item.get("outputs", {})
    found: List[Dict] = []
    for node_id, node_output in outputs.items():
        images = node_output.get("images", [])
        for img in images:
            filename = img.get("filename")
            if not filename:
                continue
            found.append(
                {
                    "node_id": str(node_id),
                    "filename": str(filename),
                    "subfolder": str(img.get("subfolder", "")),
                    "type": str(img.get("type", "output")),
                }
            )
    return found


def download_image(entry: Dict, save_path: str) -> None:
    params = {
        "filename": entry["filename"],
        "subfolder": entry["subfolder"],
        "type": entry["type"],
    }
    try:
        r = requests.get(f"{COMFY_API_BASE}/view", params=params, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Download image failed: {exc}") from exc

    with open(save_path, "wb") as f:
        f.write(r.content)


def generate_one(user_prompt: str, style_mode: str, style_ref: str, denoise_ref: float) -> List[str]:
    ensure_output_dir(OUTPUT_DIR)
    check_comfy_online()

    positive = build_positive_prompt(user_prompt, style_mode)
    negative = build_negative_prompt(style_mode)
    ckpt_name = choose_checkpoint_name()
    seed = random.randint(1, 2_147_483_647)
    style_ref_input_name = prepare_style_reference(style_ref)

    workflow = build_workflow(
        positive=positive,
        negative=negative,
        ckpt_name=ckpt_name,
        seed=seed,
        steps=DEFAULT_STEPS,
        cfg=DEFAULT_CFG,
        sampler_name=DEFAULT_SAMPLER,
        width=DEFAULT_WIDTH,
        height=DEFAULT_HEIGHT,
        style_ref_input_name=style_ref_input_name,
        denoise_ref=denoise_ref,
    )

    prompt_id = submit_prompt(workflow)
    history_item = wait_for_history(prompt_id)
    images = extract_image_entries(history_item)
    if not images:
        raise RuntimeError("No images returned in ComfyUI history outputs.")

    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    saved_paths: List[str] = []
    for idx, entry in enumerate(images, start=1):
        out_name = f"anime_{timestamp}_{idx}.png"
        out_path = os.path.abspath(os.path.join(OUTPUT_DIR, out_name))
        download_image(entry, out_path)
        saved_paths.append(out_path)

    safe_print("Generation OK")
    safe_print(f"Prompt ID: {prompt_id}")
    safe_print(f"Checkpoint: {ckpt_name}")
    safe_print(f"Seed: {seed}")
    safe_print(f"Style mode: {style_mode}")
    if style_ref_input_name:
        safe_print(f"Style reference: {style_ref_input_name}")
    safe_print("Saved files:")
    for p in saved_paths:
        safe_print(f"- {p}")
    return saved_paths


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local one-click anime generation via ComfyUI API")
    parser.add_argument("--prompt", type=str, default="", help="Prompt text. If empty, ask interactively.")
    parser.add_argument("--style-mode", type=str, default=DEFAULT_STYLE_MODE, choices=["bright", "neutral", "dark"])
    parser.add_argument("--style-ref", type=str, default="", help="Local image path used as style base.")
    parser.add_argument("--denoise-ref", type=float, default=DEFAULT_DENOISE_REF, help="Img2img denoise when style ref is used.")
    return parser.parse_args()


def main() -> int:
    configure_stdio()
    args = parse_args()
    user_prompt = args.prompt.strip()
    if not user_prompt:
        user_prompt = input("Please enter prompt (ZH/EN): ").strip()

    if not user_prompt:
        safe_print("Prompt is empty.")
        return 1

    try:
        denoise_ref = max(0.15, min(0.9, float(args.denoise_ref)))
        generate_one(user_prompt, args.style_mode, args.style_ref, denoise_ref)
        return 0
    except Exception as exc:
        safe_print("Generation failed:")
        safe_print(exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
