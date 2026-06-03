/**
 * Placement constants for the Classic template family.
 *
 * Per the design, the landscape and portrait Classic templates "differ only in
 * placement constants and which template id is selected" — so the entire layer
 * stack lives in {@link ClassicScene} and each orientation supplies one of these
 * {@link ClassicLayout} objects. Sizes are expressed in canvas pixels (landscape
 * is 1920x1080, portrait is 1080x1920) and a few are fractions of the canvas so
 * the scene can position relative to the actual `useVideoConfig` dimensions.
 */

/** Tunable placement + sizing constants for a single Classic orientation. */
export interface ClassicLayout {
  /** Background blur radius in px (Req 10.1). */
  bgBlur: number;
  /** Beat-proximity window in seconds driving letter bounce/glow (Req 10.4). */
  beatWindow: number;
  /** Centered Letter_Asset box size in px (Req 10.3). */
  letterSize: number;
  /** Letter vertical offset from center in px (negative = up). */
  letterOffsetY: number;
  /** Left/right audio-bar column geometry (Req 10.9). */
  bars: {
    /** Number of bars stacked per side. */
    count: number;
    /** Maximum bar length (grows inward from the edge) in px. */
    maxLength: number;
    /** Thickness of each bar in px. */
    thickness: number;
    /** Vertical gap between bars in px. */
    gap: number;
    /** Inset of the bar column from the canvas edge in px. */
    edgeInset: number;
  };
  /** Top-left info box (song logo + names) (Req 10.7). */
  infoBox: {
    margin: number;
    logoSize: number;
    songFontSize: number;
    singerFontSize: number;
    padding: number;
  };
  /** Top-right circular channel logo (Req 10.8). */
  channelLogo: {
    margin: number;
    size: number;
  };
  /** Bottom lyric box (Req 10.5, 10.6). */
  lyricBox: {
    marginBottom: number;
    maxWidth: number;
    fontSize: number;
    lineGap: number;
    padding: number;
  };
}

/** Landscape (1920x1080) placement constants. */
export const LANDSCAPE_LAYOUT: ClassicLayout = {
  bgBlur: 24,
  beatWindow: 0.25,
  letterSize: 460,
  letterOffsetY: -40,
  bars: {
    count: 16,
    maxLength: 220,
    thickness: 10,
    gap: 8,
    edgeInset: 48,
  },
  infoBox: {
    margin: 48,
    logoSize: 96,
    songFontSize: 40,
    singerFontSize: 28,
    padding: 20,
  },
  channelLogo: {
    margin: 48,
    size: 120,
  },
  lyricBox: {
    marginBottom: 90,
    maxWidth: 1500,
    fontSize: 54,
    lineGap: 12,
    padding: 28,
  },
};

/** Portrait (1080x1920) placement constants. */
export const PORTRAIT_LAYOUT: ClassicLayout = {
  bgBlur: 20,
  beatWindow: 0.25,
  letterSize: 560,
  letterOffsetY: -120,
  bars: {
    count: 24,
    maxLength: 150,
    thickness: 8,
    gap: 7,
    edgeInset: 28,
  },
  infoBox: {
    margin: 36,
    logoSize: 84,
    songFontSize: 38,
    singerFontSize: 26,
    padding: 18,
  },
  channelLogo: {
    margin: 36,
    size: 110,
  },
  lyricBox: {
    marginBottom: 220,
    maxWidth: 980,
    fontSize: 52,
    lineGap: 12,
    padding: 26,
  },
};
