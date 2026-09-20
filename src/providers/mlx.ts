import fs from "fs";
import { probeMlxUrl, getMlxKey } from "../config.js";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types.js";
import { resolveOutputPath } from "./util.js";

const ALIASES: Record<string, string> = {
  "qwen-image-2.1": "qwen-image-2.1",
  "qwen-2.1": "qwen-image-2.1",
  qwen21: "qwen-image-2.1",
  "qwen-image-21": "qwen-image-2.1",
  "z-image-turbo": "z-image-turbo",
  "z-image": "z-image-turbo",
  zimage: "z-image-turbo",
};

function canonicalModel(modelId: string): string {
  const key = modelId.toLowerCase();
  const mapped = ALIASES[key];
  if (!mapped) {
    throw new Error(
      `Unknown mlx model '${modelId}'. Supported: qwen-image-2.1, z-image-turbo`,
    );
  }
  return mapped;
}

export class MlxProvider implements ImageProvider {
  name = "mlx";
  defaultModel = "qwen-image-2.1";

  supports(modelId: string): boolean {
    const id = modelId.toLowerCase();
    return (
      id in ALIASES ||
      id.startsWith("qwen-image") ||
      id.startsWith("z-image")
    );
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (req.mask) {
      throw new Error("mlx img2img does not take --mask yet");
    }
    if (req.background && req.background !== "auto" && req.background !== "opaque") {
      console.error(
        "Warning: --background transparent is ignored; Qwen-Image-2.1 mflux decode is RGB only",
      );
    }
    if (req.format && req.format !== "png") {
      throw new Error("mlx outputs png only");
    }
    if (req.moderation) {
      throw new Error("--moderation is not supported by mlx");
    }
    if (req.quality) {
      console.error("Warning: --quality is ignored by mlx");
    }
    if (req.noText) {
      console.error("Warning: --no-text is a no-op for mlx");
    }
    if (req.size && /^[124]K$/i.test(req.size)) {
      // server accepts 1K/2K/4K
    } else if (req.size && !/^\d+x\d+$/.test(req.size)) {
      throw new Error(`Invalid --size '${req.size}'; expected WxH like 1024x1024`);
    }

    const model = canonicalModel(req.model);
    const url = `${await probeMlxUrl()}/v1/images/generations`;
    const body: Record<string, unknown> = {
      model,
      prompt: req.prompt,
      n: req.count,
    };
    if (req.size) body.size = req.size;
    if (req.aspect) body.aspect = req.aspect;
    if (req.seed !== undefined) body.seed = req.seed;
    if (req.steps !== undefined) body.steps = req.steps;
    if (req.inputImages.length > 0) {
      body.image = req.inputImages.map((img) => img.data.toString("base64"));
    }

    console.error(`mlx ${model} via ${url}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getMlxKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });

    const json = (await response.json()) as {
      error?: string;
      data?: { b64_json?: string }[];
      model?: string;
      meta?: Record<string, unknown>;
    };
    if (!response.ok) {
      throw new Error(json.error || `mlx HTTP ${response.status}`);
    }
    const data = json.data ?? [];
    if (data.length === 0) throw new Error("No images returned from mlx");

    const files: { path: string }[] = [];
    data.forEach((item, i) => {
      if (!item.b64_json) throw new Error("mlx response missing b64_json");
      const outputPath = resolveOutputPath({
        outputPath: req.outputPath,
        autoNameFromPrompt: req.autoNameFromPrompt,
        index: i,
        totalCount: data.length,
        ext: "png",
      });
      fs.writeFileSync(outputPath, Buffer.from(item.b64_json, "base64"));
      files.push({ path: outputPath });
    });

    return {
      files,
      model: json.model || model,
      provider: this.name,
      text: null,
      meta: json.meta ?? {},
    };
  }
}
