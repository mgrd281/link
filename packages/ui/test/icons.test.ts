import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ArrowUpRight,
  BadgeCheck,
  Blocks,
  ChartNoAxesColumn,
  CircleAlert,
  Contact,
  Ellipsis,
  File as FileIcon,
  FolderKanban,
  Gamepad2,
  Gift,
  Heading,
  LayoutList,
  LayoutTemplate,
  Music,
  Pencil,
  Rows2,
  Share,
  SquareUser,
  Tag,
  Trash2,
  TriangleAlert,
  Undo2,
  UsersRound,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { DIRECTIONAL, ICON_GROUPS, ICON_MEANINGS, icons, MEDIA_TRANSPORT } from "../src/icons";

describe("icon registry (S-01)", () => {
  it("covers every meaning plan §5 names, with the glyph it names", () => {
    expect(icons).toMatchObject({
      analytics: ChartNoAxesColumn,
      more: Ellipsis,
      warning: TriangleAlert,
      error: CircleAlert,
      invite: Gift,
      verified: BadgeCheck,
      external: ArrowUpRight,
      share: Share,
      edit: Pencil,
      delete: Trash2,
      undo: Undo2,
      music: Music,
      team: UsersRound,
      creators: SquareUser,
      customers: Contact,
      features: Blocks,
      portfolio: FolderKanban,
      // §5 row 4: the streamer kind is a game pad, not a platform's logo.
      gaming: Gamepad2,
    });
  });

  it("says what it means: the page is a sheet, a plan is a price tag, a section is a split box (polish pass)", () => {
    expect(icons).toMatchObject({ page: FileIcon, plan: Tag, section: Rows2 });
    // The glyphs they replaced said something else: a task list, the template layout, the letter H.
    expect(icons.page).not.toBe(LayoutList);
    expect(icons.plan).not.toBe(LayoutTemplate);
    expect(icons.section).not.toBe(Heading);
    // The template glyph keeps its own meaning.
    expect(icons.templates).toBe(LayoutTemplate);
  });

  it("gives every meaning its own glyph: no glyph means two things", () => {
    const seen = new Map<unknown, string>();
    for (const meaning of ICON_MEANINGS) {
      const glyph = icons[meaning];
      expect(seen.get(glyph), `${meaning} reuses the glyph of ${seen.get(glyph) ?? ""}`).toBeUndefined();
      seen.set(glyph, meaning);
    }
  });

  it("lists every meaning in exactly one group of the /design page", () => {
    const grouped = Object.values(ICON_GROUPS).flat();
    expect([...grouped].sort()).toEqual([...ICON_MEANINGS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("mirrors the ways through the product and none of the media controls", () => {
    for (const meaning of ["back", "forward", "next", "previous", "external", "undo", "redo", "send", "signIn", "signOut", "sidebarOpen", "sidebarClose", "increase", "decrease"] as const) {
      expect(DIRECTIONAL.has(icons[meaning]), meaning).toBe(true);
    }
    for (const meaning of ICON_GROUPS.media) {
      expect(MEDIA_TRANSPORT.has(icons[meaning]), meaning).toBe(true);
      expect(DIRECTIONAL.has(icons[meaning]), meaning).toBe(false);
    }
    for (const meaning of ["add", "close", "search", "more", "analytics", "warning", "share", "delete"] as const) {
      expect(DIRECTIONAL.has(icons[meaning]), meaning).toBe(false);
    }
  });

  it("imports none of the deprecated lucide aliases", () => {
    const source = readFileSync(path.join(import.meta.dirname, "../src/icons.ts"), "utf8");
    const imports = /import \{([^}]*)\} from "lucide-react"/.exec(source)?.[1] ?? "";
    expect(imports).toContain("ChartNoAxesColumn");
    for (const alias of ["AlertTriangle", "MoreHorizontal", "BarChart3", "Music2", "AlertCircle"]) expect(imports).not.toMatch(new RegExp(`\\b${alias}\\b`));
  });
});
