/**
 * A page address from what someone types: "Mila Aurel" becomes "mila-aurel" while it is typed.
 * Lowercase; German umlauts and ß spelled out (ä → ae, ß → ss); other accents dropped (é → e); a
 * space, "_" or "." becomes "-"; anything else that cannot be in an address is left out; never two
 * dashes in a row and never a dash at the start. A dash at the end stays while typing (so the space
 * between two words can become one) and goes once the field is left or sent (`final`).
 */
export function toSlug(raw: string, final = false): string {
  const slug = raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s_.]/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-/, "");
  return final ? slug.replace(/-$/, "") : slug;
}
