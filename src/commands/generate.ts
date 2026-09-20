import { resolveProvider } from "../providers/index.js";
import { readInputImage } from "../providers/util.js";
import type { GenerateRequest } from "../providers/types.js";

export async function generateCommand(prompt: string, opts: any) {
  try {
    console.error("Generating image...");

    const { provider, modelId } = resolveProvider({
      provider: opts.provider,
      model: opts.model,
    });

    const inputImages = (opts.image || []).map((p: string) => readInputImage(p));
    const mask = opts.mask ? readInputImage(opts.mask) : undefined;

    const req: GenerateRequest = {
      prompt,
      model: modelId,
      inputImages,
      mask,
      aspect: opts.aspect,
      size: opts.size,
      quality: opts.quality,
      background: opts.background,
      format: opts.format,
      moderation: opts.moderation,
      count: opts.count ? parseInt(opts.count, 10) : 1,
      noText: opts.text === false,
      seed: opts.seed ? parseInt(opts.seed, 10) : undefined,
      steps: opts.steps ? parseInt(opts.steps, 10) : undefined,
      outputPath: opts.output,
      autoNameFromPrompt: prompt,
    };

    const result = await provider.generate(req);

    console.log(
      JSON.stringify({
        ok: true,
        data: {
          files: result.files.map((f) => f.path),
          provider: result.provider,
          model: result.model,
          text: result.text,
          meta: result.meta,
        },
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  }
}
