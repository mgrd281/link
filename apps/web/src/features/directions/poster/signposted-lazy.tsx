"use client";

import dynamic from "next/dynamic";

/**
 * The body of a signposted page (Laufbahn: its bar with the page's contents, the bleed hero, the index
 * beside the sections, `./signposted.tsx`), loaded with the pages that show it. A client module, so
 * the import below splits off its own chunk: the body renders on the server as before, but its code
 * comes with Laufbahn's pages only and never with the pages of other templates (ADR 0008's page budget).
 */
export const SignpostedBody = dynamic(() => import("./signposted"));
