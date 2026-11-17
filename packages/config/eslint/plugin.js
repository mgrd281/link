import noRawDesignValues from "./rules/no-raw-design-values.js";

/** Linkyo's own ESLint rules. */
const plugin = {
  meta: { name: "eslint-plugin-linkyo", version: "0.0.0" },
  rules: {
    "no-raw-design-values": noRawDesignValues,
  },
};

export default plugin;
