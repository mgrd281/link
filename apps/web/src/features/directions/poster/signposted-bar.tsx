"use client";

import dynamic from "next/dynamic";

/**
 * Laufbahn's parts of the page's bar (the section switcher and the reveal), loaded with the pages that
 * show them. A client module, so the import below splits off its own chunk: rendered on the server as
 * before, its code comes with Laufbahn's pages only and never with the pages of other templates (ADR
 * 0008's page budget; a server-side `next/dynamic` still sends its client code with every page).
 */
export const SectionSwitcher = dynamic(() => import("./laufbahn-index").then((module) => module.SectionSwitcher));
export const BarReveal = dynamic(() => import("./laufbahn-index").then((module) => module.BarReveal));
