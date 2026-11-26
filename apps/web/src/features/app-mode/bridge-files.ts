import { bridgeAvailable, post, type BridgeFile } from "./bridge";

/*
 * Files through the bridge (ADR draft "app mode"): the dashboard's downloads and shares. Apart from
 * `./bridge.ts`, so the pages that only need a haptic tap (creator pages' islands, through
 * lib/haptics.ts) do not carry them.
 */

/** A file's bytes as base64, in slices (one call with every byte would overflow the stack). */
export async function base64Of(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const SLICE = 0x8000;
  let binary = "";
  for (let at = 0; at < bytes.length; at += SLICE) binary += String.fromCharCode(...bytes.subarray(at, at + SLICE));
  return btoa(binary);
}

async function bridgeFile(file: Blob, name: string): Promise<BridgeFile> {
  return { name, mime: file.type || "application/octet-stream", base64: await base64Of(file) };
}

/**
 * In the app: hands a file the web would download to the app (`download`) and answers true. In a
 * browser: false at once, and the caller downloads it as before.
 */
export async function appDownload(file: Blob, name: string): Promise<boolean> {
  if (!bridgeAvailable()) return false;
  try {
    return post({ type: "download", ...(await bridgeFile(file, name)) });
  } catch {
    return false;
  }
}

/**
 * In the app: opens the system share sheet through the app (`share`) and answers true. In a browser:
 * false at once, and the caller uses `navigator.share` (or copies) as before.
 */
export async function appShare({
  title,
  text,
  url,
  file,
}: {
  title?: string | undefined;
  text?: string | undefined;
  url?: string | undefined;
  file?: { blob: Blob; name: string } | undefined;
}): Promise<boolean> {
  if (!bridgeAvailable()) return false;
  try {
    return post({ type: "share", title, text, url, file: file ? await bridgeFile(file.blob, file.name) : undefined });
  } catch {
    return false;
  }
}
