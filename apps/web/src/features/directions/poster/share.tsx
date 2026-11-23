"use client";

import { cn, Icon } from "@linkyo/ui";
import { Check, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { copyText } from "@/lib/clipboard";
import { haptic } from "@/lib/haptics";

import { CONFIRM_MS } from "../shared/copy-button";

/** What the last tap did: nothing to say yet, the address was copied, or copying was refused. */
type Outcome = "idle" | "copied" | "failed";

/**
 * Shares the page: the native share sheet where there is one (phones). Where there is none, or the
 * browser refuses it (not allowed, a bad call), the page's address (without query or fragment) is
 * copied instead. A visitor who closes the share sheet has decided: nothing is copied and nothing is
 * said. No third-party code.
 */
function useShare(title: string): { share: () => Promise<void>; outcome: Outcome; reset: () => void } {
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Dismissed by the visitor: their choice, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    if (await copyText(url)) {
      haptic();
      setOutcome("copied");
    } else setOutcome("failed");
  };
  const reset = useCallback(() => setOutcome("idle"), []);
  return { share, outcome, reset };
}

/** "Link copied." or "The link could not be copied." for the polite live region; nothing otherwise. */
function useAnnouncement(outcome: Outcome): string {
  const t = useTranslations("creator");
  return outcome === "copied" ? t("shareCopied") : outcome === "failed" ? t("shareFailed") : "";
}

/** The check stays as long as on every copy button of a creator page, then the share icon returns. */
function useConfirmation(outcome: Outcome, reset: () => void): void {
  useEffect(() => {
    if (outcome === "idle") return;
    const timer = window.setTimeout(reset, CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [outcome, reset]);
}

/** Native share sheet where available (phones), otherwise copies the link. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("creator");
  const { share, outcome, reset } = useShare(title);
  useConfirmation(outcome, reset);
  const announcement = useAnnouncement(outcome);
  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        aria-label={t("share")}
        className={cn("grid size-touch-target shrink-0 place-items-center rounded-full text-creator-fg transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring", className)}
      >
        <Icon icon={outcome === "copied" ? Check : Share} size="md" />
      </button>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}

/**
 * A labelled share button (Laufbahn's hero): icon and "Share". Its label never changes, so the name a
 * voice-control user says is always the one they see (WCAG 2.5.3): where the address is copied, only
 * the icon turns into a check for a moment, and a polite live region says "Link copied." (or that it
 * could not be copied).
 */
export function ShareAction({ title, label, className }: { title: string; label: string; className?: string }): ReactNode {
  const { share, outcome, reset } = useShare(title);
  useConfirmation(outcome, reset);
  const announcement = useAnnouncement(outcome);
  return (
    <>
      <button type="button" onClick={() => void share()} className={className}>
        <Icon key={outcome === "copied" ? "copied" : "share"} icon={outcome === "copied" ? Check : Share} size="md" className={cn("shrink-0", outcome === "copied" && "motion-safe:animate-pop-in")} />
        <span>{label}</span>
      </button>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
