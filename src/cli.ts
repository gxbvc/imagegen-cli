import { Command } from "commander";
import { generateCommand } from "./commands/generate.js";

const program = new Command();

function collect(val: string, arr: string[]) {
  arr.push(val);
  return arr;
}

program
  .name("imagegen-cli")
  .version("0.2.0")
  .description("CLI for image generation across providers (OpenAI, Gemini)");

program.command("generate")
  .description("Generate or edit an image from a text prompt")
  .argument("<prompt>", "Text prompt describing the image to generate")
  .option("-o, --output <path>", "Output file path (default: auto-generated)")
  .option("-i, --image <path>", "Input image path (repeatable)", collect, [])
  .option("--mask <path>", "Mask image (OpenAI edits only)")
  .option("--model <id>", "Model id, optionally provider-prefixed (e.g. openai/gpt-image-2)")
  .option("--provider <name>", "Provider override: openai | gemini")
  .option("--aspect <ratio>", "Aspect ratio (1:1, 16:9, 9:16, 2:3, 3:2, 4:5, 5:4, 21:9, ...)")
  .option("--size <token>", "Resolution: WxH pixels (OpenAI) or 1K|2K|4K (Gemini pro)")
  .option("--quality <level>", "OpenAI quality: low | medium | high | auto (default: high)")
  .option("--background <mode>", "OpenAI: transparent | opaque | auto")
  .option("--format <ext>", "OpenAI output format: png | jpeg | webp (default: png)")
  .option("--moderation <level>", "OpenAI moderation: auto | low")
  .option("-n, --count <int>", "Number of images (default 1)")
  .option("--seed <int>", "Random seed (when supported)")
  .option("--no-text", "Image-only output (Gemini only; no-op for OpenAI)")
  .action(generateCommand);

program.parse();
