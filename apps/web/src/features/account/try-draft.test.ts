import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearTryDraft, readTryDraft, saveTryDraft } from "./try-draft";

const photo = { src: "data:image/jpeg;base64,/9j/4AAQSkZJRg==", tone: "light" as const };

describe("try draft", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps name, line, links, a resized photo and the look until cleared", () => {
    const theme = { template: "nocturne" as const, accent: "#ff4fa3", neutral: "#1b2a4a", tint: 1, pairing: "stage" as const, buttonStyle: "filled" as const, buttonShape: "pill" as const };
    saveTryDraft({ name: "Lea", links: ["https://example.com/a"], tagline: "DJ · Berlin", photo, theme });
    expect(readTryDraft()).toEqual({ name: "Lea", links: ["https://example.com/a"], tagline: "DJ · Berlin", photo, theme });
    clearTryDraft();
    expect(readTryDraft()).toBeNull();
  });

  it("only takes a photo that is a resized JPEG or WebP picture", () => {
    for (const src of ["https://tracker.example/pixel.png", "data:image/svg+xml;base64,PHN2Zz4=", "javascript:alert(1)", `data:image/jpeg;base64,${"A".repeat(2_000_001)}`]) {
      sessionStorage.setItem("linkyo.try", JSON.stringify({ name: "Lea", links: [], photo: { src, tone: "dark" } }));
      expect(readTryDraft()).toEqual({ name: "Lea", links: [] });
    }
  });

  it("drops a look it does not know and values that are not ours", () => {
    sessionStorage.setItem("linkyo.try", JSON.stringify({ name: "", links: [], theme: { template: "nope", accent: "#fff" } }));
    expect(readTryDraft()).toEqual({ name: "", links: [] });
    sessionStorage.setItem("linkyo.try", JSON.stringify({ name: "", links: [], theme: { template: "mono", accent: "red;x", pairing: "<b>", tint: 7 } }));
    expect(readTryDraft()).toEqual({ name: "", links: [], theme: { template: "mono" } });
  });

  it("keeps the link for the AI build only when it is a web address or a bare host", () => {
    saveTryDraft({ name: "", links: [], aiLink: "  https://lio-vance.de  " });
    expect(readTryDraft()).toEqual({ name: "", links: [], aiLink: "https://lio-vance.de" });
    saveTryDraft({ name: "", links: [], aiLink: "beacons.ai/lio" });
    expect(readTryDraft()?.aiLink).toBe("beacons.ai/lio");
    for (const aiLink of ["javascript:alert(1)", "data:text/html,hi", "not a link", `https://example.com/${"x".repeat(300)}`, ""]) {
      sessionStorage.setItem("linkyo.try", JSON.stringify({ name: "", links: [], aiLink }));
      expect(readTryDraft(), aiLink).toEqual({ name: "", links: [] });
    }
  });
});
