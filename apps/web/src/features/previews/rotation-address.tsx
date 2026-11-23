"use client";

import { useEffect } from "react";

import { ROTATION_PARAM } from "./rotation-param";

/**
 * Names the next clip of the page's rotation in its own address once it has loaded (`?clip=<key>`,
 * replacing the history entry: no new step for the back button, no reload, the hash kept), so a
 * refresh shows that clip (./rotation.ts). Only the address changes: no cookie, no storage, nothing
 * sent anywhere. Without this script every visit simply shows the page's own clip.
 */
export function RotationAddress({ next }: { next: string }): null {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(ROTATION_PARAM) === next) return;
    url.searchParams.set(ROTATION_PARAM, next);
    // Next.js keeps its router in step with the native history calls (null: its own state is kept).
    window.history.replaceState(null, "", url);
  }, [next]);
  return null;
}
