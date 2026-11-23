"use client";

import { cn, Icon } from "@linkyo/ui";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { haptic } from "@/lib/haptics";

/** How long the check mark stays before the copy icon returns (every copy confirmation on a creator page). */
export const CONFIRM_MS = 1800;

/**
 * Copies a short text in one tap (an install command, a promo code). The icon turns into a check
 * that pops in, and screen readers hear "Copied". Nothing leaves the page: the text goes to the
 * visitor's own clipboard. Where the clipboard is refused, the text stays visible to select.
 */
export function CopyButton({ value, label, className, children }: { value: string; label: string; className?: string; children?: ReactNode }) {
  const t = useTranslations("creator");
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      haptic();
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), CONFIRM_MS);
    } catch {
      // The clipboard can be refused (an insecure page, a strict browser): nothing to undo.
    }
  };
  // The live region sits beside the button, not in it: the button's name stays exactly what it shows.
  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={label}
        title={label}
        className={cn("transition-[background-color,scale] duration-micro active:scale-pressed focus-visible:focus-ring motion-reduce:active:scale-none", className)}
      >
        {children}
        <Icon key={copied ? "copied" : "copy"} icon={copied ? Check : Copy} size="sm" className={cn("shrink-0", copied && "motion-safe:animate-pop-in")} />
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </>
  );
}
