import type { Block, CreatorKind } from "@linkyo/blocks";

import { titleKeys } from "./kinds";

/**
 * A new portfolio section as the owner first sees it: the kind's title (always editable), the closing
 * line of a contact block, and one quote to fill in (it is saved only once its owner confirms they
 * may publish it). `text` reads a key under app.portfolio. A module of its own, so the Home screen can
 * start a section without loading the project sheet (ADR 0008).
 */
export function startedBlock(block: Block, kind: CreatorKind | undefined, text: (key: string) => string): Block {
  const titles = titleKeys(kind);
  switch (block.type) {
    case "about":
      return { ...block, title: text(titles.about) };
    case "tools":
      return { ...block, title: text(titles.tools) };
    case "timeline":
      return { ...block, title: text(titles.timeline) };
    case "quotes":
      return { ...block, title: text(titles.quotes), items: block.items.length > 0 ? block.items : [{ text: "", name: "", role: "", consent: false as unknown as true }] };
    case "contact":
      return { ...block, title: block.title || text("contact.closing") };
    default:
      return block;
  }
}
