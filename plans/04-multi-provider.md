# 04 — Multi-provider refactor: rename to `imagegen-cli`, add OpenAI

## Goal

Turn this single-provider Gemini CLI into a provider-agnostic image generation CLI with two backends to start: **OpenAI** (default, SOTA) and **Gemini** (Nano Banana).

- Rename the published binary `nanobanana-cli` → `imagegen-cli`. Keep the directory `~/tools/nanobanana-cli/` as-is so existing flow references don't break.
- Default model becomes OpenAI's current SOTA: `gpt-image-2` (released April 2026).
- Provide one unified flag surface; each provider translates flags into its own native params and rejects unsupported combinations with a clear error.

## Background facts (from research, May 2026)

OpenAI image models, in descending quality:
- `gpt-image-2` — SOTA, April 2026, reasoning-augmented, faster than 1.x, ~20% cheaper than 1.5.
- `gpt-image-1.5` — fewer cropping issues, less warm-color bias than 1.0.
- `gpt-image-1` — original April 2025 model.
- `gpt-image-1-mini` — cost-efficient (~80% cheaper than gpt-image-1), Oct 2025.

Endpoints (we'll call these directly via the `openai` npm SDK):
- `POST /v1/images/generations` — text → image. `client.images.generate({...})`.
- `POST /v1/images/edits` — image(s) (+ optional mask) → image. `client.images.edit({...})`. Requires multipart upload of image files.

Key OpenAI params:
- `model` — e.g. `gpt-image-2`.
- `prompt` — string.
- `n` — number of images.
- `size` — `"1024x1024"`, `"1024x1536"` (portrait), `"1536x1024"` (landscape), or `"auto"`.
- `quality` — `"low" | "medium" | "high" | "auto"`.
- `background` — `"transparent" | "opaque" | "auto"` (transparent only with `png`/`webp`).
- `output_format` — `"png" | "jpeg" | "webp"`.
- `moderation` — `"auto" | "low"`.
- `image` (edits only) — file or array of files; up to ~10 input images.
- `mask` (edits only) — single PNG with alpha channel.

OpenAI returns `data[].b64_json` (base64) for `gpt-image-*` models. No `text` response from these endpoints — they're image-only. Auth: `OPENAI_API_KEY`. Org verification may be required for GPT Image models.

Gemini (existing, for reference):
- `gemini-2.5-flash-image` (default today) and `gemini-3-pro-image-preview`.
- Native `aspectRatio` param; resolution as `1K`/`2K`/`4K` (pro only).
- Inline base64 images in the `contents` array for editing; no separate edit endpoint.
- Can return text + image when `responseModalities` includes `TEXT`.

## Unified flag surface (single source of truth)

The user-facing CLI should expose **one** vocabulary and let the provider layer translate. After thinking through the divergence, this is the proposed shape:

```
imagegen-cli generate <prompt>
  -o, --output <path>           # output filename (auto if omitted; provider may write multiple files)
  -i, --image <path>            # input image (repeatable, up to provider's limit)
  --mask <path>                 # optional mask image (OpenAI edits only; Gemini errors)
  --model <id>                  # provider/model or just model id (default: gpt-image-2)
  --provider <name>             # explicit override: openai | gemini (else inferred from --model)
  --aspect <ratio>              # 1:1, 16:9, 9:16, 2:3, 3:2, 4:5, 5:4, 21:9, etc.
  --size <token>                # 1K | 2K | 4K | <W>x<H> (e.g. 1024x1024)
  --quality <level>             # low | medium | high | auto    (OpenAI; ignored by Gemini today)
  --background <mode>           # transparent | opaque | auto   (OpenAI only)
  --format <ext>                # png | jpeg | webp             (OpenAI only; Gemini always png)
  --moderation <level>          # auto | low                    (OpenAI only)
  -n, --count <int>             # number of images (default 1; capped by provider)
  --no-text                     # image-only output (Gemini-only flag; no-op for OpenAI)
  --seed <int>                  # if/when supported
```

### How the unified flags translate

| Unified flag | OpenAI | Gemini |
|---|---|---|
| `--aspect 16:9` (no `--size`) | computed → `size: "1536x1024"` (landscape bucket) | `imageConfig.aspectRatio: "16:9"` |
| `--aspect 1:1` | `size: "1024x1024"` | `imageConfig.aspectRatio: "1:1"` |
| `--size 1024x1024` | passed directly | error: "Gemini accepts 1K/2K/4K, not pixel sizes" |
| `--size 2K` | error: "OpenAI accepts pixel sizes; use `--aspect` for shape" | `imageConfig.imageSize: "2K"` (pro only) |
| `--quality high` | `quality: "high"` | warning: "ignored by Gemini" (don't error — non-fatal) |
| `--background transparent` | `background: "transparent"` (forces png/webp) | error: "not supported by Gemini" |
| `--format webp` | `output_format: "webp"` | error: "Gemini outputs png only" |
| `-i a.png -i b.png` | `client.images.edit({ image: [a, b], ... })` | inline base64 in `contents` array |
| `--mask m.png` | `client.images.edit({ mask: m, ... })` | error: "Gemini doesn't support explicit masks" |
| `--no-text` | no-op (OpenAI doesn't return text) | sets `responseModalities: ["IMAGE"]` |

### Aspect-ratio → OpenAI size mapping

OpenAI only supports three buckets, so collapse aspect ratios into the closest one:
- `1:1` → `1024x1024`
- ratios where width > height (`16:9`, `3:2`, `4:3`, `5:4`, `21:9`) → `1536x1024`
- ratios where height > width (`9:16`, `2:3`, `3:4`, `4:5`) → `1024x1536`

If the user passes `--size <W>x<H>` directly, use that and ignore `--aspect`.

### Model → provider routing

1. If `--provider` is explicit, use it.
2. Else if `--model` contains `/` (e.g. `openai/gpt-image-2`), split on `/`.
3. Else infer from prefix:
   - `gpt-image-*` or `dall-e-*` → `openai`
   - `gemini-*` → `gemini`
   - otherwise → error listing supported prefixes.

## Step-by-step plan

Each step is small enough to land independently. After each step, run `npm run build` to confirm nothing broke. Don't commit until the user OKs.

### Step 1 — Add OpenAI dependency and env loading

1. `cd /Users/cgenco/tools/nanobanana-cli && npm install openai`
2. Edit `src/config.ts`:
   - Rename `getApiKey()` → `getGeminiKey()`.
   - Add `getOpenAIKey()` that reads `OPENAI_API_KEY` (same JSON-error-and-exit pattern).
   - Both should be lazy — only fail when actually called.
3. Update `.env.example` (create if missing) to list both:
   ```
   OPENAI_API_KEY=
   GEMINI_API_KEY=
   ```

### Step 2 — Create the provider abstraction

Create `src/providers/types.ts`:

```ts
export interface InputImage {
  path: string;
  mimeType: string;
  data: Buffer;
}

export interface GenerateRequest {
  prompt: string;
  model: string;            // canonical model id (no provider prefix)
  inputImages: InputImage[];
  mask?: InputImage;
  aspect?: string;          // e.g. "16:9"
  size?: string;            // "1K" | "2K" | "4K" | "1024x1024" | ...
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
  format?: "png" | "jpeg" | "webp";
  moderation?: "auto" | "low";
  count: number;            // default 1
  noText: boolean;
  seed?: number;
  outputPath?: string;      // user-provided -o; provider may suffix for multi-image
  // For auto-naming when outputPath is undefined:
  autoNameFromPrompt: string;
}

export interface GenerateResultFile {
  path: string;
}

export interface GenerateResult {
  files: GenerateResultFile[];
  model: string;
  provider: string;
  text: string | null;      // null when provider doesn't return text
  meta: Record<string, unknown>;  // size, aspect, quality, etc., as actually used
}

export interface ImageProvider {
  name: string;             // "openai" | "gemini"
  defaultModel: string;
  supports(modelId: string): boolean;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
```

### Step 3 — Extract Gemini provider from existing code

1. Create `src/providers/gemini.ts`. Move all Gemini-specific logic from `src/commands/generate.ts` into a `GeminiProvider` class implementing `ImageProvider`.
2. The `generate(req)` method should:
   - Validate that no `--mask`, `--background`, `--format`, `--moderation`, `--quality high` are set in a way that errors (per the translation table — quality is a soft warning printed to stderr).
   - Map `req.inputImages` → `contents[]` with `inlineData`.
   - Map `req.aspect` → `imageConfig.aspectRatio`.
   - Map `req.size` → `imageConfig.imageSize` (only `1K`/`2K`/`4K`; reject pixel sizes).
   - Set `responseModalities` based on `req.noText`.
   - Write output files using the existing auto-name + suffix logic (move helpers `getMimeType`, `slugify`, `generateFilename` into a `src/providers/util.ts` module so OpenAI provider can reuse them).
   - Return `GenerateResult` with `text` populated from response parts.
3. `defaultModel = "gemini-2.5-flash-image"`.
4. `supports(id)` returns `id.startsWith("gemini-")`.

### Step 4 — Implement OpenAI provider

Create `src/providers/openai.ts` using the `openai` SDK:

```ts
import OpenAI from "openai";
import fs from "fs";
import { toFile } from "openai/uploads";
// ... etc
```

Behavior:
- `defaultModel = "gpt-image-2"`.
- `supports(id)` returns `id.startsWith("gpt-image-") || id.startsWith("dall-e-")`.
- If `req.inputImages.length === 0` → call `client.images.generate({...})`.
- Else → call `client.images.edit({ image: [...], mask?: ..., ... })` using `toFile()` to wrap buffers.
- Translate flags:
  - `req.size` → if matches `\d+x\d+`, pass through; if `1K`/`2K`/`4K`, error with friendly message; else fall back to aspect mapping.
  - `req.aspect` (no explicit pixel size) → map to `1024x1024` / `1536x1024` / `1024x1536` via the table above; if unmappable (e.g. `21:9`), pick the nearest landscape bucket and print a stderr note.
  - `req.quality` → pass through (default: omit to let OpenAI use `auto`).
  - `req.background` → pass through; if `transparent`, force `output_format` to `png` if user didn't pick one.
  - `req.format` → `output_format`. Default `png`.
  - `req.moderation` → pass through.
  - `req.count` → `n`.
  - `req.noText` → ignored.
  - `req.mask` → only valid when `inputImages.length >= 1`; otherwise error.
- Decode each `data[i].b64_json`, write to disk using shared filename helpers, returning `text: null`, `provider: "openai"`, and `meta` with the resolved `size`, `quality`, etc.

### Step 5 — Provider registry and routing

Create `src/providers/index.ts`:

```ts
import { GeminiProvider } from "./gemini.js";
import { OpenAIProvider } from "./openai.js";
import type { ImageProvider } from "./types.js";

const providers: ImageProvider[] = [new OpenAIProvider(), new GeminiProvider()];

export function resolveProvider(opts: { provider?: string; model?: string }): {
  provider: ImageProvider;
  modelId: string;
} {
  // 1. Explicit --provider wins.
  // 2. model "openai/gpt-image-2" → split on "/".
  // 3. Prefix inference (gpt-image-*, dall-e-*, gemini-*).
  // 4. Fall back to OpenAI default.
  // Returns canonical model id (no prefix) and the provider instance.
  // Throws if --provider/--model are inconsistent.
}

export const DEFAULT_PROVIDER = providers[0]; // OpenAI
```

### Step 6 — Refactor `src/commands/generate.ts` to be thin

The command now:
1. Parses CLI opts.
2. Reads input images from disk into `InputImage[]` (move file-existence + mimeType logic here, since both providers need it).
3. Calls `resolveProvider({ provider, model })`.
4. Builds a `GenerateRequest` and calls `provider.generate(req)`.
5. Prints unified JSON:
   ```json
   {
     "ok": true,
     "data": {
       "files": ["..."],
       "provider": "openai",
       "model": "gpt-image-2",
       "text": null,
       "meta": { "size": "1536x1024", "quality": "auto" }
     }
   }
   ```
6. On error: `{ ok: false, error: "..." }` and exit 1.

Keep the JSON-stdout / human-stderr split intact ("Generating image..." goes to stderr).

### Step 7 — Update `src/cli.ts`

1. Rename program: `.name("imagegen-cli")`.
2. Update description: "CLI for image generation across providers (OpenAI, Gemini)".
3. Change default `--model` to `"gpt-image-2"`.
4. Add new options: `--provider`, `--mask`, `--quality`, `--background`, `--format`, `--moderation`, `-n/--count`, `--seed`.
5. Keep existing options (`-o`, `-i`, `--aspect`, `--size`, `--no-text`).

### Step 8 — Rename the binary

1. In `package.json`:
   - `"name": "imagegen-cli"` (top-level `name` field).
   - `"bin": { "imagegen-cli": "./bin/imagegen-cli.js" }`.
2. Rename `bin/nanobanana-cli.js` → `bin/imagegen-cli.js`. Update its shebang/import path if needed (it's a tiny wrapper that imports from `dist/cli.js`).
3. `npm run build`.
4. `npm unlink -g nanobanana-cli || true` then `npm link` from this directory to expose `imagegen-cli` globally. **Ask the user before running npm link** since it touches the global npm prefix.

### Step 9 — Update docs

1. `README.md`:
   - Rename headings, swap example commands to `imagegen-cli`.
   - New "Providers" section listing both, with model tables (Gemini and OpenAI side-by-side).
   - New "Unified flags" reference.
   - Update env var section to list both keys.
2. `CLAUDE.md` (this repo's): same renames.
3. `~/tools/CLAUDE.md` index entry: update description from "Gemini image generation and editing (Nano Banana)" → "Image generation/editing (OpenAI gpt-image-2 default, Gemini optional)". Note the directory stays `nanobanana-cli/`. **Ask first** since this touches the toolkit index.
4. `~/tools/agent-toolkit/README.md`: same change if it mirrors the index.

### Step 10 — Smoke tests (manual, JSON-checkable)

Run each and confirm `ok: true`:

```bash
# OpenAI defaults
imagegen-cli generate "a robot dog" -o /tmp/oai-default.png

# OpenAI with aspect → translated to landscape pixel size
imagegen-cli generate "a wide canyon" --aspect 16:9 -o /tmp/oai-wide.png

# OpenAI explicit pixels + quality
imagegen-cli generate "studio portrait" --size 1024x1536 --quality high -o /tmp/oai-portrait.png

# OpenAI edit
imagegen-cli generate "make it watercolor" -i /tmp/oai-default.png -o /tmp/oai-edit.png

# Gemini fallback via prefix
imagegen-cli generate "a cat" --model gemini-2.5-flash-image -o /tmp/gem-cat.png

# Gemini via provider override
imagegen-cli generate "a cat" --provider gemini -o /tmp/gem-cat2.png

# Error: --size 2K against OpenAI
imagegen-cli generate "x" --size 2K  # should ok:false with friendly error

# Error: --background against Gemini
imagegen-cli generate "x" --provider gemini --background transparent
```

### Step 11 — Commit

One commit per logical step is fine; or squash to a single "feat: multi-provider, rename binary to imagegen-cli". Defer to user. **Don't commit until asked.**

## Out of scope for this pass

- Responses-API style image generation (`tools: [{type: "image_generation"}]` on `gpt-5.5`). Worth a follow-up plan if the user wants prompt-revision or multi-turn editing.
- Caching / cost reporting.
- A `models list` subcommand.
- Anthropic, Stability, Replicate, Black Forest Labs — easy to bolt on once the provider interface is stable.

## Open question to resolve before Step 8

Whether to keep `nanobanana-cli` as an alias binary alongside `imagegen-cli`. Cheap to do (`"bin": { "imagegen-cli": "...", "nanobanana-cli": "..." }`) and saves muscle memory. Default plan is **no alias** — clean break, single name.
