/** @type {import("prettier").Config} */
const config = {
  printWidth: 110,
  singleQuote: false,
  trailingComma: "all",
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindFunctions: ["cn", "cva"],
};

export default config;
