/** Conventional commits: https://www.conventionalcommits.org */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["web", "ios", "tokens", "ui", "blocks", "api-client", "config", "supabase", "docs", "ci", "deps", "repo"],
    ],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
  },
};
