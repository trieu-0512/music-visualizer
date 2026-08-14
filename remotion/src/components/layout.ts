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
  /** Optional object word rendered next to the letter when no object image exists. */
  objectWordFontSize: number;
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
    width: number;
    height: number;
    fontSize: number;
    lineGap: number;
    padding: number;
  };
}

/** Landscape (1920x1080) placement constants. */
export const LANDSCAPE_LAYOUT: ClassicLayout = {
  bgBlur: 0,
  beatWindow: 0.25,
  letterSize: 520,
  letterOffsetY: -36,
  objectWordFontSize: 126,
  bars: {
    count: 16,
    maxLength: 220,
    thickness: 10,
    gap: 8,
    edgeInset: 48,
  },
  infoBox: {
    margin: 24,
    logoSize: 132,
    songFontSize: 38,
    singerFontSize: 28,
    padding: 16,
  },
  channelLogo: {
    margin: 24,
    size: 164,
  },
  lyricBox: {
    marginBottom: 56,
    width: 1740,
    height: 220,
    fontSize: 56,
    lineGap: 14,
    padding: 30,
  },
};

/** Portrait (1080x1920) placement constants. */
export const PORTRAIT_LAYOUT: ClassicLayout = {
  bgBlur: 0,
  beatWindow: 0.25,
  letterSize: 520,
  letterOffsetY: -150,
  objectWordFontSize: 96,
  bars: {
    count: 24,
    maxLength: 150,
    thickness: 8,
    gap: 7,
    edgeInset: 28,
  },
  infoBox: {
    margin: 26,
    logoSize: 118,
    songFontSize: 34,
    singerFontSize: 24,
    padding: 14,
  },
  channelLogo: {
    margin: 26,
    size: 142,
  },
  lyricBox: {
    marginBottom: 180,
    width: 1000,
    height: 220,
    fontSize: 50,
    lineGap: 14,
    padding: 28,
  },
};
