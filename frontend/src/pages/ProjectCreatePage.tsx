import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, JSX } from "react";
import { ApiClientError } from "../api/index.js";
import type { FolderImportResult, VideoFormat } from "../api/index.js";
import type { PageProps, PageRegistration } from "./types.js";

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

interface RequiredGroup {
  label: string;
  paths: string[];
}

const REQUIRED_GROUPS: RequiredGroup[] = [
  { label: "audio", paths: ["assets/audio.mp3", "assets/audio.wav"] },
  {
    label: "background",
    paths: [
      "assets/background.png",
      "assets/background.jpg",
      "assets/background.jpeg",
      "assets/background.webp",
    ],
  },
  { label: "songLogo", paths: ["assets/song-logo.png", "assets/song-logo.svg"] },
  {
    label: "channelLogo",
    paths: ["assets/channel-logo.png", "assets/channel-logo.svg"],
  },
  ...LETTERS.map((letter) => ({
    label: `letter:${letter}`,
    paths: [`assets/letters/${letter}.svg`],
  })),
];

const DIRECTORY_INPUT_PROPS = {
  webkitdirectory: "",
  directory: "",
} as { webkitdirectory: string; directory: string };

const VIDEO_FORMATS: { value: VideoFormat; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
];

interface ProfileItem {
  file: File;
  sourcePath: string;
  relativePath: string;
}

interface SongProfile {
  id: string;
  label: string;
  files: File[];
  items: ProfileItem[];
  present: Set<string>;
  missing: RequiredGroup[];
  metadataFile?: ProfileItem;
  optionalLyrics?: ProfileItem;
}

interface ImportedMetadata {
  songName?: string;
  singerName?: string;
  videoFormat?: VideoFormat;
}

function ProjectCreatePage({ context }: PageProps): JSX.Element {
  const { client, setProjectId, navigate } = context;
  const [files, setFiles] = useState<File[]>([]);
  const [checkedProfileId, setCheckedProfileId] = useState<string | null>(null);
  const [songName, setSongName] = useState("");
  const [singerName, setSingerName] = useState("");
  const [videoFormat, setVideoFormat] = useState<VideoFormat>("both");
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imported, setImported] = useState<FolderImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profiles = useMemo(() => buildProfiles(files), [files]);
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === checkedProfileId) ?? null,
    [profiles, checkedProfileId],
  );

  useEffect(() => {
    if (profiles.length === 1 && checkedProfileId === null) {
      setCheckedProfileId(profiles[0]!.id);
    }
    if (checkedProfileId && !profiles.some((profile) => profile.id === checkedProfileId)) {
      setCheckedProfileId(null);
    }
  }, [profiles, checkedProfileId]);

  useEffect(() => {
    if (!selectedProfile) {
      setSongName("");
      setSingerName("");
      setVideoFormat("both");
      setMetadataError(null);
      return;
    }

    let cancelled = false;
    setSongName(displayName(selectedProfile.label));
    setSingerName("Imported Folder");
    setVideoFormat("both");
    setMetadataError(null);

    if (!selectedProfile.metadataFile) return;
    readFileText(selectedProfile.metadataFile.file)
      .then((text) => {
        if (cancelled) return;
        const metadata = parseMetadata(text);
        setSongName(metadata.songName ?? displayName(selectedProfile.label));
        setSingerName(metadata.singerName ?? "Imported Folder");
        setVideoFormat(metadata.videoFormat ?? "both");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMetadataError(err instanceof Error ? err.message : "Failed to read metadata.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProfile]);

  const canSubmit =
    selectedProfile !== null &&
    selectedProfile.missing.length === 0 &&
    songName.trim().length > 0 &&
    singerName.trim().length > 0 &&
    !submitting;

  function handleFiles(event: ChangeEvent<HTMLInputElement>): void {
    setFiles(Array.from(event.currentTarget.files ?? []));
    setCheckedProfileId(null);
    setImported(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit || selectedProfile === null) return;
    setSubmitting(true);
    setError(null);
    setImported(null);
    try {
      const result = await client.importFolder(selectedProfile.files, {
        songName: songName.trim(),
        singerName: singerName.trim(),
        videoFormat,
      });
      setImported(result);
      setProjectId(result.project.projectId);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page project-create-page">
      <h2>Load music folder</h2>
      <p>Select a music library folder, then check and import one song profile.</p>

      <div className="field">
        <label htmlFor="folder">Music library folder</label>
        <input
          id="folder"
          name="folder"
          type="file"
          multiple
          {...DIRECTORY_INPUT_PROPS}
          onChange={handleFiles}
        />
      </div>

      {profiles.length > 0 && (
        <div className="profile-section">
          <h3>Song profiles</h3>
          <ul className="profile-list" aria-label="Song profiles">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className={
                  profile.id === selectedProfile?.id
                    ? "profile-item selected"
                    : "profile-item"
                }
              >
                <div>
                  <strong>{displayName(profile.label)}</strong>
                  <span className={profile.missing.length === 0 ? "status success" : "status error"}>
                    {profile.missing.length === 0
                      ? "Ready"
                      : `${profile.missing.length} missing`}
                  </span>
                </div>
                <p>
                  {profile.files.length} files, {countLetters(profile.present)}/26 letters
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCheckedProfileId(profile.id);
                    setImported(null);
                    setError(null);
                  }}
                >
                  Check
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedProfile && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="profile-check">
            <h3>Checked folder</h3>
            <p>
              <code>{selectedProfile.id}</code>
            </p>

            {selectedProfile.missing.length > 0 ? (
              <div className="error" role="status">
                <p>Required files are missing.</p>
                <ul aria-label="Missing required files">
                  {selectedProfile.missing.map((item) => (
                    <li key={item.label}>
                      <strong>{item.label}</strong>: {item.paths.join(" or ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="success" role="status">
                All required files are present.
              </p>
            )}

            <dl className="detected-files">
              <div>
                <dt>Audio</dt>
                <dd>{firstPresent(selectedProfile, REQUIRED_GROUPS[0]!) ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Background</dt>
                <dd>{firstPresent(selectedProfile, REQUIRED_GROUPS[1]!) ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Song logo</dt>
                <dd>{firstPresent(selectedProfile, REQUIRED_GROUPS[2]!) ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Channel logo</dt>
                <dd>{firstPresent(selectedProfile, REQUIRED_GROUPS[3]!) ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Lyrics</dt>
                <dd>{selectedProfile.optionalLyrics?.relativePath ?? "Optional"}</dd>
              </div>
              <div>
                <dt>Metadata</dt>
                <dd>{selectedProfile.metadataFile?.relativePath ?? "Editable on this page"}</dd>
              </div>
            </dl>
          </div>

          <fieldset className="field metadata-fields">
            <legend>Metadata</legend>
            <label htmlFor="songName">Song name</label>
            <input
              id="songName"
              name="songName"
              type="text"
              value={songName}
              onChange={(event) => setSongName(event.currentTarget.value)}
              required
            />

            <label htmlFor="singerName">Singer name</label>
            <input
              id="singerName"
              name="singerName"
              type="text"
              value={singerName}
              onChange={(event) => setSingerName(event.currentTarget.value)}
              required
            />

            <label htmlFor="videoFormat">Export format</label>
            <select
              id="videoFormat"
              name="videoFormat"
              value={videoFormat}
              onChange={(event) => setVideoFormat(event.currentTarget.value as VideoFormat)}
            >
              {VIDEO_FORMATS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </fieldset>

          {metadataError && (
            <p className="error" role="alert">
              {metadataError}
            </p>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={!canSubmit}>
            {submitting ? "Loading..." : "Load selected song"}
          </button>
        </form>
      )}

      {files.length > 0 && profiles.length === 0 && (
        <p className="error" role="status">
          No song folders were detected. Put each song's files in its own
          folder, either directly or inside an assets directory.
        </p>
      )}

      {imported && (
        <div className="success" role="status">
          <p>
            Project loaded. Project ID: <code>{imported.project.projectId}</code>
          </p>
          <p>
            {imported.config
              ? "Config was generated from existing analysis artifacts."
              : "Run transcription and analysis before generating the final videos."}
          </p>
          <button type="button" onClick={() => navigate("jobs")}>
            Open jobs
          </button>
        </div>
      )}
    </section>
  );
}

function buildProfiles(files: File[]): SongProfile[] {
  const groups = new Map<string, ProfileItem[]>();
  for (const file of files) {
    const sourcePath = relativeName(file);
    const normalized = normalizeProfilePath(sourcePath);
    if (normalized === null) continue;
    const items = groups.get(normalized.profileId) ?? [];
    items.push({ file, sourcePath, relativePath: normalized.relativePath });
    groups.set(normalized.profileId, items);
  }

  return [...groups.entries()]
    .map(([id, items]) => {
      const present = new Set(items.map((item) => item.relativePath));
      return {
        id,
        label: id.split("/").at(-1) ?? id,
        files: items.map((item) => item.file),
        items,
        present,
        missing: REQUIRED_GROUPS.filter(
          (group) => !group.paths.some((path) => present.has(path)),
        ),
        metadataFile: items.find(
          (item) =>
            item.relativePath === "metadata.json" ||
            item.relativePath === "project.json",
        ),
        optionalLyrics: items.find((item) =>
          ["assets/original-lyrics.txt", "assets/original-lyrics.json"].includes(
            item.relativePath,
          ),
        ),
      };
    })
    .sort((a, b) => displayName(a.label).localeCompare(displayName(b.label)));
}

function normalizeProfilePath(
  rawName: string,
): { profileId: string; relativePath: string } | null {
  const parts = rawName
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part.length > 0 && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) return null;

  const assetIndex = parts.lastIndexOf("assets");
  if (assetIndex >= 0) {
    return {
      profileId: profileId(parts.slice(0, assetIndex)),
      relativePath: parts.slice(assetIndex).join("/"),
    };
  }

  const artifactIndex = parts.lastIndexOf("artifacts");
  if (artifactIndex >= 0) {
    return {
      profileId: profileId(parts.slice(0, artifactIndex)),
      relativePath: parts.slice(artifactIndex).join("/"),
    };
  }

  const last = parts.at(-1);
  if (last === "metadata.json" || last === "project.json") {
    return {
      profileId: profileId(parts.slice(0, -1)),
      relativePath: last,
    };
  }

  const lettersIndex = parts.lastIndexOf("letters");
  if (lettersIndex >= 0 && last) {
    const letterPath = looseLetterPath(last);
    if (letterPath !== null) {
      return {
        profileId: profileId(parts.slice(0, lettersIndex)),
        relativePath: letterPath,
      };
    }
  }

  if (last) {
    const relativePath = looseAssetPath(last);
    if (relativePath !== null) {
      return {
        profileId: profileId(parts.slice(0, -1)),
        relativePath,
      };
    }
  }

  return null;
}

function looseAssetPath(fileName: string): string | null {
  const parsed = parseLooseName(fileName);
  if (parsed === null) return null;
  const { stem, ext } = parsed;

  if ((ext === ".mp3" || ext === ".wav") && ["audio", "song", "track", "music"].includes(stem)) {
    return `assets/audio${ext}`;
  }
  if (
    [".png", ".jpg", ".jpeg", ".webp"].includes(ext) &&
    ["background", "bg", "backdrop", "cover"].includes(stem)
  ) {
    return `assets/background${ext}`;
  }
  if (
    (ext === ".png" || ext === ".svg") &&
    ["song-logo", "logo-song", "logo-bai-hat", "songlogo", "title-logo"].includes(stem)
  ) {
    return `assets/song-logo${ext}`;
  }
  if (
    (ext === ".png" || ext === ".svg") &&
    ["channel-logo", "logo-channel", "logo-kenh", "channellogo", "channel"].includes(stem)
  ) {
    return `assets/channel-logo${ext}`;
  }

  const letterPath = looseLetterPath(fileName);
  if (letterPath !== null) return letterPath;

  if (
    (ext === ".txt" || ext === ".json") &&
    ["original-lyrics", "original-lyric", "lyrics", "lyric"].includes(stem)
  ) {
    return `assets/original-lyrics${ext}`;
  }
  if (ext === ".json" && stem === "audio-analysis") {
    return "artifacts/audio-analysis.json";
  }
  return null;
}

function looseLetterPath(fileName: string): string | null {
  const parsed = parseLooseName(fileName);
  if (parsed === null || parsed.ext !== ".svg" || !/^[a-z]$/.test(parsed.stem)) {
    return null;
  }
  return `assets/letters/${parsed.stem.toUpperCase()}.svg`;
}

function parseLooseName(fileName: string): { stem: string; ext: string } | null {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = fileName.slice(dot).toLowerCase();
  const stem = fileName
    .slice(0, dot)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return stem.length > 0 ? { stem, ext } : null;
}

function profileId(parts: string[]): string {
  return parts.length > 0 ? parts.join("/") : "Selected folder";
}

function relativeName(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function parseMetadata(text: string): ImportedMetadata {
  const parsed = JSON.parse(text) as unknown;
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("metadata.json must be a JSON object.");
  }
  const data = parsed as Record<string, unknown>;
  const videoFormat = data.videoFormat;
  return {
    songName: cleanString(data.songName) ?? cleanString(data.title),
    singerName: cleanString(data.singerName) ?? cleanString(data.artist),
    videoFormat:
      videoFormat === "landscape" || videoFormat === "portrait" || videoFormat === "both"
        ? videoFormat
        : undefined,
  };
}

function readFileText(file: File): Promise<string> {
  const text = (file as File & { text?: () => Promise<string> }).text;
  if (typeof text === "function") return text.call(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function displayName(raw: string): string {
  return raw.replace(/[_-]+/g, " ").trim() || "Imported Folder";
}

function countLetters(present: Set<string>): number {
  return LETTERS.filter((letter) => present.has(`assets/letters/${letter}.svg`)).length;
}

function firstPresent(profile: SongProfile, group: RequiredGroup): string | null {
  return group.paths.find((path) => profile.present.has(path)) ?? null;
}

function toMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    const missing = err.details?.missing;
    if (Array.isArray(missing) && missing.length > 0) {
      return `${err.message}: ${missing.join(", ")}`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Failed to load the folder. Please try again.";
}

export const pageRegistration: PageRegistration = {
  id: "create",
  label: "Load Folder",
  order: 0,
  component: ProjectCreatePage,
};

export default ProjectCreatePage;
