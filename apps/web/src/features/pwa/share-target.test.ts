import { describe, expect, it, vi } from "vitest";

import { safeNext } from "@/features/account/auth/shared";
import { homeIntent, INTENT_RETURN, intentReturnPath } from "@/features/app/install/intents";

import { SHARED_LINK_MAX, sharedLink, sharedPath } from "./share-target";

// Sign-in's hooks module also holds `safeNext`; its router is not needed here (it needs Next's runtime).
vi.mock("@/i18n/navigation", () => ({ useRouter: () => null }));

/**
 * Sharing into Linkyo: the first http(s) address in url, text or title, without the sentence around
 * it; the way to Home with the Add sheet holding it; and the way back after sign-in, which lets exactly
 * those addresses through.
 */
describe("the shared link", () => {
  it("is the first http(s) address, url first, then text, then title", () => {
    expect(sharedLink({ text: "Hör mal https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" })).toBe("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(sharedLink({ url: "https://youtu.be/abc", text: "Seen https://example.com/x" })).toBe("https://youtu.be/abc");
    expect(sharedLink({ url: "", text: "nothing here", title: "Mila https://mila.example/shop" })).toBe("https://mila.example/shop");
    expect(sharedLink({ text: "two: https://a.example/1 and https://b.example/2" })).toBe("https://a.example/1");
  });

  it("leaves the sentence's own marks out and keeps brackets that belong to the address", () => {
    expect(sharedLink({ text: "Schau: https://example.com/a." })).toBe("https://example.com/a");
    expect(sharedLink({ text: "(siehe https://example.com/b)" })).toBe("https://example.com/b");
    expect(sharedLink({ text: "„https://example.com/c“" })).toBe("https://example.com/c");
    expect(sharedLink({ text: "https://de.wikipedia.org/wiki/Linkyo_(App)." })).toBe("https://de.wikipedia.org/wiki/Linkyo_(App)");
  });

  it("is none for text without an address, other schemes, hosts without a dot and overlong addresses", () => {
    expect(sharedLink({ text: "Hör mal rein!", title: "Song" })).toBeNull();
    expect(sharedLink({ url: "javascript:alert(1)", text: "mailto:a@b.de" })).toBeNull();
    expect(sharedLink({ text: "http://localhost:3000/x" })).toBeNull();
    expect(sharedLink({ url: `https://example.com/${"a".repeat(SHARED_LINK_MAX)}` })).toBeNull();
    expect(sharedLink({})).toBeNull();
  });

  it("leads to Home holding it, or empty", () => {
    expect(sharedPath("https://example.com/a?b=1&c=2")).toBe("/app?shared=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1%26c%3D2");
    expect(sharedPath(null)).toBe("/app?shared=");
  });
});

describe("Home's intents", () => {
  it("reads the shortcut and the share, and checks the shared address again", () => {
    expect(homeIntent("?add=1")).toEqual({ kind: "add" });
    expect(homeIntent("?shared=https%3A%2F%2Fexample.com%2Fa")).toEqual({ kind: "shared", link: "https://example.com/a" });
    expect(homeIntent("?shared=")).toEqual({ kind: "shared", link: null });
    expect(homeIntent("?shared=javascript%3Aalert(1)")).toEqual({ kind: "shared", link: null });
    expect(homeIntent("?source=app")).toBeNull();
    expect(homeIntent("")).toBeNull();
  });

  it("come back after sign-in, and only Home's intents carry a query through it", () => {
    const back = intentReturnPath("/app", "?shared=https%3A%2F%2Fopen.spotify.com%2Ftrack%2Fx");
    expect(back).toBe("/app?shared=https%3A%2F%2Fopen.spotify.com%2Ftrack%2Fx");
    expect(safeNext(back)).toBe(back);
    expect(safeNext(intentReturnPath("/app", "?add=1"))).toBe("/app?add=1");
    expect(safeNext(intentReturnPath("/app", "?shared="))).toBe("/app?shared=");
    // Other screens keep only their path, as before.
    expect(intentReturnPath("/app/design", "?tab=fonts")).toBe("/app/design");
    expect(safeNext("/app/design")).toBe("/app/design");
  });

  it("let nothing else through sign-in", () => {
    for (const value of ["/app?next=//evil.example", "/app?shared=https://evil.example", "/app?shared=a b", "/app?add=2", "/app/?shared=x", "//evil.example/app?add=1", "/app?add=1&x=1"]) {
      expect(INTENT_RETURN.test(value), value).toBe(false);
      expect(safeNext(value), value).toBeNull();
    }
  });
});
