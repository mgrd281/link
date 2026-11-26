"use client";

import { useEffect } from "react";

import { useSite } from "../site-context";
import { homeIntent, offerSharedLink } from "./intents";

/**
 * On Home: opens the Add sheet that the address asks for (`?add=1`, `?shared=<link>`, see intents.ts),
 * once. The address loses the request first, so a reload or Back does not open the sheet again.
 */
export function HomeIntents() {
  const { setAddOpen } = useSite();
  useEffect(() => {
    const intent = homeIntent(window.location.search);
    if (!intent) return;
    const query = new URLSearchParams(window.location.search);
    query.delete("add");
    query.delete("shared");
    const rest = query.toString();
    // `null`, never `history.state`: see setDesignTabUrl in jump.ts.
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    if (intent.kind === "shared") offerSharedLink(intent.link);
    setAddOpen(true);
  }, [setAddOpen]);
  return null;
}
