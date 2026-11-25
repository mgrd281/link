"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadBrowserSupabase } from "./browser";

/**
 * Signed addresses of private pictures (briefing photos, Premium story pictures). An address works
 * for ten minutes; a screen stays open far longer (an order is worked on for hours, a customer
 * compares a proposal and copies texts before downloading). So an open screen signs again well
 * before the addresses run out, and when it is looked at again.
 */

export type PrivateBucket = "briefing" | "deliverables";

/** How long a signed address works. */
export const SIGNED_SECONDS = 600;
/** When an open screen signs again. */
export const SIGN_AGAIN_MS = 8 * 60_000;

/** Is an address signed at `signedAt` too old to hand out (a tab that slept past its timer)? */
export function isStale(signedAt: number | null, now: number): boolean {
  return signedAt === null || now - signedAt >= SIGN_AGAIN_MS;
}

/** Signed addresses by path; an empty map when signing failed. `download` makes them save, not open. */
export async function signPaths(bucket: PrivateBucket, paths: readonly string[], download = false): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await (await loadBrowserSupabase())
    .storage.from(bucket)
    .createSignedUrls([...paths], SIGNED_SECONDS, download ? { download: true } : undefined);
  if (error) return new Map();
  return new Map(data.flatMap((entry) => (entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [])));
}

export interface SignedUrls {
  /** What the pictures were first shown with. It never changes, so nothing on screen reloads. */
  first: Map<string, string>;
  /** Signed again every few minutes and when the tab is looked at again: for links and downloads. */
  fresh: Map<string, string>;
  /** When `fresh` was signed (epoch ms); null before the first answer. */
  signedAt: number | null;
  /** The last attempt failed (offline, Storage down): there may be no address to hand out. */
  failed: boolean;
  /** Signs now and answers the new addresses (a click on a link that turned stale). */
  sign: () => Promise<Map<string, string>>;
}

export function useSignedUrls(bucket: PrivateBucket, paths: readonly string[], options: { download?: boolean } = {}): SignedUrls {
  const download = options.download === true;
  const [first, setFirst] = useState<Map<string, string>>(new Map());
  const [fresh, setFresh] = useState<{ urls: Map<string, string>; at: number | null; failed: boolean }>({ urls: new Map(), at: null, failed: false });
  const key = paths.join("|");
  const alive = useRef(true);
  const sign = useCallback(async () => {
    const wanted = key ? key.split("|") : [];
    const next = await signPaths(bucket, wanted, download);
    if (!alive.current) return next;
    if (next.size === 0) {
      setFresh((current) => ({ ...current, failed: wanted.length > 0 }));
      return next;
    }
    setFresh({ urls: next, at: Date.now(), failed: false });
    setFirst((current) => (wanted.every((path) => current.has(path)) ? current : next));
    return next;
  }, [bucket, key, download]);
  useEffect(() => {
    alive.current = true;
    if (!key) return;
    void sign();
    const timer = window.setInterval(() => void sign(), SIGN_AGAIN_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sign();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, sign]);
  return { first, fresh: fresh.urls, signedAt: fresh.at, failed: fresh.failed, sign };
}
