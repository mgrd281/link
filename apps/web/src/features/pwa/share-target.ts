/**
 * Sharing into Linkyo (the manifest's `share_target`): Android and desktop Chrome open
 * `/<locale>/app/share?title=…&text=…&url=…` with what was shared. Apps put a link in different
 * fields: some in `url`, many in `text` ("Hör mal https://…"), a few in `title`. The first http(s)
 * address in url, then text, then title is the shared link; the dashboard's Add sheet opens holding it,
 * as if it had been pasted (`/<locale>/app?shared=<link>`, read by features/app/install/intents.ts).
 * No address, or one that does not parse: the sheet opens empty with a short note (`?shared=`).
 * iPhone and iPad have no share target for web apps; the native app will cover them.
 */

/** Longer addresses are not links someone shares; the Add sheet's field stays usable. */
export const SHARED_LINK_MAX = 2048;

/** An http(s) address inside running text, up to the next space or a character that ends one. */
const ADDRESS = /https?:\/\/[^\s<>"'`«»„“”]+/i;
/** Sentence marks that close a sentence after an address, not the address itself. */
const TRAILING = /[.,;:!?)\]}'’]+$/;

/** The address an http(s) candidate really is, without the sentence's closing marks; null when it does not parse. */
function clean(candidate: string): string | null {
  let address = candidate.replace(TRAILING, "");
  // A closing bracket belongs to the address when it opened one ("…/Linkyo_(App)").
  const opened = (address.match(/\(/g) ?? []).length;
  const closed = (address.match(/\)/g) ?? []).length;
  const tail = candidate.slice(address.length);
  if (opened > closed && tail.startsWith(")")) address += ")";
  if (address.length > SHARED_LINK_MAX) return null;
  try {
    const url = new URL(address);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The first http(s) address in what was shared (url, then text, then title), or null. */
export function sharedLink(fields: { url?: string | null; text?: string | null; title?: string | null }): string | null {
  for (const field of [fields.url, fields.text, fields.title]) {
    const found = field ? ADDRESS.exec(field) : null;
    const address = found ? clean(found[0]) : null;
    if (address) return address;
  }
  return null;
}

/** The dashboard address that opens the Add sheet holding a shared link (an empty value: none was found). */
export const sharedPath = (link: string | null) => `/app?shared=${encodeURIComponent(link ?? "")}`;
