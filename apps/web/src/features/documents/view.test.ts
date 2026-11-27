import { describe, expect, it, vi } from "vitest";

import type * as Build from "./build";
import { jonasDe } from "./fixtures";
import { documentsView } from "./view";

// A failure in the documents (a font file the server cannot read, a layout that throws) must never
// take the page down: the page renders without its documents.
vi.mock("./build", async (original) => ({
  ...(await original<typeof Build>()),
  documentShape: () => Promise.reject(new Error("ENOENT: Geist-Regular.ttf")),
}));

describe("documentsView when the documents fail", () => {
  it("offers nothing instead of throwing", async () => {
    await expect(documentsView(jonasDe(), { base: "/de/p/jonas-brandt", signposted: true, now: new Date("2026-11-26T10:00:00Z"), asOf: null, publicAddress: null })).resolves.toBeNull();
  });
});
