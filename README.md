# imagegen-cli

CLI for generating and editing images across providers: **OpenAI** (default), **Gemini**, and local **mlx** on stud-256-01.

## Prerequisites

- Node.js 18+
- API key from at least one provider:
  - OpenAI: https://platform.openai.com/api-keys
  - Gemini: https://aistudio.google.com/apikey

## Setup

```bash
git clone https://github.com/gxbvc/imagegen-cli.git
cd imagegen-cli
npm install
npm run build
npm link
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY and/or GEMINI_API_KEY
```

## Usage

### Basic generation

```bash
imagegen-cli generate "a cat riding a skateboard"                       # OpenAI gpt-image-2 (default)
imagegen-cli generate "a majestic mountain landscape" -o landscape.png  # Save to specific file
imagegen-cli generate "a wide canyon" --aspect 16:9                     # Aspect → 1536x1024 on OpenAI
imagegen-cli generate "studio portrait" --size 1024x1536 --quality high # Explicit pixel size
```

### Image editing

```bash
imagegen-cli generate "make it watercolor" --image cat.png
imagegen-cli generate "compose into one scene" --image a.png --image b.png
imagegen-cli generate "fix the sky" --image photo.png --mask mask.png   # OpenAI inpainting
```

### Gemini (Nano Banana)

```bash
imagegen-cli generate "a cat" --provider gemini
imagegen-cli generate "a cat" --model gemini-2.5-flash-image
imagegen-cli generate "detailed artwork" --model gemini-3-pro-image-preview --size 2K
imagegen-cli generate "a sunset" --provider gemini --no-text
```

### Local mlx (stud-256-01)

```bash
imagegen-cli generate "studio portrait, 85mm" --provider mlx
imagegen-cli generate "a red fox in snow" --model z-image-turbo --seed 42
imagegen-cli generate "make it night" --image shot.png --provider mlx
```

## Providers and models

| Provider | Default model | Other models | Max input images | Notes |
|---|---|---|---|---|
| `openai` (default) | `gpt-image-2` | `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini` | 16 | Sizes: `1024x1024`, `1024x1536`, `1536x1024`. Optional `--mask` for inpainting. |
| `gemini` | `gemini-2.5-flash-image` | `gemini-3-pro-image-preview` | 3 / 14 (pro) | Pro supports `--size 1K\|2K\|4K`. |
| `mlx` | `qwen-image-2.1` | `z-image-turbo` (`z-image`) | 1 (img2img) | Local on stud-256-01:8091. `--seed` and `--steps` work. |

Provider routing: explicit `--provider` wins; otherwise `--model` is split on `/` (e.g. `openai/gpt-image-2`) or inferred from the prefix (`gpt-image-*`, `dall-e-*` → openai; `gemini-*` → gemini; `qwen-image-*`, `z-image-*` → mlx).

## Unified flags

| Flag | OpenAI | Gemini | mlx |
|---|---|---|---|
| `--aspect 16:9` | maps to `1536x1024` | native `aspectRatio` | `1280x720` |
| `--size 1024x1024` | passes through | error (use 1K/2K/4K) | passes through |
| `--seed` | ignored | ignored | used |
| `--steps` | ignored | ignored | used (Qwen 40, Z-Image 9) |
| `--quality high` | passes through (default) | warning, ignored | warning, ignored |
| `--background transparent` | png/webp only | error | warning, RGB only |
| `--mask m.png` | inpainting | error | error |
| `-n 4` | `n=4` | warning, generates 1 | sequential gens |

Aspect ratios: `1:1` (default), `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.

## Command reference

```
Usage: imagegen-cli generate [options] <prompt>

Arguments:
  prompt                Text prompt describing the image to generate

Options:
  -o, --output <path>   Output file path (default: auto-generated)
  -i, --image <path>    Input image path (repeatable)
  --mask <path>         Mask image (OpenAI edits only)
  --model <id>          Model id, optionally provider-prefixed (e.g. openai/gpt-image-2)
  --provider <name>     Provider override: openai | gemini | mlx
  --aspect <ratio>      Aspect ratio
  --size <token>        Resolution: WxH pixels (OpenAI) or 1K|2K|4K (Gemini pro)
  --quality <level>     OpenAI quality: low | medium | high | auto (default: high)
  --background <mode>   OpenAI: transparent | opaque | auto
  --format <ext>        OpenAI output format: png | jpeg | webp (default: png)
  --moderation <level>  OpenAI moderation: auto | low
  -n, --count <int>     Number of images (default 1)
  --seed <int>          Random seed (when supported)
  --steps <int>         Diffusion steps (mlx only)
  --no-text             Image-only output (Gemini only; no-op for OpenAI)
  -h, --help            Display help
```

## Output format

JSON to stdout; status messages to stderr.

```json
{"ok": true, "data": {"files": ["..."], "provider": "openai", "model": "gpt-image-2", "text": null, "meta": {"size": "1024x1024", "quality": "high", "format": "png"}}}
{"ok": false, "error": "message"}
```

## Environment variables

```env
OPENAI_API_KEY=
GEMINI_API_KEY=
IMAGEGEN_MLX_URL=          # optional; defaults to stud-256-01.local:8091
IMAGEGEN_MLX_KEY=mlx
```
