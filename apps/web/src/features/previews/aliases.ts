/**
 * Earlier page links keep working: they redirect (308) to the current address. Read by the proxy.
 * - "nizar-m3e8dw": the short address of Nizar's preview.
 * - "rihana-store": the Arabic perfume shop example, renamed because the address read like a real
 *   artist's name (ADR 0058).
 */
export const PREVIEW_ALIASES: Record<string, string> = { "nizar-m3e8dw": "nizar", "rihana-store": "oud-boutique" };
