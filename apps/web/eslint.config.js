import { createConfig } from "@linkyo/config/eslint";

export default [
  ...createConfig({ react: true, next: true, tailwindEntry: "src/app/globals.css", tsconfigRootDir: import.meta.dirname }),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // next-intl deprecates these in favor of `next/root-params`, which is still experimental in
      // Next 16.4 (experimental.rootParams). Migrate when it is stable — see docs/DECISIONS/0006.
      "@typescript-eslint/no-deprecated": [
        "error",
        { allow: [{ from: "package", package: "next-intl", name: ["setRequestLocale", "requestLocale"] }] },
      ],
    },
  },
  { ignores: ["public/**", ".next/**"] },
];
