/**
 * The home page resolves creator themes on the server (the theme engine stays out of its first
 * download) and hands its islands the resulting CSS variables. An island gets only the variables it
 * reads: the rest of a theme (about 1 KB a look) would travel twice in the page, as props and as an
 * inline style, for nothing (E-03, ADR 0008).
 */

/**
 * What a look's card in the playground reads (`LookPreview` in playground.tsx): its colours, the
 * mini buttons in each button style, the halo of the halo template (`poster-halo`: the accent and
 * both glows), and the look's display type.
 */
export const CARD_VARS = [
  "--creator-bg",
  "--creator-surface",
  "--creator-surface-2",
  "--creator-fg",
  "--creator-accent",
  "--creator-line",
  "--creator-line-strong",
  "--creator-glass",
  "--creator-glow-1",
  "--creator-glow-2",
  "--creator-font-display",
  "--creator-display-weight",
  "--creator-display-tracking",
  "--creator-display-transform",
  "--creator-radius-button",
] as const;

/** What the story picture's font probes read (`StoryPicture` in story-picture.tsx). */
export const FACE_VARS = ["--creator-font-display", "--creator-display-weight", "--creator-font-body"] as const;

/** The named variables of a resolved theme, in the theme's own order. */
export function pickVars(vars: Record<string, string>, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(vars).filter(([name]) => names.includes(name)));
}
