/**
 * Remotion entry point. Registers the composition root so the Studio, the CLI
 * (`remotion compositions`), and the headless render (task 10.4) can discover
 * the `landscape` and `portrait` compositions.
 */
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root.js";

registerRoot(RemotionRoot);
