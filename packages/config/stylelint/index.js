/**
 * Stylelint config for app/library CSS. Raw design values are only allowed inside @linkyo/tokens.
 * App CSS may reference tokens (`var(--…)`, Tailwind `@apply`/`theme()`), never define them.
 * @type {import("stylelint").Config}
 */
const config = {
  extends: ["stylelint-config-standard"],
  rules: {
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch"],
    "unit-disallowed-list": ["px", "pt", "pc", "cm", "mm", "in", "q"],
    "declaration-property-value-allowed-list": {
      "font-family": ["/^var\\(--/", "inherit"],
    },
    "declaration-property-value-disallowed-list": {
      "/^(margin|padding|gap|row-gap|column-gap|width|height|min-|max-|inset|top|right|bottom|left|font-size|letter-spacing|line-height|border-radius|border-width|outline-width|outline-offset|box-shadow|transition-duration|animation-duration|z-index)/":
        ["/(?<![\\w-])-?\\d*\\.?\\d+(px|rem|em|pt|ms|s)\\b/"],
    },
    // Tailwind v4 at-rules.
    "at-rule-no-unknown": [
      true,
      { ignoreAtRules: ["theme", "source", "utility", "variant", "custom-variant", "plugin", "config", "apply", "reference", "layer"] },
    ],
    "at-rule-no-deprecated": [true, { ignoreAtRules: ["apply"] }],
    "import-notation": "string",
    "selector-class-pattern": null,
    "custom-property-pattern": null,
    "no-descending-specificity": null,
  },
};

export default config;
