"use client";

import { cn, Icon } from "@linkyo/ui";
import { ArrowRight, AtSign, Check, Play, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { usePrivacyChoice } from "./privacy";

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
  // Once a visitor has allowed external content, the per-player notice is no longer needed.
  const allowed = usePrivacyChoice() === "media";
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
          {allowed ? <span /> : <span className="rounded-full bg-creator-glass px-2 py-1 text-creator-fg backdrop-blur-glass">{t("loadsFrom", { provider })}</span>}
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Newsletter sign-up: one field, one button in the creator's accent, a promise underneath. Stacks on
 * phones (a thumb-wide button), sits side by side on wide screens. Double opt-in: the confirmation
 * says to check the inbox, as the law (and good manners) require.
 */
export function NewsletterForm() {
  const t = useTranslations("creator");
  const id = useId();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  if (state === "done") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-creator-button bg-creator-bg p-4">
        <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-creator-accent text-creator-accent-fg">
          <Icon icon={Check} size="md" />
        </span>
        <span className="grid min-w-0 gap-0.5">
          <span className="text-body font-semibold">{t("subscribedTitle")}</span>
          <span className="text-small text-creator-fg-muted">{t("subscribedBody")}</span>
        </span>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setState("sending");
        // Demo: the real request goes to the newsletter service in Phase 1.
        window.setTimeout(() => setState("done"), 500);
      }}
      className="grid grid-cols-1 gap-3"
    >
      <div className="grid grid-cols-1 gap-2 @prose:grid-cols-[minmax(0,1fr)_auto]">
        <label
          htmlFor={id}
          className="flex h-control-lg min-w-0 items-center gap-3 rounded-creator-button border border-creator-line-strong bg-creator-bg px-4 transition-colors duration-micro focus-within:border-creator-accent-text focus-within:focus-ring"
        >
          <Icon icon={AtSign} size="md" className="shrink-0 text-creator-fg-muted" />
          <span className="sr-only">{t("emailLabel")}</span>
          <input
            id={id}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            placeholder={t("emailPlaceholder")}
            className="h-full w-full min-w-0 bg-transparent text-start text-body text-creator-fg outline-none placeholder:text-creator-fg-muted rtl:text-end"
          />
        </label>
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex h-control-lg w-full items-center justify-center gap-2 rounded-creator-button bg-creator-accent px-6 text-body font-semibold text-creator-accent-fg shadow-e1 transition-[scale,opacity] duration-micro focus-visible:focus-ring active:scale-pressed disabled:opacity-secondary @prose:w-auto"
        >
          {t("subscribe")}
          <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
        </button>
      </div>
      <p className="flex items-center gap-2 text-caption text-creator-fg-muted">
        <Icon icon={ShieldCheck} size="sm" className="shrink-0" />
        {t("newsletterPromise")}
      </p>
    </form>
  );
}
