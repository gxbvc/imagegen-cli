# imagegen-cli

CLI for generating and editing images across providers (OpenAI, Gemini, mlx).

## Provider choice — default to OpenAI

**Always default to OpenAI (`gpt-image-2`) for both generation and edits.** It scores higher on current benchmarks and handles compositional edits (remove person, swap background, etc.) much more reliably than Gemini. Don't reach for `--provider gemini` out of habit from the Nano Banana era — that's outdated.

Only use `--provider gemini` when:
- The user explicitly asks for Gemini / Nano Banana
- OpenAI refuses on moderation (rare — try `--moderation low` first)
- You need `4K` output (Gemini Pro only)

Use `--provider mlx` (or `--model qwen-image-2.1` / `--model z-image-turbo`) for local generation on stud-256-01. Default mlx model is Qwen-Image-2.1. Use `z-image-turbo` for photoreal drafts. Local is for private, seedable, or unmoderated jobs, not for beating gpt-image-2 on quality.

Caveat on OpenAI edits: `gpt-image-2` re-renders the whole image, so faces/text in the unmasked area get subtly redrawn. For pixel-perfect preservation of part of the image, pass a `--mask` (white = edit, black = keep) for true inpainting.

## Environment

Requires `.env` with at least one of:
- `OPENAI_API_KEY` — get at https://platform.openai.com/api-keys
- `GEMINI_API_KEY` — get at https://aistudio.google.com/apikey
- `IMAGEGEN_MLX_URL` — optional; defaults to `http://stud-256-01.local:8091` then Tailscale
- `IMAGEGEN_MLX_KEY` — optional; default `mlx`

## Commands

```bash
imagegen-cli generate "a cat riding a skateboard"                       # OpenAI gpt-image-2 (default)
imagegen-cli generate "a cat riding a skateboard" -o cat.png            # Save to specific file
imagegen-cli generate "a wide canyon" --aspect 16:9                     # Aspect → 1536x1024 on OpenAI
imagegen-cli generate "studio portrait" --size 1024x1536 --quality high # Explicit pixel size
imagegen-cli generate "make it watercolor" --image cat.png              # Edit existing image
imagegen-cli generate "compose them" --image a.png --image b.png        # Multiple inputs
imagegen-cli generate "fix the sky" --image photo.png --mask mask.png   # OpenAI inpainting

# Gemini (Nano Banana)
imagegen-cli generate "a cat" --provider gemini                         # Provider override
imagegen-cli generate "a cat" --model gemini-2.5-flash-image            # Or model prefix
imagegen-cli generate "detail" --model gemini-3-pro-image-preview --size 2K
imagegen-cli generate "a sunset" --provider gemini --no-text            # Image-only Gemini output

# Local mlx on stud-256-01
imagegen-cli generate "studio portrait" --provider mlx                  # Qwen-Image-2.1
imagegen-cli generate "a red fox in snow" --model z-image-turbo --seed 42
imagegen-cli generate "make it night" --image shot.png --provider mlx
```

## Providers and models

| Provider | Default model | Other models | Notes |
|---|---|---|---|
| `openai` (default) | `gpt-image-2` | `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini` | Edits up to 16 input images, optional `--mask` |
| `gemini` | `gemini-2.5-flash-image` | `gemini-3-pro-image-preview` | Pro supports `--size 1K\|2K\|4K` |
| `mlx` | `qwen-image-2.1` | `z-image-turbo` | Local daemon on stud-256-01:8091. `--seed` / `--steps`. One input image for img2img. |

## Unified flags

| Flag | OpenAI | Gemini |
|---|---|---|
| `--aspect 16:9` | maps to `1536x1024` | native `aspectRatio` |
| `--size 1024x1024` | passes through | error (use 1K/2K/4K) |
| `--size 2K` | error | sets `imageSize` (pro only) |
| `--quality high` | passes through (default) | warning, ignored |
| `--background transparent` | png/webp only | error |
| `--format webp` | passes through | error (png only) |
| `--moderation low` | passes through | error |
| `-n 4` | `n=4` | warning, generates 1 |
| `--mask m.png` | inpainting | error |
| `--no-text` | warning, no-op | sets `responseModalities: [IMAGE]` |

Aspect ratios: `1:1` (default), `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.

## Output

JSON to stdout. Image files saved to disk; `console.error` for status.

```json
{"ok": true, "data": {"files": ["..."], "provider": "openai", "model": "gpt-image-2", "text": null, "meta": {"size": "1024x1024", "quality": "high", "format": "png"}}}
{"ok": false, "error": "message"}
```
