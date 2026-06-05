import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateAudioAnalysis,
  validateLyrics,
  validateProjectConfig,
  type AudioAnalysisJson,
  type LyricsJson,
  type ProjectConfigJson,
} from "@music-visualizer/shared";

import { buildOpenReelEffectsManifest } from "./effects.js";
import { buildHtmlVideoStoryboard } from "./storyboard.js";

const HTML_VIDEO_STORYBOARD_NAME = "html-video-storyboard.json";
const OPENREEL_EFFECTS_MANIFEST_NAME = "openreel-effects-manifest.json";

interface CliArgs {
  projectDir: string;
  outDir?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const projectDir = await resolveProjectDir(args.projectDir);
  const config = await readConfig(projectDir);
  const lyrics = await readValidatedJson<LyricsJson>(
    join(projectDir, config.artifacts.lyrics),
    (value) => validateLyrics(value),
    "lyrics",
  );
  const analysis = await readValidatedJson<AudioAnalysisJson>(
    join(projectDir, config.artifacts.audioAnalysis),
    (value) => validateAudioAnalysis(value),
    "audio analysis",
  );

  const storyboard = buildHtmlVideoStoryboard(config, lyrics, analysis);
  const effectsManifest = buildOpenReelEffectsManifest();

  const outDir = resolve(args.outDir ?? join(projectDir, "artifacts"));
  await mkdir(outDir, { recursive: true });

  const storyboardPath = join(outDir, HTML_VIDEO_STORYBOARD_NAME);
  const effectsPath = join(outDir, OPENREEL_EFFECTS_MANIFEST_NAME);
  await writeJson(storyboardPath, storyboard);
  await writeJson(effectsPath, effectsManifest);

  console.log(`Wrote ${storyboardPath}`);
  console.log(`Wrote ${effectsPath}`);
}

function parseArgs(argv: string[]): CliArgs | null {
  let projectDir: string | undefined;
  let outDir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") {
      outDir = argv[i + 1];
      i++;
      continue;
    }
    if (!projectDir) {
      projectDir = arg;
      continue;
    }
    return null;
  }

  return projectDir ? { projectDir, outDir } : null;
}

async function readConfig(projectDir: string): Promise<ProjectConfigJson> {
  const candidates = [
    join(projectDir, "artifacts", "project-config.json"),
    join(projectDir, "project-config.json"),
  ];

  for (const path of candidates) {
    try {
      return await readValidatedJson<ProjectConfigJson>(
        path,
        (value) => validateProjectConfig(value),
        "project config",
      );
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `No project-config.json found in ${candidates.map((p) => `'${p}'`).join(" or ")}`,
  );
}

async function resolveProjectDir(input: string): Promise<string> {
  if (isAbsolute(input)) {
    return resolve(input);
  }

  const cwdCandidate = resolve(input);
  if (await hasProjectConfig(cwdCandidate)) {
    return cwdCandidate;
  }

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const repoCandidate = resolve(repoRoot, input);
  if (await hasProjectConfig(repoCandidate)) {
    return repoCandidate;
  }

  return cwdCandidate;
}

async function hasProjectConfig(projectDir: string): Promise<boolean> {
  const candidates = [
    join(projectDir, "artifacts", "project-config.json"),
    join(projectDir, "project-config.json"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }
  return false;
}

async function readValidatedJson<T>(
  path: string,
  validate: (value: unknown) => { ok: true; value: T } | { ok: false; error: unknown },
  label: string,
): Promise<T> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const result = validate(parsed);
  if (!result.ok) {
    throw new Error(`Invalid ${label} at ${path}: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function printUsage(): void {
  console.error(
    "Usage: npm run handoff --workspace @music-visualizer/remotion -- <project-dir> [--out <dir>]",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
