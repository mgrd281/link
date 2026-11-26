/*
 * The editor's deep link: `/<locale>/app/editor?edit=<blockId>` opens that block's edit sheet. The
 * iPhone app pushes it to edit one block from its own list (ADR 0087); any link may use it.
 */

/** The query parameter: `?edit=<blockId>`. */
export const EDIT_PARAM = "edit";

/** The block a `?edit=` asks for, when the page has it; an unknown or empty id opens nothing. */
export function editLinkTarget(requested: string | null, ids: readonly string[]): string | null {
  if (!requested) return null;
  return ids.includes(requested) ? requested : null;
}

/**
 * What a `?edit=` link does: open the block's sheet, or (no such block: deleted on another device, a
 * stale list) tell the iPhone app at once that nothing opened, `editClosed` with `missing`, so it can
 * return to its own list instead of showing an editor waiting for a sheet. Null for no request.
 */
export function editLinkOutcome(
  requested: string | null,
  ids: readonly string[],
): { open: string } | { closed: { type: "editClosed"; id: string; missing: true } } | null {
  if (requested === null) return null;
  const target = editLinkTarget(requested, ids);
  return target ? { open: target } : { closed: { type: "editClosed", id: requested, missing: true } };
}

/** The address without `edit`, every other parameter and the hash kept. */
export function withoutEditParam({ pathname, search, hash }: { pathname: string; search: string; hash: string }): string {
  const query = new URLSearchParams(search);
  query.delete(EDIT_PARAM);
  const rest = query.toString();
  return `${pathname}${rest ? `?${rest}` : ""}${hash}`;
}
