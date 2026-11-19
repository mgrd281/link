/**
 * Shared detection patterns for raw design values.
 *
 * Everything visual (colors, sizes, fonts, motion) must come from `@linkyo/tokens`.
 * These patterns are used by the ESLint rule `linkyo/no-raw-design-values`, the Stylelint
 * config and the token-guard CLI so every surface enforces the same contract.
 */

/** `#3355FF`, `#fff`, `#0a0a0b80` — but not `&#123;` entities or `/path#anchor`. */
export const HEX_COLOR = /(?<![\w&#/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/;

/** `rgb(10 10 11)`, `oklch(0.6 0.2 260)` — raw numeric color functions. `rgb(var(--x))` is fine. */
export const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[-+.\d]/i;

/** Absolute lengths: `16px`, `0.5px`, `12pt`. */
export const ABSOLUTE_LENGTH = /(?<![\w.-])-?(?:\d+\.?\d*|\.\d+)(?:px|pt)(?![\w-])/;

/** Any numeric length or duration with a unit: `1.5rem`, `200ms`, `2em`. */
export const ANY_UNIT_NUMBER = /(?<![\w.-])-?(?:\d+\.?\d*|\.\d+)(?:px|pt|rem|em|ch|ex|ms|s)(?![\w-])/;

/**
 * Tailwind arbitrary values: `w-[13px]`, `bg-[#fff]`, `[--x:12px]`, `text-[1.1rem]`.
 * Capture group 1 is the arbitrary content.
 */
export const TAILWIND_ARBITRARY = /(?:^|[\s:!"'`])-?(?:[a-z][\w-]*-)?\[([^\]\s]+)\]/gi;

/** Tailwind core utilities that accept bare numbers (`z-10`, `duration-200`, `opacity-50`, `scale-95`). */
export const RAW_NUMERIC_UTILITY =
  /(?:^|[\s:!"'`])-?((?:z|duration|delay|opacity|scale|border(?:-[trblxyse])?|outline|outline-offset|ring|ring-offset|stroke)-\d+)(?![\w./-])/;

/** Color opacity modifiers (`bg-white/10`) hard-code transparency — use a semantic overlay token. */
export const COLOR_OPACITY_MODIFIER =
  /(?:^|[\s:!"'`])((?:bg|text|border(?:-[trblxyse])?|ring|ring-offset|fill|stroke|outline|shadow|from|via|to|divide|placeholder|decoration|accent|caret)-[a-z][\w-]*\/\d+)(?![\w.-])/;

/**
 * Shadow utilities: `shadow-e2`, `hover:shadow-lg`, `drop-shadow-md`, `inset-shadow-sm`, `text-shadow-xs`,
 * `shadow-[0_1px_2px_black]`. Linkyo is flat (ADR 0037): borders and fills separate surfaces, never
 * shadows. `shadow-none` stays allowed: it only takes a shadow away.
 */
export const SHADOW_UTILITY = /(?:^|[\s:!"'`])((?:inset-|drop-|text-)?shadow-(?!none(?![\w-]))[\w[\]().,#%/-]+)/;

/** Style properties that draw a shadow. */
export const SHADOW_PROPERTIES = new Set(["boxShadow", "textShadow"]);

/** Font family declarations in strings (`font-family: Inter`) or Tailwind `font-['Inter']`. */
export const FONT_FAMILY_TEXT = /font-family\s*:|font-\[['"]/i;

export const FRAGMENT_ATTRIBUTES = new Set(["href", "to", "id", "htmlFor", "form", "list", "xlinkHref", "headers"]);

/** CSS properties (camelCase) that carry colors in React style objects. */
export const COLOR_PROPERTIES = new Set([
  "color",
  "background",
  "backgroundColor",
  "backgroundImage",
  "border",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderBlockColor",
  "borderInlineColor",
  "outline",
  "outlineColor",
  "fill",
  "stroke",
  "boxShadow",
  "textShadow",
  "caretColor",
  "accentColor",
  "textDecorationColor",
  "columnRuleColor",
]);

/** CSS properties (camelCase) that carry sizes, durations or stacking in React style objects. */
export const SIZE_PROPERTY = new RegExp(
  "^(?:" +
    [
      "width",
      "height",
      "(?:min|max)(?:Width|Height|BlockSize|InlineSize)",
      "blockSize",
      "inlineSize",
      "margin\\w*",
      "padding\\w*",
      "gap",
      "rowGap",
      "columnGap",
      "top",
      "right",
      "bottom",
      "left",
      "inset\\w*",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "border\\w*(?:Radius|Width)",
      "borderRadius",
      "borderWidth",
      "outlineWidth",
      "outlineOffset",
      "flexBasis",
      "zIndex",
      "transitionDuration",
      "animationDuration",
      "translate",
      "scrollMargin\\w*",
      "scrollPadding\\w*",
    ].join("|") +
    ")$",
);

/** Unit-free or relative values that are not design decisions. */
export const NEUTRAL_VALUE = /^(?:0|auto|none|inherit|initial|unset|revert|currentColor|transparent|fit-content|min-content|max-content|-?\d*\.?\d+%|-?\d*\.?\d+(?:vw|vh|dvh|svh|lvh|vmin|vmax|cqw|cqh|fr)|var\(--[\w-]+\)|calc\(.*var\(--.*\)|color-mix\(.*var\(--.*\))$/;

/** JSX attributes that take raw sizes on icons/svg/images. */
export const SIZE_ATTRIBUTES = new Set(["size", "width", "height", "strokeWidth", "stroke-width", "fontSize"]);

/** SVG children whose numbers are geometry inside a viewBox, not rendered sizes. */
export const SVG_GEOMETRY_ELEMENTS = new Set([
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "use",
  "mask",
  "clipPath",
  "pattern",
  "symbol",
  "foreignObject",
  "linearGradient",
  "radialGradient",
  "stop",
  "g",
  "text",
  "tspan",
]);

/**
 * Inspect a single text value.
 * @param {string} text
 * @param {{ fragmentContext?: boolean }} [options]
 * @returns {{ kind: "hex" | "colorFn" | "length" | "arbitrary" | "font" | "shadow", value: string } | null}
 */
export function findRawValue(text, options = {}) {
  if (!text) return null;

  const shadow = text.match(SHADOW_UTILITY);
  if (shadow) return { kind: "shadow", value: shadow[1] ?? shadow[0] };

  // Tailwind arbitrary values first: they produce the most precise message.
  for (const match of text.matchAll(TAILWIND_ARBITRARY)) {
    const content = match[1] ?? "";
    // `[--name:value]` arbitrary property: inspect the value part only.
    const value = content.startsWith("--") && content.includes(":") ? content.slice(content.indexOf(":") + 1) : content;
    const isRaw =
      HEX_COLOR.test(value) ||
      COLOR_FUNCTION.test(value) ||
      ANY_UNIT_NUMBER.test(value) ||
      /^['"]/.test(value) || // font-['Inter']
      /^-?\d*\.?\d+$/.test(value); // z-[13], leading-[1.1], opacity-[0.37]
    if (isRaw) {
      return { kind: "arbitrary", value: match[0].trim() };
    }
  }

  const opacityModifier = text.match(COLOR_OPACITY_MODIFIER);
  if (opacityModifier) return { kind: "arbitrary", value: opacityModifier[1] ?? opacityModifier[0] };

  for (const match of text.matchAll(new RegExp(RAW_NUMERIC_UTILITY.source, "g"))) {
    const utility = match[1] ?? "";
    // 0 (none) and 100 (fully opaque / natural scale) are states, not tunable design values.
    if (/-0$/.test(utility) || /^(?:opacity|scale)-100$/.test(utility)) continue;
    return { kind: "arbitrary", value: utility };
  }

  if (FONT_FAMILY_TEXT.test(text)) return { kind: "font", value: text.slice(0, 60) };

  if (!options.fragmentContext) {
    const isUrl = /^(?:https?:|mailto:|tel:|\/|\.\.?\/)/.test(text);
    const hex = !isUrl && text.match(HEX_COLOR);
    if (hex) return { kind: "hex", value: hex[0] };
  }

  const fn = text.match(COLOR_FUNCTION);
  if (fn) return { kind: "colorFn", value: fn[0] };

  const length = text.match(ABSOLUTE_LENGTH);
  if (length) return { kind: "length", value: length[0] };

  return null;
}
