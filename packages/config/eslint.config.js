import { createConfig } from "./eslint/index.js";

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // Rule tests and fixtures intentionally contain raw values.
    ignores: ["test/**", "token-guard/patterns.js"],
  },
];
