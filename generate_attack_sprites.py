"""
Generate chibi attack sprite PNG sequence through ComfyUI API.

Target:
- Output PNG sequence to ./sprites
- Filenames: attack_0001.png, attack_0002.png, ...
- Works with AnimateDiff/video workflow (recommended)
- Keeps fallback mode for quick testing

Usage:
  python generate_attack_sprites.py --prompt "貓娘劍士揮劍攻擊"
  python generate_attack_sprites.py --prompt "elf archer shooting" --frames 16 --size 512
  python generate_attack_sprites.py --prompts-file ./prompts_attack.txt --workflow ./workflows/attack_anim_workflow.json

Dependencies:
  pip install requests
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import requests


# User-provided ComfyUI install locations.
COMFY_ROOT_CANDIDATES: List[str] = [
    r"D:\ComfyUI2\resources\ComfyUI",
    r"C:\Users\user\Documents\ComfyUI",
]

API_CANDIDATES: List[str] = [
    "http://127.0.0.1:8188",
    "http://127.0.0.1:8001",
]

DEFAULT_OUT_DIR = "./sprites"
DEFAULT_SIZE = 512
DEFAULT_FRAMES = 16
DEFAULT_STEPS = 25
DEFAULT_CFG = 7.0
DEFAULT_SAMPLER = "euler"
REQUEST_TIMEOUT = 40
POLL_INTERVAL_SEC = 1.2
POLL_TIMEOUT_SEC = 420

POSITIVE_BASE = (
    "chibi anime character, full body, battle pose, attack animation, "
    "clean lineart, cel shading, game sprite style, transparent background, "
    "centered character, consistent position, side view or 3/4 view, "
    "startup, strike, recovery motion, no camera movement"
)
NEGATIVE_BASE = (
    "background, scenery, ground, text, logo, watermark, blurry, lowres, "
    "deformed, extra limbs, cropped body"
)


@dataclass
class Config:
    api_base: str
    prompt: str
    negative: str
    size: int
    frames: int
    steps: int
    cfg: float
    sampler: str
    seed: int
    output_dir: str
    workflow_path: Optional[str]


def configure_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if not stream:
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def safe_print(*args) -> None:
    text = " ".join(str(x) for x in args)
    try:
        print(text)
    except UnicodeEncodeError:
        encoded = text.encode("utf-8", errors="replace").decode("utf-8", errors="replace")
        print(encoded)


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def safe_slug(text: str, max_len: int = 32) -> str:
    value = re.sub(r"[^\w\u4e00-\u9fff-]+", "_", str(text or "").strip(), flags=re.UNICODE)
    value = re.sub(r"_+", "_", value).strip("_")
    return (value or "attack")[:max_len]


def request_json(method: str, url: str, **kwargs: Any) -> Dict[str, Any]:
    try:
        resp = requests.request(method, url, timeout=REQUEST_TIMEOUT, **kwargs)
        resp.raise_for_status()
        return resp.json() if resp.text else {}
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(f"Cannot connect to ComfyUI API: {url}") from exc
    except requests.exceptions.HTTPError as exc:
        detail = ""
        try:
            detail = json.dumps(resp.json(), ensure_ascii=False)  # type: ignore[name-defined]
        except Exception:
            detail = resp.text
        raise RuntimeError(f"ComfyUI HTTP error: {exc}\n{detail}") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"ComfyUI request failed: {exc}") from exc


def detect_api_base(preferred: str = "") -> str:
    candidates: List[str] = []
    if preferred.strip():
        candidates.append(preferred.strip().rstrip("/"))

    env_api = os.environ.get("COMFY_API_BASE", "").strip()
    if env_api:
        candidates.append(env_api.rstrip("/"))

    for item in API_CANDIDATES:
        candidates.append(item.rstrip("/"))

    tried = []
    for base in dict.fromkeys(candidates):
        tried.append(base)
        try:
            request_json("GET", f"{base}/object_info")
            return base
        except Exception:
            continue

    roots = [p for p in COMFY_ROOT_CANDIDATES if Path(p).exists()]
    roots_text = ", ".join(roots) if roots else "not found"
    raise RuntimeError(
        "ComfyUI API is offline.\n"
        f"Tried: {', '.join(tried)}\n"
        f"Detected Comfy roots: {roots_text}"
    )


def choose_checkpoint(api_base: str) -> str:
    object_info = request_json("GET", f"{api_base}/object_info")
    node = object_info.get("CheckpointLoaderSimple", {})
    required = node.get("input", {}).get("required", {})
    ckpt = required.get("ckpt_name")
    if isinstance(ckpt, list) and ckpt:
        first = ckpt[0]
        if isinstance(first, list) and first:
            return str(first[0])
    raise RuntimeError("No checkpoint available in ComfyUI CheckpointLoaderSimple.")


def default_workflow_path() -> Optional[str]:
    env_path = os.environ.get("COMFY_ATTACK_WORKFLOW", "").strip()
    if env_path and Path(env_path).exists():
        return env_path

    for root in COMFY_ROOT_CANDIDATES:
        candidate = Path(root) / "workflows" / "attack_anim_workflow.json"
        if candidate.exists():
            return str(candidate)
    return None


def load_workflow(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and isinstance(data.get("prompt"), dict):
        return data["prompt"]
    if isinstance(data, dict):
        return data
    raise RuntimeError("Invalid workflow JSON format.")


def patch_workflow(workflow: Dict[str, Any], cfg: Config) -> Dict[str, Any]:
    out = json.loads(json.dumps(workflow))

    text_nodes: List[Dict[str, Any]] = []
    latent_nodes: List[Dict[str, Any]] = []
    sampler_nodes: List[Dict[str, Any]] = []
    save_nodes: List[Dict[str, Any]] = []

    for node in out.values():
        if not isinstance(node, dict):
            continue
        ctype = str(node.get("class_type", ""))
        if ctype == "CLIPTextEncode":
            text_nodes.append(node)
        elif ctype == "EmptyLatentImage":
            latent_nodes.append(node)
        elif ctype == "KSampler":
            sampler_nodes.append(node)
        elif ctype == "SaveImage":
            save_nodes.append(node)

    if text_nodes:
        text_nodes[0].setdefault("inputs", {})["text"] = cfg.prompt
    if len(text_nodes) > 1:
        text_nodes[1].setdefault("inputs", {})["text"] = cfg.negative

    for node in latent_nodes:
        inp = node.setdefault("inputs", {})
        if "width" in inp:
            inp["width"] = cfg.size
        if "height" in inp:
            inp["height"] = cfg.size
        if "batch_size" in inp:
            inp["batch_size"] = cfg.frames

    for node in sampler_nodes:
        inp = node.setdefault("inputs", {})
        if "seed" in inp:
            inp["seed"] = cfg.seed
        if "steps" in inp:
            inp["steps"] = cfg.steps
        if "cfg" in inp:
            inp["cfg"] = cfg.cfg
        if "sampler_name" in inp:
            inp["sampler_name"] = cfg.sampler

    frame_like_keys = {
        "video_frames",
        "frame_count",
        "frames",
        "length",
        "num_frames",
        "context_length",
        "batch_size",
    }
    for node in out.values():
        if not isinstance(node, dict):
            continue
        inp = node.get("inputs")
        if not isinstance(inp, dict):
            continue
        for key, value in list(inp.items()):
            if key in frame_like_keys and isinstance(value, (int, float)):
                inp[key] = int(cfg.frames)

    for node in save_nodes:
        node.setdefault("inputs", {})["filename_prefix"] = "attack_tmp"

    return out


def build_fallback_workflow(cfg: Config, ckpt_name: str) -> Dict[str, Any]:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt_name}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": cfg.prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": cfg.negative, "clip": ["1", 1]}},
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": cfg.size, "height": cfg.size, "batch_size": cfg.frames},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "seed": cfg.seed,
                "steps": cfg.steps,
                "cfg": cfg.cfg,
                "sampler_name": cfg.sampler,
                "scheduler": "normal",
                "denoise": 1.0,
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "attack_tmp"}},
    }


def submit_prompt(api_base: str, workflow: Dict[str, Any]) -> str:
    data = request_json("POST", f"{api_base}/prompt", json={"prompt": workflow})
    prompt_id = data.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"ComfyUI returned no prompt_id: {data}")
    return str(prompt_id)


def wait_history(api_base: str, prompt_id: str) -> Dict[str, Any]:
    deadline = time.time() + POLL_TIMEOUT_SEC
    url = f"{api_base}/history/{prompt_id}"
    while time.time() < deadline:
        data = request_json("GET", url)
        item = data.get(prompt_id)
        if item:
            return item
        time.sleep(POLL_INTERVAL_SEC)
    raise RuntimeError(f"Timeout waiting history for prompt_id={prompt_id}")


def extract_images(history_item: Dict[str, Any]) -> List[Dict[str, str]]:
    outputs = history_item.get("outputs", {})
    images: List[Dict[str, str]] = []
    for node in outputs.values():
        if not isinstance(node, dict):
            continue
        for image in node.get("images", []):
            name = image.get("filename")
            if not name:
                continue
            images.append(
                {
                    "filename": str(name),
                    "subfolder": str(image.get("subfolder", "")),
                    "type": str(image.get("type", "output")),
                }
            )
    return sorted(images, key=lambda x: x.get("filename", ""))


def download_image(api_base: str, image_info: Dict[str, str], out_path: str) -> None:
    params = {
        "filename": image_info["filename"],
        "subfolder": image_info["subfolder"],
        "type": image_info["type"],
    }
    resp = requests.get(f"{api_base}/view", params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    with open(out_path, "wb") as f:
        f.write(resp.content)


def save_sequence(api_base: str, images: List[Dict[str, str]], output_dir: str) -> List[str]:
    ensure_dir(output_dir)
    saved: List[str] = []
    for i, image_info in enumerate(images, start=1):
        filename = f"attack_{i:04d}.png"
        abs_path = str(Path(output_dir).resolve() / filename)
        download_image(api_base, image_info, abs_path)
        saved.append(abs_path)
    return saved


def parse_prompts_file(path: str) -> List[str]:
    out: List[str] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            text = line.strip()
            if text and not text.startswith("#"):
                out.append(text)
    return out


def build_config(
    *,
    api_base: str,
    prompt: str,
    workflow_path: Optional[str],
    size: int,
    frames: int,
    steps: int,
    cfg: float,
    sampler: str,
    seed: int,
    output_dir: str,
) -> Config:
    merged_prompt = f"{POSITIVE_BASE}, {prompt}"
    return Config(
        api_base=api_base.rstrip("/"),
        prompt=merged_prompt,
        negative=NEGATIVE_BASE,
        size=max(384, min(768, int(size))),
        frames=max(1, min(64, int(frames))),
        steps=max(1, int(steps)),
        cfg=float(cfg),
        sampler=str(sampler),
        seed=int(seed),
        output_dir=output_dir,
        workflow_path=workflow_path,
    )


def generate_one(cfg: Config) -> List[str]:
    if cfg.workflow_path:
        workflow = load_workflow(cfg.workflow_path)
        workflow = patch_workflow(workflow, cfg)
        mode = "workflow"
    else:
        ckpt = choose_checkpoint(cfg.api_base)
        workflow = build_fallback_workflow(cfg, ckpt)
        mode = "fallback"

    prompt_id = submit_prompt(cfg.api_base, workflow)
    history = wait_history(cfg.api_base, prompt_id)
    images = extract_images(history)
    if not images:
        raise RuntimeError("No images in ComfyUI history outputs.")
    saved = save_sequence(cfg.api_base, images, cfg.output_dir)
    safe_print(f"[ok] mode={mode}, prompt_id={prompt_id}, frames={len(saved)}")
    for item in saved:
        safe_print(item)
    return saved


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate attack sprite PNG sequence via ComfyUI API")
    parser.add_argument("--api", default="", help="ComfyUI API base URL (auto-detect if empty)")
    parser.add_argument("--prompt", default="", help="single prompt")
    parser.add_argument("--prompts-file", default="", help="batch prompts txt, one prompt each line")
    parser.add_argument("--workflow", default="", help="AnimateDiff workflow json path")
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE, help="frame size, e.g. 512 or 384")
    parser.add_argument("--frames", type=int, default=DEFAULT_FRAMES, help="suggested 12~24")
    parser.add_argument("--steps", type=int, default=DEFAULT_STEPS)
    parser.add_argument("--cfg", type=float, default=DEFAULT_CFG)
    parser.add_argument("--sampler", default=DEFAULT_SAMPLER)
    parser.add_argument("--seed", type=int, default=-1, help="random when < 0")
    parser.add_argument("--output-dir", default=DEFAULT_OUT_DIR)
    return parser.parse_args()


def pick_prompts(args: argparse.Namespace) -> List[str]:
    prompts: List[str] = []
    if args.prompts_file:
        prompts.extend(parse_prompts_file(args.prompts_file))
    if str(args.prompt).strip():
        prompts.append(str(args.prompt).strip())
    if not prompts:
        raw = input("請輸入攻擊動畫提示詞（中文/英文）: ").strip()
        if raw:
            prompts = [raw]
    return prompts


def main() -> int:
    configure_stdio()
    args = parse_args()
    prompts = pick_prompts(args)
    if not prompts:
        safe_print("No prompt provided.")
        return 1

    try:
        api_base = detect_api_base(args.api)
    except Exception as exc:
        safe_print(f"[error] {exc}")
        return 1

    workflow_path = str(args.workflow).strip() or default_workflow_path()
    if workflow_path and not Path(workflow_path).exists():
        safe_print(f"[error] Workflow not found: {workflow_path}")
        return 1

    ensure_dir(args.output_dir)
    base_seed = args.seed if int(args.seed) >= 0 else random.randint(1, 2_147_483_647)

    safe_print(f"Using ComfyUI API: {api_base}")
    if workflow_path:
        safe_print(f"Using workflow: {workflow_path}")
    else:
        safe_print("No workflow provided. Using fallback graph (not true temporal animation).")

    for idx, prompt in enumerate(prompts, start=1):
        if len(prompts) == 1:
            out_dir = args.output_dir
        else:
            out_dir = str(Path(args.output_dir) / f"batch_{idx:03d}_{safe_slug(prompt)}")
        cfg = build_config(
            api_base=api_base,
            prompt=prompt,
            workflow_path=workflow_path,
            size=args.size,
            frames=args.frames,
            steps=args.steps,
            cfg=args.cfg,
            sampler=args.sampler,
            seed=base_seed + idx - 1,
            output_dir=out_dir,
        )
        safe_print("=" * 60)
        safe_print(f"[{idx}/{len(prompts)}] {prompt}")
        try:
            generate_one(cfg)
        except Exception as exc:
            safe_print(f"[fail] {exc}")
            if len(prompts) == 1:
                return 1

    safe_print("All done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
