/**
 * Two ways into the Add sheet from outside the dashboard, both through Home's address:
 *
 * - `?add=1`: the installed app's "Block hinzufügen" shortcut (features/pwa/manifest.ts).
 * - `?shared=<link>`: the share target (`/<locale>/app/share`, features/pwa/share-target.ts) found this
 *   link in what another app shared; an empty value means it found none.
 *
 * Home opens the sheet (`HomeIntents`); the sheet holds the shared link in its field, as if it had been
 * pasted, or says that nothing was found. Signed out, the dashboard's gate sends the visitor to sign in
 * with this address as the way back (`intentReturnPath`), and sign-in lets exactly these addresses
 * through (`INTENT_RETURN`, used by `safeNext`).
 */

import { sharedLink } from "@/features/pwa/share-target";

export type HomeIntent = { kind: "add" } | { kind: "shared"; link: string | null };

/**
 * What Home's address asks for, if anything. A shared link is checked again here (anyone can type
 * such an address): only an http(s) address reaches the sheet, anything else counts as none found.
 */
export function homeIntent(search: string): HomeIntent | null {
  const query = new URLSearchParams(search);
  const shared = query.get("shared");
  if (shared !== null) return { kind: "shared", link: sharedLink({ url: shared }) };
  return query.get("add") === "1" ? { kind: "add" } : null;
}

/** Home's address for an intent, in the form `INTENT_RETURN` accepts. */
export const intentPath = (intent: HomeIntent) => (intent.kind === "add" ? "/app?add=1" : `/app?shared=${encodeURIComponent(intent.link ?? "")}`);

/** The addresses sign-in may return to with an intent (no other query passes `safeNext`). */
export const INTENT_RETURN = /^\/app\?(?:add=1|shared=[\w.!~*'()%-]*)$/;

/**
 * Where sign-in should lead back to from a dashboard address: Home with its intent where there is
 * one, otherwise the path alone, as before (a query on another screen is dropped).
 */
export function intentReturnPath(pathname: string, search: string): string {
  const intent = pathname === "/app" ? homeIntent(search) : null;
  return intent ? intentPath(intent) : pathname;
}

/*
 * A shared link on its way to the Add sheet. Home offers it, the sheet takes it when it opens (each
 * offer once, by its id), so the sheet's field holds the link exactly when it was shared.
 */
export interface SharedOffer {
  id: number;
  /** The link, or null: something was shared, but no link was found in it. */
  link: string | null;
}

let offer: SharedOffer | null = null;
let lastId = 0;
const listeners = new Set<() => void>();

export function offerSharedLink(link: string | null): void {
  lastId += 1;
  offer = { id: lastId, link };
  for (const listener of listeners) listener();
}

export const readSharedOffer = (): SharedOffer | null => offer;

/** The sheet has the offer in its field: it is not offered again (a sheet mounted later starts empty). */
export function takeSharedOffer(id: number): void {
  if (offer?.id !== id) return;
  offer = null;
  for (const listener of listeners) listener();
}

export function subscribeSharedOffer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
