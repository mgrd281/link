"use client";

import { useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import { haptic } from "@/lib/haptics";

import { CONFIRM_MS } from "./copy-confirm";

/**
 * Copies a short text in one tap (an install command, a promo code). The icon turns into a check
 * that pops in, and screen readers hear "Copied". Nothing leaves the page: the text goes to the
 * visitor's own clipboard. Where the clipboard is refused, the text stays visible to select. Its
 * class and icons come whole from where the page is rendered (`./copy-button.tsx`).
 */
export function CopyButtonIsland({
  value,
  label,
  className,
  icons,
  children,
}: {
  value: string;
  label: string;
  className: string;
  icons: { copy: ReactNode; copied: ReactNode };
  children?: ReactNode;
}) {
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
      <button type="button" onClick={() => void copy()} aria-label={label} title={label} className={className}>
        {children}
        {/* A new element each time, so the check pops in again. */}
        <Fragment key={copied ? "copied" : "copy"}>{copied ? icons.copied : icons.copy}</Fragment>
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </>
  );
}
