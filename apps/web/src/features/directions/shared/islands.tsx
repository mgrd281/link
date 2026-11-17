"use client";

import { cn, Icon } from "@linkyo/ui";
import { Check, Play, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

/**
 * Click-to-load embed (brand privacy promise): nothing from YouTube/TikTok/Instagram loads until the
 * visitor taps. Phase 0 shows the post-tap state as a placeholder; Phase 1 swaps in the nocookie player.
 */
export function ClickToLoad({
  provider,
  title,
  poster,
  className,
  children,
  compact = false,
}: {
  provider: string;
  title: string;
  poster: ReactNode;
  className?: string;
  /** Overlay content (e.g. duration). */
  children?: ReactNode;
  compact?: boolean;
}) {
  const t = useTranslations("creator");
  const [loaded, setLoaded] = useState(false);
  if (loaded) {
    return (
      <div
        className={cn("grid place-items-center gap-2 bg-creator-surface-2 p-6 text-center text-small text-creator-fg-muted", className)}
        role="status"
      >
        <Icon icon={ShieldCheck} size="lg" className="text-creator-accent-text" />
        <p className="max-w-prose">{t("playerHere")}</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className={cn("group/video relative isolate block w-full overflow-hidden text-start focus-visible:focus-ring", className)}
    >
      <span className="sr-only">{t("playVideo", { title })}</span>
      {poster}
      <span className="absolute inset-0 grid place-items-center" aria-hidden>
        <span
          className={cn(
            "grid place-items-center rounded-full bg-creator-accent text-creator-accent-fg shadow-e3",
            "transition-[scale] duration-standard ease-standard group-hover/video:scale-lift motion-reduce:transition-none",
            compact ? "size-control-md" : "size-control-xl",
          )}
        >
          <Icon icon={Play} size={compact ? "sm" : "md"} className="translate-x-0.5 fill-current" />
        </span>
      </span>
      {!compact ? (
        <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-caption">
          <span className="rounded-full bg-creator-glass px-2 py-1 text-creator-fg backdrop-blur-glass">{t("loadsFrom", { provider })}</span>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function NewsletterForm() {
  const t = useTranslations("creator");
  const id = useId();
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <p role="status" className="flex items-center gap-2 text-small font-medium text-creator-accent-text">
        <Icon icon={Check} size="sm" />
        {t("subscribed")}
      </p>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setDone(true);
      }}
      className="flex gap-2"
    >
      <label htmlFor={id} className="sr-only">
        {t("emailLabel")}
      </label>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        className="h-control-lg w-full min-w-0 flex-1 rounded-creator-button border border-creator-line-strong bg-creator-surface px-4 text-body text-creator-fg placeholder:text-creator-fg-muted focus-visible:focus-ring"
      />
      <button
        type="submit"
        className="h-control-lg shrink-0 rounded-creator-button bg-creator-accent px-5 text-body font-medium text-creator-accent-fg transition-[scale] duration-micro active:scale-pressed focus-visible:focus-ring"
      >
        {t("subscribe")}
      </button>
    </form>
  );
}
