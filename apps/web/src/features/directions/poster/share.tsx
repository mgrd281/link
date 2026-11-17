"use client";

import { cn, Icon } from "@linkyo/ui";
import { Check, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { copyText } from "@/lib/clipboard";

/** Native share sheet where available (phones), otherwise copies the link. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("creator");
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href.split("?")[0] ?? window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed or blocked: fall back to copying.
      }
    }
    await copyText(url);
    setCopied(true);
  };
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
