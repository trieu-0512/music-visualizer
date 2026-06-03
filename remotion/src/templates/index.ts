/**
 * Template registry — maps a `layout.template` identifier from
 * `project-config.json` to the React component that renders it.
 *
 * The Render_Engine selects the template purely by identifier so additional
 * templates are added by introducing a new id + component pair here, with no
 * changes to the composition root or callers (Req 15.1, 10.10).
 */
import type React from "react";
import {
  ClassicLandscape,
  CLASSIC_LANDSCAPE_ID,
} from "./ClassicLandscape.js";
import { ClassicPortrait, CLASSIC_PORTRAIT_ID } from "./ClassicPortrait.js";
import type { TemplateProps } from "./types.js";

export type { TemplateProps } from "./types.js";

/**
 * Identifier -> template component. Adding a template is purely additive:
 * register a new id here and the rest of the engine resolves it by lookup.
 */
export const TEMPLATES: Record<string, React.FC<TemplateProps>> = {
  [CLASSIC_LANDSCAPE_ID]: ClassicLandscape,
  [CLASSIC_PORTRAIT_ID]: ClassicPortrait,
};

/** Template used when a config references an unknown identifier (fallback). */
export const FALLBACK_TEMPLATE_ID = CLASSIC_LANDSCAPE_ID;

/**
 * Resolve a template component by its `layout.template` identifier.
 *
 * Falls back to {@link FALLBACK_TEMPLATE_ID} for an unknown id so rendering
 * never crashes on an unrecognized template (Req 15.1).
 */
export function resolveTemplate(
  templateId: string,
): React.FC<TemplateProps> {
  return TEMPLATES[templateId] ?? TEMPLATES[FALLBACK_TEMPLATE_ID]!;
}
