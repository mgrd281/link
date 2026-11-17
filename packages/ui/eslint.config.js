import { createConfig } from "@linkyo/config/eslint";

export default createConfig({
  react: true,
  tailwindEntry: "src/theme.css",
  tsconfigRootDir: import.meta.dirname,
});
