import type { BlockOf } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { BellRing, CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";

import { PlatformGlyph, platformName } from "../shared/creator-kit";

import { LiveNextRowIsland, PlannedLiveIsland } from "./live-island";
import { pageSide } from "./styles";

export { useNow } from "./live-island";
export { describeStart } from "./live-time";

type Live = BlockOf<"live">;

/**
 * Lives on a creator page. What depends on the visitor's clock (the next start in their own time,
 * "in 3 hours") is a client island (`./live-island.tsx`); its platform glyphs, icons and classes are
 * drawn here, on the server for a public page, so the visitor's browser loads no icon kit, no platform
 * logos and no picture records for it (ADR 0008).
 */

/**
 * The next planned live as one calm row: a calendar tile (TODAY · 21:00 in the visitor's own time),
 * what it is about, and a bell that adds it to the calendar. After it has passed, just the channel.
 */
export function LiveNextRow({ block, surface }: { block: Live; surface: string }) {
  return (
    <LiveNextRowIsland
      block={block}
      parts={{
        row: cn("flex scroll-mt-20 items-center gap-4 rounded-creator-card p-3", surface),
        title: cn(pageSide, "line-clamp-2 text-body font-semibold leading-snug"),
        platform: platformName(block.platform),
        glyph: <PlatformGlyph platform={block.platform} size="lg" />,
        smallGlyph: <PlatformGlyph platform={block.platform} size="sm" className="shrink-0" />,
        bell: <Icon icon={BellRing} size="md" />,
      }}
    />
  );
}

/** Hero pill: "● LIVE · TikTok" while live, or the next start when one is planned. */
export function HeroLive({ block }: { block: Live }) {
  const t = useTranslations("creator");
  const platform = platformName(block.platform);
  if (block.isLive) {
    return (
      <a
        href={block.url}
        data-block={block.id}
        className="inline-flex h-control-md items-center gap-2 rounded-full bg-danger-fill px-4 text-small font-bold tracking-wide text-danger-fill-fg uppercase transition-transform duration-micro hover:scale-lift focus-visible:focus-ring motion-reduce:hover:scale-none"
      >
        <span aria-hidden className="size-dot rounded-full bg-current motion-safe:animate-pulse" />
        {t("liveOn", { platform })}
      </a>
    );
  }
  if (!block.startsAt) return null;
  return <PlannedLiveIsland block={block} platform={platform} icon={<Icon icon={CalendarClock} size="sm" />} />;
}
