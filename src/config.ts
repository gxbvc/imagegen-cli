import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env") });

export function getGeminiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log(JSON.stringify({ ok: false, error: "GEMINI_API_KEY not found in .env file" }));
    process.exit(1);
  }
  return apiKey;
}

export function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(JSON.stringify({ ok: false, error: "OPENAI_API_KEY not found in .env file" }));
    process.exit(1);
  }
  return apiKey;
}

const DEFAULT_MLX_URLS = [
  "http://stud-256-01.local:8091",
  "http://stud-256-01.tail478d01.ts.net:8091",
];

let resolvedMlxUrl: string | null = null;

export function getMlxKey(): string {
  return process.env.IMAGEGEN_MLX_KEY || "mlx";
}

export function getMlxUrl(): string {
  if (process.env.IMAGEGEN_MLX_URL) return process.env.IMAGEGEN_MLX_URL.replace(/\/$/, "");
  if (resolvedMlxUrl) return resolvedMlxUrl;
  throw new Error(
    "IMAGEGEN_MLX_URL is not set and no default host has been probed yet",
  );
}

export async function probeMlxUrl(): Promise<string> {
  if (process.env.IMAGEGEN_MLX_URL) {
    resolvedMlxUrl = process.env.IMAGEGEN_MLX_URL.replace(/\/$/, "");
    return resolvedMlxUrl;
  }
  if (resolvedMlxUrl) return resolvedMlxUrl;
  for (const base of DEFAULT_MLX_URLS) {
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        resolvedMlxUrl = base;
        return base;
      }
    } catch {
      // try next host
    }
  }
  throw new Error(
    `Could not reach imagegen-mlx at ${DEFAULT_MLX_URLS.join(" or ")}. Set IMAGEGEN_MLX_URL.`,
  );
}
