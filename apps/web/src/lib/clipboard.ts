/** Copy text; resolves false when the Clipboard API is unavailable (e.g. insecure context). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether this browser can read the clipboard on a tap. `navigator.clipboard` only exists in secure
 * contexts (HTTPS, localhost), whatever the DOM types say, so it is checked like the method.
 */
export const canReadClipboard = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const clipboard = navigator.clipboard as Clipboard | undefined;
  return typeof clipboard?.readText === "function";
};

/**
 * Reads the clipboard's text after a tap. iOS shows its own "Paste" prompt first and other browsers
 * may ask for permission; a refusal, an empty clipboard or a missing API all resolve to null.
 */
export async function readText(): Promise<string | null> {
  try {
    return (await navigator.clipboard.readText()) || null;
  } catch {
    return null;
  }
}
