import type { VideoPlayback } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { ArrowRight, ArrowUpRight, AtSign, Info, Play, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { ClickToLoadIsland, NewsletterFormIsland } from "./players";

/**
 * The players and the newsletter form of a creator page, drawn where the page is rendered: on a public
 * page on the server, so their client islands (`./players.tsx`) carry no icon kit and no class merging
 * into the visitor's browser (ADR 0008). The same components render the dashboard's preview.
 */

/**
 * Click-to-load embed (brand privacy promise): nothing from YouTube/TikTok/Instagram loads until the
 * visitor taps; YouTube links play right here (privacy mode, after the tap).
 */
export function ClickToLoad({
  provider,
  title,
  poster,
  className,
  children,
  compact = false,
  marked = false,
  url,
  playback = "inline",
}: {
  provider: string;
  /** The video's link: YouTube links play right here (privacy mode, after the tap). */
  url?: string | undefined;
  /** Whole video here, a short preview then the platform, or the platform right away. */
  playback?: VideoPlayback | undefined;
  title: string;
  poster: ReactNode;
  className?: string;
  /** Overlay content (e.g. duration). */
  children?: ReactNode;
  compact?: boolean;
  /** The card already shows the company's mark (the Shorts icon): a small card then needs no "From YouTube" corner. */
  marked?: boolean;
}) {
  return (
    <ClickToLoadIsland
      provider={provider}
      url={url}
      playback={playback}
      title={title}
      poster={poster}
      compact={compact}
      marked={marked}
      classes={{
        link: cn("group/video relative isolate block w-full overflow-hidden focus-visible:focus-ring", className),
        ended: cn("relative isolate grid w-full overflow-hidden", className),
        player: cn("block w-full border-0 bg-creator-surface-2", className),
        loaded: cn("grid place-items-center gap-2 bg-creator-surface-2 p-6 text-center text-small text-creator-fg-muted", className),
        button: cn("group/video relative isolate block w-full overflow-hidden text-start focus-visible:focus-ring", className),
      }}
      icons={{
        play: <Icon icon={Play} size={compact ? "sm" : "md"} solid className="translate-x-0.5" />,
        external: <Icon icon={ArrowUpRight} size="sm" />,
        shield: <Icon icon={ShieldCheck} size="lg" className="text-creator-accent-text" />,
      }}
    >
      {children}
    </ClickToLoadIsland>
  );
}

/**
 * Newsletter sign-up: one field, one button in the creator's accent, a promise underneath. It never
 * sends anything (there is no newsletter service yet, see `./players.tsx`).
 */
export function NewsletterForm() {
  return (
    <NewsletterFormIsland
      icons={{
        info: <Icon icon={Info} size="md" />,
        email: <Icon icon={AtSign} size="md" className="shrink-0 text-creator-fg-muted" />,
        submit: <Icon icon={ArrowRight} size="md" />,
        promise: <Icon icon={ShieldCheck} size="sm" className="shrink-0" />,
      }}
    />
  );
}
