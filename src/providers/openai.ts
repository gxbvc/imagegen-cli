import OpenAI, { toFile } from "openai";
import fs from "fs";
import { getOpenAIKey } from "../config.js";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types.js";
import { resolveOutputPath } from "./util.js";

const ASPECT_TO_SIZE: Record<string, "1024x1024" | "1024x1536" | "1536x1024"> = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "3:2": "1536x1024",
  "4:3": "1536x1024",
  "5:4": "1536x1024",
  "21:9": "1536x1024",
  "9:16": "1024x1536",
  "2:3": "1024x1536",
  "3:4": "1024x1536",
  "4:5": "1024x1536",
};

function resolveSize(req: GenerateRequest): "1024x1024" | "1024x1536" | "1536x1024" | "auto" {
  if (req.size) {
    if (/^[124]K$/.test(req.size)) {
      throw new Error("OpenAI accepts pixel sizes (e.g. 1024x1024); use --aspect for shape");
    }
    const m = req.size.match(/^(\d+)x(\d+)$/);
    if (!m) {
      throw new Error(`Invalid --size '${req.size}'; expected WxH like 1024x1024`);
    }
    const allowed = ["1024x1024", "1024x1536", "1536x1024"];
    if (!allowed.includes(req.size)) {
      throw new Error(
        `OpenAI gpt-image-* supports only ${allowed.join(", ")}; got ${req.size}`,
      );
    }
    return req.size as "1024x1024" | "1024x1536" | "1536x1024";
  }
  if (req.aspect) {
    const mapped = ASPECT_TO_SIZE[req.aspect];
    if (!mapped) {
      const [w, h] = req.aspect.split(":").map((n) => parseInt(n, 10));
      if (!w || !h) throw new Error(`Invalid --aspect '${req.aspect}'`);
      const fallback = w > h ? "1536x1024" : w < h ? "1024x1536" : "1024x1024";
      console.error(
        `Warning: aspect ${req.aspect} doesn't map to an OpenAI bucket; using ${fallback}`,
      );
      return fallback;
    }
    return mapped;
  }
  return "auto";
}

export class OpenAIProvider implements ImageProvider {
  name = "openai";
  defaultModel = "gpt-image-2";

  supports(modelId: string): boolean {
    return modelId.startsWith("gpt-image-") || modelId.startsWith("dall-e-");
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (req.noText) {
      console.error("Warning: --no-text is a no-op for OpenAI (image-only output by default)");
    }
    if (req.mask && req.inputImages.length === 0) {
      throw new Error("--mask requires at least one --image input");
    }

    const apiKey = getOpenAIKey();
    const client = new OpenAI({ apiKey });

    const size = resolveSize(req);
    const quality = req.quality ?? "high";
    const format = req.format ?? "png";
    const background = req.background;

    if (background === "transparent" && format === "jpeg") {
      throw new Error("--background transparent requires --format png or webp");
    }

    let response;
    if (req.inputImages.length === 0) {
      const params: any = {
        model: req.model,
        prompt: req.prompt,
        n: req.count,
        size,
        quality,
        output_format: format,
      };
      if (background) params.background = background;
      if (req.moderation) params.moderation = req.moderation;
      response = await client.images.generate(params);
    } else {
      const imageFiles = await Promise.all(
        req.inputImages.map((img) =>
          toFile(img.data, img.path.split("/").pop() ?? "image.png", {
            type: img.mimeType,
          }),
        ),
      );
      const params: any = {
        model: req.model,
        prompt: req.prompt,
        image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
        n: req.count,
        size,
        quality,
        output_format: format,
      };
      if (background) params.background = background;
      if (req.mask) {
        params.mask = await toFile(
          req.mask.data,
          req.mask.path.split("/").pop() ?? "mask.png",
          { type: req.mask.mimeType },
        );
      }
      response = await client.images.edit(params);
    }

    const data = (response as any).data ?? [];
    if (data.length === 0) throw new Error("No images returned from OpenAI");

    const files: { path: string }[] = [];
    data.forEach((item: any, i: number) => {
      if (!item.b64_json) {
        throw new Error("OpenAI response missing b64_json");
      }
      const outputPath = resolveOutputPath({
        outputPath: req.outputPath,
        autoNameFromPrompt: req.autoNameFromPrompt,
        index: i,
        totalCount: data.length,
        ext: format,
      });
      fs.writeFileSync(outputPath, Buffer.from(item.b64_json, "base64"));
      files.push({ path: outputPath });
    });

    return {
      files,
      model: req.model,
      provider: this.name,
      text: null,
      meta: {
        size,
        quality,
        format,
        background: background ?? null,
        moderation: req.moderation ?? null,
        count: data.length,
      },
    };
  }
}
