import type { BlockOf } from "@linkyo/blocks";

import { PlatformGlyph } from "../shared/creator-kit";
import { LinkIconGlyph, linkGlyph, type LinkGlyphChoice } from "../shared/link-icons";

type Primary = NonNullable<BlockOf<"contact">["primary"]>;

/**
 * The icon of a bar's action on phones: the icon the owner chose, else what its address says (mail,
 * phone, a platform …). From the column width up (`@prose`) the bar's button shows its label instead,
 * so the glyph is hidden there. Shared by the portfolio's own bar (hero.tsx) and the project page's
 * (project-page.tsx), which both give the action one 44 px button on a phone.
 */
export function BarActionGlyph({ primary }: { primary: Primary }) {
  const glyph: LinkGlyphChoice = primary.icon ? { kind: "icon", icon: primary.icon } : linkGlyph(primary.url);
  return glyph.kind === "platform" ? (
    <PlatformGlyph platform={glyph.platform} size="md" className="@prose:hidden" />
  ) : (
    <LinkIconGlyph icon={glyph.icon} size="md" className="@prose:hidden" />
  );
}
