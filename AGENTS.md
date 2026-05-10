# imagegen-cli

CLI for generating and editing images across providers (OpenAI, Gemini).

## Environment

Requires `.env` with at least one of:
- `OPENAI_API_KEY` — get at https://platform.openai.com/api-keys
- `GEMINI_API_KEY` — get at https://aistudio.google.com/apikey

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
```

## Providers and models

| Provider | Default model | Other models | Notes |
|---|---|---|---|
| `openai` (default) | `gpt-image-2` | `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini` | Edits up to 16 input images, optional `--mask` |
| `gemini` | `gemini-2.5-flash-image` | `gemini-3-pro-image-preview` | Pro supports `--size 1K\|2K\|4K` |

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
