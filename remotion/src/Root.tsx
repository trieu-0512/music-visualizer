/**
 * Remotion composition root.
 *
 * Exposes six compositions bound to the format-agnostic {@link Video} component:
 * landscape + portrait at Full HD, 2K, and 4K.
 *
 * Both are driven by input props (`config` / `lyrics` / `analysis`): the frame
 * rate and `durationInFrames` are computed from the audio analysis via
 * `calculateMetadata`, so the timeline length follows the actual song rather
 * than a hard-coded constant (Req 10.10, design "Composition Selection and
 * Input Props"). The template is then chosen by `layout.template` identifier
 * inside `Video` (Req 15.1).
 */
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { FPS, defaultProps, durationInFrames } from "./defaultProps.js";
import { Video } from "./Video.js";
import type { VideoProps } from "./Video.js";

const COMPOSITIONS = [
  { id: "landscape-fullhd", width: 1920, height: 1080 },
  { id: "portrait-fullhd", width: 1080, height: 1920 },
  { id: "landscape-2k", width: 2560, height: 1440 },
  { id: "portrait-2k", width: 1440, height: 2560 },
  { id: "landscape-4k", width: 3840, height: 2160 },
  { id: "portrait-4k", width: 2160, height: 3840 },
] as const;

/** Compute fps + duration from the input props (Req: duration driven by props). */
const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => ({
  fps: FPS,
  durationInFrames: durationInFrames(props, FPS),
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {COMPOSITIONS.map((composition) => (
        <Composition
          key={composition.id}
          id={composition.id}
          component={Video}
          width={composition.width}
          height={composition.height}
          fps={FPS}
          durationInFrames={durationInFrames(defaultProps, FPS)}
          defaultProps={defaultProps}
          calculateMetadata={calculateMetadata}
        />
      ))}
    </>
  );
};
