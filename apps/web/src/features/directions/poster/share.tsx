"use client";

import { cn, Icon } from "@linkyo/ui";
import { Check, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { copyText } from "@/lib/clipboard";

/** How long "Link copied" stays on a labelled share button before it reads "Share" again. */
const COPIED_FOR = 2400;

/**
 * Shares the page: the native share sheet where there is one (phones), otherwise the page's address
 * (without query or fragment) is copied and `copied` turns true. No third-party code.
 */
function useShare(title: string): { share: () => Promise<void>; copied: boolean; reset: () => void } {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed or blocked: fall back to copying.
      }
    }
    if (await copyText(url)) setCopied(true);
  };
  const reset = useCallback(() => setCopied(false), []);
  return { share, copied, reset };
}

/** Native share sheet where available (phones), otherwise copies the link. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("creator");
  const { share, copied } = useShare(title);
  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        aria-label={t("share")}
        className={cn("grid size-touch-target shrink-0 place-items-center rounded-full text-creator-fg transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring", className)}
      >
        <Icon icon={copied ? Check : Share} size="md" />
      </button>
      <span role="status" className="sr-only">
        {copied ? t("shareCopied") : ""}
      </span>
    </>
  );
}

/**
 * A labelled share button (Laufbahn's hero): icon and "Share". Where the page's address is copied
 * instead of shared, the label reads "Copied" for a moment (`copiedLabel`, a short word) and a polite
 * live region says "Link copied." The button keeps its width while the label changes (both labels
 * share one grid cell).
 */
export function ShareAction({ title, label, copiedLabel, className }: { title: string; label: string; copiedLabel: string; className?: string }): ReactNode {
  const t = useTranslations("creator");
  const { share, copied, reset } = useShare(title);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(reset, COPIED_FOR);
    return () => window.clearTimeout(timer);
  }, [copied, reset]);
  return (
    <>
      {/* The name stays "Share" while the label briefly reads "Link copied" (the live region says that). */}
      <button type="button" onClick={() => void share()} aria-label={label} className={className}>
        <Icon icon={copied ? Check : Share} size="md" className="shrink-0" />
        <span className="grid">
          <span className={cn("col-start-1 row-start-1", copied && "invisible")}>{label}</span>
          <span aria-hidden className={cn("col-start-1 row-start-1", !copied && "invisible")}>
            {copiedLabel}
          </span>
        </span>
      </button>
      <span role="status" className="sr-only">
        {copied ? t("shareCopied") : ""}
      </span>
    </>
  );
}
