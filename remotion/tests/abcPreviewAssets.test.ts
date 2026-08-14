import { describe, expect, it } from "vitest";

import {
  calculateAssetPairPlacement,
  calculateObjectGroupCenterY,
  calculatePlacedAsset,
  type AssetMeta,
} from "../src/AbcPreviewVideo.js";

function meta(overrides: Partial<AssetMeta> = {}): AssetMeta {
  return {
    src: "object.png",
    file: { w: 1672, h: 941 },
    bbox: { x: 800, y: 40, w: 740, h: 800 },
    groupBbox: { x: 800, y: 40, w: 740, h: 860 },
    includesObjectWord: true,
    ...overrides,
  };
}

describe("ABC preview object-word placement", () => {
  it("keeps wide object-word groups separated without shrinking them unnecessarily", () => {
    const placement = calculateAssetPairPlacement(
      meta({ bbox: { x: 100, y: 40, w: 520, h: 800 } }),
      meta({
        bbox: { x: 720, y: 40, w: 1000, h: 520 },
        groupBbox: { x: 680, y: 40, w: 1080, h: 880 },
      }),
      {
        canvasWidth: 1920,
        assetHeight: 520,
        letterScale: 1.02,
        objectScale: 0.92,
        assetGap: 96,
        assetHorizontalPadding: 80,
      },
    );

    expect(placement.assetHeight).toBeLessThanOrEqual(520);
    expect(placement.visualGap).toBeGreaterThanOrEqual(96);
    expect(placement.letterX).toBeLessThan(placement.objectX);
  });

  it("keeps the embedded object word above the fixed lyric box", () => {
    const centerY = calculateObjectGroupCenterY(meta(), {
      canvasHeight: 1080,
      assetHeight: 520,
      assetY: 520,
      objectScale: 0.92,
      lyricBottom: 48,
      lyricHeight: 220,
      groupGap: 24,
    });

    expect(centerY).toBeCloseTo(520, 1);
  });

  it("uses the preferred stage center when the word has enough room", () => {
    const centerY = calculateObjectGroupCenterY(
      meta({ groupBbox: { x: 800, y: 40, w: 740, h: 820 } }),
      {
        canvasHeight: 1080,
        assetHeight: 520,
        assetY: 520,
        objectScale: 0.92,
        lyricBottom: 48,
        lyricHeight: 220,
        groupGap: 24,
      },
    );

    expect(centerY).toBe(520);
  });

  it("normalizes the alpha top and bottom of the letter and object group", () => {
    const placement = calculateAssetPairPlacement(
      meta({ bbox: { x: 100, y: 40, w: 520, h: 800 }, groupBbox: undefined }),
      meta({
        bbox: { x: 720, y: 80, w: 700, h: 520 },
        groupBbox: { x: 680, y: 40, w: 1080, h: 880 },
      }),
      {
        canvasWidth: 1920,
        assetHeight: 520,
        letterScale: 1.02,
        objectScale: 0.92,
        assetGap: 96,
        assetHorizontalPadding: 80,
      },
    );
    const centerY = 520;
    const letter = calculatePlacedAsset(
      meta({ bbox: { x: 100, y: 40, w: 520, h: 800 }, groupBbox: undefined }),
      placement.letterX,
      centerY,
      placement.assetHeight,
    );
    const object = calculatePlacedAsset(
      meta({
        bbox: { x: 720, y: 80, w: 700, h: 520 },
        groupBbox: { x: 680, y: 40, w: 1080, h: 880 },
      }),
      placement.objectX,
      centerY,
      placement.assetHeight,
    );

    expect(letter.visibleTop).toBeCloseTo(object.visibleTop, 5);
    expect(letter.visibleBottom).toBeCloseTo(object.visibleBottom, 5);
    expect(object.visibleLeft - letter.visibleRight).toBeCloseTo(
      placement.visualGap,
      5,
    );
    expect(placement.assetHeight).toBe(520);
  });

  it("honors a common vertical cap before horizontal fitting", () => {
    const placement = calculateAssetPairPlacement(
      meta(),
      meta(),
      {
        canvasWidth: 1920,
        assetHeight: 520,
        maxAssetHeight: 360,
        letterScale: 1.02,
        objectScale: 0.92,
        assetGap: 96,
        assetHorizontalPadding: 80,
      },
    );

    expect(placement.assetHeight).toBe(360);
  });
});
