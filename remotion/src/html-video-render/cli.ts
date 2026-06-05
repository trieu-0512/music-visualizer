import { access } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderHtmlVideoProject } from "./renderer.js";

interface CliArgs {
  projectDir: string;
  storyboardPath?: string;
  htmlVideoRoot?: string;
  outputDir?: string;
  targetId?: string;
  maxDuration?: number;
  mode?: "frames" | "recorder";
  crf?: number;
  muxAudio: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const projectDir = await resolveProjectDir(args.projectDir);
  const artifacts = await renderHtmlVideoProject({
    projectDir,
    ...(args.storyboardPath !== undefined && {
      storyboardPath: resolve(args.storyboardPath),
    }),
    ...(args.htmlVideoRoot !== undefined && {
      htmlVideoRoot: resolve(args.htmlVideoRoot),
    }),
    ...(args.outputDir !== undefined && { outputDir: resolve(args.outputDir) }),
    ...(args.targetId !== undefined && { targetId: args.targetId }),
    ...(args.maxDuration !== undefined && { maxDuration: args.maxDuration }),
    ...(args.mode !== undefined && { mode: args.mode }),
    ...(args.crf !== undefined && { crf: args.crf }),
    muxAudio: args.muxAudio,
  });

  for (const artifact of artifacts) {
    console.log(
      `Rendered ${artifact.targetId}: ${artifact.outputPath} (${artifact.fileSizeBytes} bytes)`,
    );
  }
}

function parseArgs(argv: string[]): CliArgs | null {
  let projectDir: string | undefined;
  let storyboardPath: string | undefined;
  let htmlVideoRoot: string | undefined;
  let outputDir: string | undefined;
  let targetId: string | undefined;
  let maxDuration: number | undefined;
  let mode: "frames" | "recorder" | undefined;
  let crf: number | undefined;
  let muxAudio = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--storyboard") {
      storyboardPath = requireValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--html-video-root") {
      htmlVideoRoot = requireValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--out") {
      outputDir = requireValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--target") {
      targetId = requireValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--max-duration") {
      const value = Number(requireValue(argv, ++i, arg));
      if (!Number.isFinite(value) || value <= 0) return null;
      maxDuration = value;
      continue;
    }
    if (arg === "--mode") {
      const value = requireValue(argv, ++i, arg);
      if (value !== "frames" && value !== "recorder") return null;
      mode = value;
      continue;
    }
    if (arg === "--crf") {
      const value = Number(requireValue(argv, ++i, arg));
      if (!Number.isInteger(value) || value < 0 || value > 51) return null;
      crf = value;
      continue;
    }
    if (arg === "--no-audio") {
      muxAudio = false;
      continue;
    }
    if (!projectDir) {
      projectDir = arg;
      continue;
    }
    return null;
  }

  return projectDir
    ? {
        projectDir,
        ...(storyboardPath !== undefined && { storyboardPath }),
        ...(htmlVideoRoot !== undefined && { htmlVideoRoot }),
        ...(outputDir !== undefined && { outputDir }),
        ...(targetId !== undefined && { targetId }),
        ...(maxDuration !== undefined && { maxDuration }),
        ...(mode !== undefined && { mode }),
        ...(crf !== undefined && { crf }),
        muxAudio,
      }
    : null;
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

async function resolveProjectDir(input: string): Promise<string> {
  if (isAbsolute(input)) return resolve(input);

  const cwdCandidate = resolve(input);
  if (await hasStoryboard(cwdCandidate)) return cwdCandidate;

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const repoCandidate = resolve(repoRoot, input);
  if (await hasStoryboard(repoCandidate)) return repoCandidate;

  return cwdCandidate;
}

async function hasStoryboard(projectDir: string): Promise<boolean> {
  try {
    await access(join(projectDir, "artifacts", "html-video-storyboard.json"));
    return true;
  } catch {
    return false;
  }
}

function printUsage(): void {
  console.error(
    [
      "Usage: npm run render:html-video -- <project-dir> [options]",
      "",
      "Options:",
      "  --target <id|all>          Target from html-video-storyboard.json (default: all)",
      "  --max-duration <seconds>   Render a short preview instead of the full song",
      "  --mode <frames|recorder>   frames is high-quality default; recorder is faster/lossier",
      "  --crf <0..51>              H.264 quality for frames mode (default: 12)",
      "  --html-video-root <dir>    Path to sibling nexu-io/html-video repo",
      "  --storyboard <file>        Override storyboard JSON path",
      "  --out <dir>                Output directory (default: project artifacts)",
      "  --no-audio                 Export video-only MP4",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
