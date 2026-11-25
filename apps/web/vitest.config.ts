import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // lazy-parts.vitest.ts: the parts creator pages load lazily, as the server renders them (ADR 0008).
  test: { include: ["src/**/*.test.ts"], setupFiles: ["src/lazy-parts.vitest.ts"] },
});
