"use client";

import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Button, cn, Icon, IconButton } from "@linkyo/ui";
import { ExternalLink, Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";

import { PosterRenderer } from "@/features/directions/poster/renderer";
import { Link } from "@/i18n/navigation";

import { useSite } from "./site-context";

/** The creator's page, rendered by the real renderer at phone width (container queries do the rest). */
export function PhonePreview({ className }: { className?: string }) {
  const { previewPage, doc } = useSite();
  const theme = useMemo(() => resolveCreatorTheme(doc.theme, { rtlScript: previewPage.profile.locale === "ar" }), [doc.theme, previewPage.profile.locale]);
  return (
    <div className={cn("relative mx-auto w-full max-w-preview overflow-hidden rounded-xl border border-line-strong bg-ink p-1 shadow-e3", className)}>
      <div className="relative size-full overflow-hidden rounded-lg" style={{ transform: "translateZ(0)" }}>
        <div className="absolute inset-0 overflow-y-auto overscroll-contain" tabIndex={0} role="region" aria-label={previewPage.profile.displayName}>
          <PosterRenderer page={previewPage} theme={theme} preview />
        </div>
      </div>
    </div>
  );
}

/** Extra-wide screens: the page stays visible next to whatever you edit. */
export function PreviewAside() {
  const t = useTranslations("app.preview");
  const { previewHref } = useSite();
  return (
    <aside aria-label={t("label")} className="sticky top-0 hidden h-dvh w-preview shrink-0 box-content flex-col gap-3 border-s border-line bg-canvas-muted p-4 xl:flex">
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-medium">{t("label")}</p>
        <Link href={previewHref} className="inline-flex h-control-sm items-center gap-2 rounded-sm px-2 text-small font-medium text-link hover:bg-hover focus-visible:focus-ring">
          {t("open")}
          <Icon icon={ExternalLink} size="sm" />
        </Link>
      </div>
      <PhonePreview className="min-h-0 flex-1" />
    </aside>
  );
}

/** Smaller screens: one tap shows the page full-height, one tap back. */
export function PreviewButton({ className, label }: { className?: string; label?: "full" | "icon" }) {
  const t = useTranslations("app.preview");
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {label === "full" ? (
          <Button icon={Eye} className={className}>
            {t("show")}
          </Button>
        ) : (
          <IconButton icon={Eye} label={t("show")} className={className} />
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in" />
        <Dialog.Content aria-describedby={undefined} className="layer-modal fixed inset-0 flex flex-col gap-3 p-3 outline-none motion-safe:animate-pop-in sm:p-6">
          <div className="mx-auto flex w-full max-w-preview items-center justify-between gap-2">
            <Dialog.Title className="rounded-full bg-surface-elevated px-3 py-1 text-small font-medium text-fg shadow-e1">{t("label")}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label={t("close")} variant="secondary" />
            </Dialog.Close>
          </div>
          <PhonePreview className="min-h-0 flex-1" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
