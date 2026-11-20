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

  it("keeps name, links and a resized photo until cleared", () => {
    saveTryDraft({ name: "Lea", links: ["https://example.com/a"], photo });
    expect(readTryDraft()).toEqual({ name: "Lea", links: ["https://example.com/a"], photo });
    clearTryDraft();
    expect(readTryDraft()).toBeNull();
  });

  it("only takes a photo that is a resized JPEG or WebP picture", () => {
    for (const src of ["https://tracker.example/pixel.png", "data:image/svg+xml;base64,PHN2Zz4=", "javascript:alert(1)", `data:image/jpeg;base64,${"A".repeat(2_000_001)}`]) {
      sessionStorage.setItem("linkyo.try", JSON.stringify({ name: "Lea", links: [], photo: { src, tone: "dark" } }));
      expect(readTryDraft()).toEqual({ name: "Lea", links: [] });
    }
  });
});
