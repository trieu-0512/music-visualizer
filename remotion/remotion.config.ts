/**
 * Remotion CLI configuration.
 *
 * Sets the composition entry point and sensible render defaults. Programmatic
 * rendering (task 10.4) passes its own options; this file governs the Studio
 * and the `remotion compositions` / `remotion render` CLI commands.
 */
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");
Config.setVideoImageFormat("jpeg");

// The source uses explicit `.js` import specifiers (repo convention, required
// by `verbatimModuleSyntax`). Teach Remotion's webpack bundler to resolve those
// specifiers back to the `.ts`/`.tsx` sources.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    extensionAlias: {
      ...config.resolve?.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    },
  },
}));
