/**
 * Asset role catalog for the Web_App upload UI (`frontend`).
 *
 * Mirrors the API_Service `ROLE_RULES` (design "Asset role validation rules",
 * Req 2.1–2.6): the roles a project accepts, the file extensions each role
 * expects (used for the file picker `accept` hint), and whether the role is
 * required for readiness. Letters are expanded to `letter:A`..`letter:Z`.
 */

/** A single uploadable asset role shown in the upload UI. */
export interface AssetRole {
  /** Role key sent to `client.uploadAsset` (e.g. `audio`, `letter:A`). */
  role: string;
  /** Human-readable label for the control. */
  label: string;
  /** `accept` attribute value for the file input (extension hints). */
  accept: string;
  /** Whether the role counts toward project readiness (Req 2.8). */
  required: boolean;
}

/** The non-letter roles, in display order. */
const BASE_ROLES: AssetRole[] = [
  { role: "audio", label: "Audio (MP3/WAV)", accept: ".mp3,.wav", required: true },
  {
    role: "background",
    label: "Background image",
    accept: ".png,.jpg,.jpeg,.webp",
    required: true,
  },
  { role: "songLogo", label: "Song logo", accept: ".png,.svg", required: true },
  { role: "channelLogo", label: "Channel logo", accept: ".png,.svg", required: true },
  {
    role: "originalLyrics",
    label: "Original lyrics (optional)",
    accept: ".txt,.json,.md",
    required: false,
  },
];

/** The 26 letters A–Z as `letter:X` roles. */
export const LETTERS: string[] = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i),
);

/** The 26 `Letter_Asset` roles, each requiring an SVG (Req 2.1). */
const LETTER_ROLES: AssetRole[] = LETTERS.map((letter) => ({
  role: `letter:${letter}`,
  label: `Letter ${letter}`,
  accept: ".svg",
  required: true,
}));

/** All non-letter roles (audio, images, lyrics). */
export const PRIMARY_ROLES: AssetRole[] = BASE_ROLES;

/** All letter roles A–Z. */
export const LETTER_ASSET_ROLES: AssetRole[] = LETTER_ROLES;

/** Every uploadable role (primary roles followed by the 26 letters). */
export const ALL_ROLES: AssetRole[] = [...BASE_ROLES, ...LETTER_ROLES];
