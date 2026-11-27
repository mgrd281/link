import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // "server-only" is Next's compiler marker (it fails a client bundle); outside Next it is an empty module.
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
  // lazy-parts.vitest.ts: the parts creator pages load lazily, as the server renders them (ADR 0008).
  test: { include: ["src/**/*.test.ts"], setupFiles: ["src/lazy-parts.vitest.ts"] },
});
