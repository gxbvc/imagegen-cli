import { GeminiProvider } from "./gemini.js";
import { OpenAIProvider } from "./openai.js";
import type { ImageProvider } from "./types.js";

const providers: Record<string, ImageProvider> = {
  openai: new OpenAIProvider(),
  gemini: new GeminiProvider(),
};

export const DEFAULT_PROVIDER: ImageProvider = providers.openai;

export function resolveProvider(opts: { provider?: string; model?: string }): {
  provider: ImageProvider;
  modelId: string;
} {
  let providerName: string | undefined = opts.provider?.toLowerCase();
  let modelId = opts.model;

  if (modelId && modelId.includes("/")) {
    const [pfx, rest] = modelId.split("/", 2);
    if (providerName && providerName !== pfx.toLowerCase()) {
      throw new Error(
        `--provider ${providerName} conflicts with model prefix ${pfx}`,
      );
    }
    providerName = pfx.toLowerCase();
    modelId = rest;
  }

  if (!providerName && modelId) {
    for (const [name, p] of Object.entries(providers)) {
      if (p.supports(modelId)) {
        providerName = name;
        break;
      }
    }
    if (!providerName) {
      throw new Error(
        `Couldn't infer provider from model '${modelId}'. Supported prefixes: gpt-image-*, dall-e-*, gemini-*. Use --provider to override.`,
      );
    }
  }

  if (!providerName) {
    providerName = DEFAULT_PROVIDER.name;
  }

  const provider = providers[providerName];
  if (!provider) {
    throw new Error(
      `Unknown provider '${providerName}'. Supported: ${Object.keys(providers).join(", ")}`,
    );
  }

  if (!modelId) modelId = provider.defaultModel;
  return { provider, modelId };
}
