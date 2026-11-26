import { afterEach, describe, expect, it, vi } from "vitest";

import { appHaptic, bridgeAvailable, HANDLER, openExternal, post } from "./bridge";
import { appDownload, appDownloadFrom, appShare, base64Of } from "./bridge-files";

/**
 * The bridge against a stand-in WKWebView: `webkit.messageHandlers.linkyo` records what it is given.
 * `app`: <html data-app="ios"> (the app's signal); `frame`: the page runs inside a frame;
 * `handler`: none, one that records, or one that throws.
 */
function webView({ app = true, frame = false, handler = "records" }: { app?: boolean; frame?: boolean; handler?: "none" | "records" | "throws" } = {}) {
  const posted: unknown[] = [];
  const postMessage = vi.fn((body: unknown) => {
    if (handler === "throws") throw new Error("the app went away");
    posted.push(body);
  });
  const win: Record<string, unknown> = {
    location: { origin: "https://linkyo.app" },
    webkit: handler === "none" ? { messageHandlers: {} } : { messageHandlers: { [HANDLER]: { postMessage } } },
  };
  win.self = win;
  win.top = frame ? { other: true } : win;
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { documentElement: { dataset: app ? { app: "ios" } : {} } });
  return { posted, postMessage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The bytes a base64 string holds. */
const bytesOf = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

describe("post", () => {
  it("sends a plain copy of the message in the app, from the main frame", () => {
    const { posted } = webView();
    expect(bridgeAvailable()).toBe(true);
    expect(post({ type: "route", path: "/de/app/settings/plan", title: "Plan", back: "/de/app/settings" })).toBe(true);
    expect(post({ type: "share", url: "https://linkyo.app/mila", title: undefined })).toBe(true);
    expect(posted).toEqual([
      { type: "route", path: "/de/app/settings/plan", title: "Plan", back: "/de/app/settings" },
      // Undefined fields are dropped: the app reads a clean dictionary.
      { type: "share", url: "https://linkyo.app/mila" },
    ]);
    expect(Object.keys(posted[1] as object)).toEqual(["type", "url"]);
  });

  it("sends nothing in a browser, even where a page has a handler of that name", () => {
    const { postMessage } = webView({ app: false });
    expect(bridgeAvailable()).toBe(false);
    expect(post({ type: "ready", signedIn: true, accountId: "a" })).toBe(false);
    expect(appHaptic()).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("sends nothing from a frame: only the main frame speaks for the app", () => {
    const { postMessage } = webView({ frame: true });
    expect(bridgeAvailable()).toBe(false);
    expect(post({ type: "editClosed", id: "b1" })).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("never throws: no handler, a handler that throws, a window that cannot be read", () => {
    webView({ handler: "none" });
    expect(bridgeAvailable()).toBe(false);
    expect(post({ type: "haptic", style: "light" })).toBe(false);

    webView({ handler: "throws" });
    expect(() => post({ type: "haptic", style: "light" })).not.toThrow();
    expect(post({ type: "haptic", style: "light" })).toBe(false);

    const hostile = {};
    Object.defineProperty(hostile, "top", {
      get() {
        throw new Error("blocked");
      },
    });
    vi.stubGlobal("window", hostile);
    expect(() => post({ type: "haptic", style: "light" })).not.toThrow();
    expect(bridgeAvailable()).toBe(false);
  });

  it("is false on the server", () => {
    expect(bridgeAvailable()).toBe(false);
    expect(post({ type: "ready", signedIn: false, accountId: null })).toBe(false);
  });
});

describe("files and sharing", () => {
  it("hands a download to the app with its name, type and bytes as base64", async () => {
    const { posted } = webView();
    const json = JSON.stringify({ page: { profile: { displayName: "Mila Aurel" } } });
    expect(await appDownload(new Blob([json], { type: "application/json" }), "linkyo-mila-export.json")).toBe(true);
    const [message] = posted as [{ type: string; name: string; mime: string; base64: string }];
    expect(message).toMatchObject({ type: "download", name: "linkyo-mila-export.json", mime: "application/json" });
    expect(new TextDecoder().decode(bytesOf(message.base64))).toBe(json);
  });

  it("encodes a large file whole (more bytes than one call may spread)", async () => {
    const bytes = new Uint8Array(200_000).map((_, at) => (at * 31) % 256);
    expect(bytesOf(await base64Of(new Blob([bytes])))).toEqual(bytes);
  });

  it("names a file without a type as plain bytes", async () => {
    const { posted } = webView();
    await appDownload(new Blob(["x"]), "x.bin");
    expect(posted[0]).toMatchObject({ mime: "application/octet-stream" });
  });

  it("shares a link, words and a picture through the app", async () => {
    const { posted } = webView();
    const png = new Uint8Array([137, 80, 78, 71]);
    expect(await appShare({ title: "linkyo.app/mila", url: "https://linkyo.app/mila", file: { blob: new Blob([png], { type: "image/png" }), name: "linkyo-mila-story.png" } })).toBe(true);
    expect(await appShare({ title: "Linkyo", text: "Komm zu Linkyo", url: "https://linkyo.app/i/abc" })).toBe(true);
    const [withFile, plain] = posted as [{ file: { name: string; mime: string; base64: string } }, object];
    expect(withFile).toMatchObject({ type: "share", title: "linkyo.app/mila", url: "https://linkyo.app/mila", file: { name: "linkyo-mila-story.png", mime: "image/png" } });
    expect(bytesOf(withFile.file.base64)).toEqual(png);
    expect(plain).toEqual({ type: "share", title: "Linkyo", text: "Komm zu Linkyo", url: "https://linkyo.app/i/abc" });
  });

  it("answers false in a browser at once, so the caller downloads or shares as before", async () => {
    const { postMessage } = webView({ app: false });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await appDownload(new Blob(["a"]), "a.txt")).toBe(false);
    expect(await appDownloadFrom("https://storage.example/story.png", "linkyo-story-1.png")).toBe(false);
    expect(await appShare({ url: "https://linkyo.app/mila" })).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
    // A browser links to the file itself: nothing is fetched for it.
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches a file on another host (a signed Storage address) and hands its bytes to the app", async () => {
    const { posted } = webView();
    const jpeg = new Uint8Array([255, 216, 255, 224]);
    const fetcher = vi.fn(() => Promise.resolve(new Response(jpeg, { headers: { "content-type": "image/jpeg" } })));
    vi.stubGlobal("fetch", fetcher);
    const signed = "https://project.supabase.co/storage/v1/object/sign/deliverables/a/b/c.jpg?token=t&download=";
    expect(await appDownloadFrom(signed, "linkyo-story-1.jpg")).toBe(true);
    // No cookie goes along: the signed address is the whole permission.
    expect(fetcher).toHaveBeenCalledWith(signed, { credentials: "omit" });
    const [message] = posted as [{ type: string; name: string; mime: string; base64: string }];
    expect(message).toMatchObject({ type: "download", name: "linkyo-story-1.jpg", mime: "image/jpeg" });
    expect(bytesOf(message.base64)).toEqual(jpeg);
  });

  it("answers false, and sends nothing, when the file cannot be fetched (the caller says so)", async () => {
    const { postMessage } = webView();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("expired", { status: 400 }))));
    expect(await appDownloadFrom("https://project.supabase.co/x", "x.jpg")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    expect(await appDownloadFrom("https://project.supabase.co/x", "x.jpg")).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe("haptics and Safari", () => {
  it("asks the app for a light tap", () => {
    const { posted } = webView();
    expect(appHaptic()).toBe(true);
    expect(posted).toEqual([{ type: "haptic", style: "light" }]);
  });

  it("opens an address of this site in Safari, never another host", () => {
    const { posted } = webView();
    expect(openExternal("/de/agb")).toBe(true);
    expect(openExternal("https://evil.example/agb")).toBe(false);
    expect(openExternal("//evil.example/agb")).toBe(false);
    expect(posted).toEqual([{ type: "openExternal", url: "https://linkyo.app/de/agb" }]);
  });
});
