import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { getGeminiKey } from "../config.js";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types.js";
import { resolveOutputPath } from "./util.js";

export class GeminiProvider implements ImageProvider {
  name = "gemini";
  defaultModel = "gemini-2.5-flash-image";

  supports(modelId: string): boolean {
    return modelId.startsWith("gemini-");
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (req.mask) {
      throw new Error("Gemini doesn't support explicit masks (use --provider openai)");
    }
    if (req.background && req.background !== "auto") {
      throw new Error("--background is not supported by Gemini");
    }
    if (req.format && req.format !== "png") {
      throw new Error("Gemini outputs png only; --format unsupported");
    }
    if (req.moderation) {
      throw new Error("--moderation is not supported by Gemini");
    }
    if (req.quality) {
      console.error(`Warning: --quality is ignored by Gemini`);
    }
    if (req.size && !/^[124]K$/.test(req.size)) {
      throw new Error("Gemini accepts 1K/2K/4K, not pixel sizes; use --aspect for shape");
    }
    if (req.count > 1) {
      console.error(`Warning: -n/--count is not supported by Gemini; generating 1 image`);
    }

    const apiKey = getGeminiKey();
    const ai = new GoogleGenAI({ apiKey });

    const contents: any[] = [{ text: req.prompt }];
    for (const img of req.inputImages) {
      contents.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data.toString("base64"),
        },
      });
    }

    const imageConfig: any = {};
    if (req.aspect) imageConfig.aspectRatio = req.aspect;
    if (req.size) imageConfig.imageSize = req.size;

    const response = await ai.models.generateContent({
      model: req.model,
      contents,
      config: {
        responseModalities: req.noText ? ["IMAGE"] : ["TEXT", "IMAGE"],
        imageConfig,
      },
    });

    const cand = response.candidates?.[0];
    if (!cand?.content?.parts) {
      throw new Error("No valid response from Gemini API");
    }

    const imageParts = cand.content.parts.filter(
      (p: any) => p.inlineData?.data,
    );
    let text = "";
    for (const part of cand.content.parts) {
      if (part.text) text += part.text;
    }

    const files: { path: string }[] = [];
    imageParts.forEach((part: any, i: number) => {
      const outputPath = resolveOutputPath({
        outputPath: req.outputPath,
        autoNameFromPrompt: req.autoNameFromPrompt,
        index: i,
        totalCount: imageParts.length,
        ext: "png",
      });
      fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, "base64"));
      files.push({ path: outputPath });
    });

    return {
      files,
      model: req.model,
      provider: this.name,
      text: text || null,
      meta: {
        aspect_ratio: req.aspect ?? null,
        size: req.size ?? null,
      },
    };
  }
}
