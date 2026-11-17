import { createConfig } from "@linkyo/config/eslint";

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The tokens package is the one place allowed to define raw design values.
    rules: { "linkyo/no-raw-design-values": "off" },
  },
  { ignores: ["scripts/**", "dist/**", "src/generated/**"] },
];
