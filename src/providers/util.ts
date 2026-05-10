import path from "path";
import fs from "fs";
import type { InputImage } from "./types.js";

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    default: throw new Error(`Unsupported image format: ${ext}`);
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateFilename(prompt: string, ext = "png"): string {
  const slug = slugify(prompt.slice(0, 40));
  const timestamp = Math.floor(Date.now() / 1000);
  return `${slug}-${timestamp}.${ext}`;
}

export function readInputImage(filePath: string): InputImage {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`);
  }
  return {
    path: filePath,
    mimeType: getMimeType(filePath),
    data: fs.readFileSync(filePath),
  };
}

export function resolveOutputPath(opts: {
  outputPath?: string;
  autoNameFromPrompt: string;
  index: number;
  totalCount: number;
  ext: string;
}): string {
  const { outputPath, autoNameFromPrompt, index, totalCount, ext } = opts;
  const suffix = totalCount > 1 ? `-${index + 1}` : "";
  if (outputPath) {
    const existingExt = path.extname(outputPath);
    if (existingExt) {
      const base = outputPath.slice(0, -existingExt.length);
      return `${base}${suffix}${existingExt}`;
    }
    return `${outputPath}${suffix}.${ext}`;
  }
  const auto = generateFilename(autoNameFromPrompt, ext);
  const autoExt = path.extname(auto);
  const autoBase = auto.slice(0, -autoExt.length);
  return `${autoBase}${suffix}${autoExt}`;
}
