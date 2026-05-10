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
