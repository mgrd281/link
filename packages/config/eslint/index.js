import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import betterTailwind from "eslint-plugin-better-tailwindcss";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import linkyo from "./plugin.js";

const TEST_FILES = ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/e2e/**", "**/test/**", "**/__tests__/**"];
const CONFIG_FILES = ["**/*.config.{js,mjs,cjs,ts}", "**/eslint.config.*"];

/**
 * Shared flat config.
 * @param {{ react?: boolean, next?: boolean, tailwindEntry?: string, tsconfigRootDir: string }} options
 */
export function createConfig({ react = false, next = false, tailwindEntry, tsconfigRootDir }) {
  return tseslint.config(
    {
      ignores: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/coverage/**",
        "**/generated/**",
        "**/playwright-report/**",
        "**/test-results/**",
        "next-env.d.ts",
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.browser, ...globals.node },
        parserOptions: {
          projectService: { allowDefaultProject: ["*.config.mjs", "*.config.js"] },
          tsconfigRootDir,
        },
      },
      linterOptions: { reportUnusedDisableDirectives: "error" },
      plugins: { linkyo },
      rules: {
        "linkyo/no-raw-design-values": "error",
        "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
        "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
        "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
        "no-console": ["error", { allow: ["warn", "error"] }],
        eqeqeq: ["error", "always"],
      },
    },
    react
      ? [
          {
            files: ["**/*.{tsx,jsx}"],
            plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
            rules: {
              ...reactHooks.configs.recommended.rules,
              ...jsxA11y.flatConfigs.strict.rules,
              // Scrollable regions must be keyboard-focusable (axe: scrollable-region-focusable).
              "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region"], tags: [] }],
            },
          },
        ]
      : [],
    next
      ? [
          {
            plugins: { "@next/next": nextPlugin },
            rules: { ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs["core-web-vitals"].rules },
          },
        ]
      : [],
    tailwindEntry
      ? [
          {
            files: ["**/*.{tsx,ts}"],
            plugins: { "better-tailwindcss": betterTailwind },
            settings: { "better-tailwindcss": { entryPoint: tailwindEntry, callees: ["cn", "cva", "clsx"] } },
            rules: {
              // Every class must exist in the Linkyo theme (default Tailwind palette is disabled).
              "better-tailwindcss/no-unknown-classes": ["error", { ignore: ["^group(?:/\\S*)?$", "^peer(?:/\\S*)?$", "^ly-"] }],
              "better-tailwindcss/no-conflicting-classes": "error",
              "better-tailwindcss/no-duplicate-classes": "error",
              "better-tailwindcss/no-deprecated-classes": "error",
            },
          },
        ]
      : [],
    {
      files: [...TEST_FILES, ...CONFIG_FILES],
      rules: {
        // Tests and tool configs describe viewports, fixtures and build settings — not UI.
        "linkyo/no-raw-design-values": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
      },
    },
    {
      // Generated pictures (link previews, story images) are drawn in pixels on a fixed canvas by
      // Satori or <canvas>, which cannot read CSS variables. Their colors still come from the theme.
      files: ["**/opengraph-image.tsx", "**/features/share/*-card.{ts,tsx}"],
      rules: { "linkyo/no-raw-design-values": "off" },
    },
    {
      files: ["**/*.{js,mjs,cjs}"],
      ...tseslint.configs.disableTypeChecked,
    },
  );
}
