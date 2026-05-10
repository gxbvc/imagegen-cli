export interface InputImage {
  path: string;
  mimeType: string;
  data: Buffer;
}

export interface GenerateRequest {
  prompt: string;
  model: string;
  inputImages: InputImage[];
  mask?: InputImage;
  aspect?: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
  format?: "png" | "jpeg" | "webp";
  moderation?: "auto" | "low";
  count: number;
  noText: boolean;
  seed?: number;
  outputPath?: string;
  autoNameFromPrompt: string;
}

export interface GenerateResultFile {
  path: string;
}

export interface GenerateResult {
  files: GenerateResultFile[];
  model: string;
  provider: string;
  text: string | null;
  meta: Record<string, unknown>;
}

export interface ImageProvider {
  name: string;
  defaultModel: string;
  supports(modelId: string): boolean;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
