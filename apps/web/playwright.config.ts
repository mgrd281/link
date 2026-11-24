import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

/**
 * E2E + accessibility + visual review. Runs against the production build (`next start`).
 * In this dev container the preinstalled Chromium is used via PW_CHROMIUM_PATH; CI installs its own.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /review\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(a11y|app|admin|templates|stars|search|try-phone|referral-signup)\.spec/ },
    { name: "review", testMatch: /review\.spec/, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `pnpm exec next start -p ${PORT}`,
      url: `http://localhost:${PORT}/en`,
      // Never test a server another worktree started: reuse only when a developer asks for it.
      reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
      timeout: 120_000,
      // Cookie-free analytics is on in tests (lib/flags.ts); production leaves it unset, so it is off.
      // A run that checks the off state sets LINKYO_ANALYTICS=off itself.
      env: { LINKYO_ANALYTICS: process.env.LINKYO_ANALYTICS ?? "on" },
    },
    // Real-mode runs (E2E_MOCKS=1) also start the local mock APIs (e2e/mocks/server.mjs).
    ...(process.env.E2E_MOCKS === "1"
      ? [{ command: "node e2e/mocks/server.mjs", url: `http://127.0.0.1:${process.env.MOCK_ANTHROPIC_PORT ?? "54399"}/health`, reuseExistingServer: false }]
      : []),
  ],
});
