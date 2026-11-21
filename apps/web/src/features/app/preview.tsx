"use client";

import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Button, cn, Icon, IconButton } from "@linkyo/ui";
import { Eye, Smartphone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { PosterRenderer } from "@/features/directions/poster/renderer";
import { Link } from "@/i18n/navigation";

import { useSite } from "./site-context";
import { DESK_QUERY, useMediaQuery } from "./use-media-query";

/** How far down an element sits inside a scroller's content (layout positions, so transforms don't count). */
function offsetWithin(element: HTMLElement, scroller: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== scroller && scroller.contains(node)) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return top;
}

/**
 * The creator's page, rendered by the real renderer at phone width (container queries do the rest).
 * It is a picture of the page, not a second app: the page inside is inert, so its links, players and
 * headings stay out of the way (no navigating the dashboard away, no second h1). The frame itself
 * can still be scrolled, with the keyboard too; "Open" shows the real page.
 */
export function PhonePreview({ className }: { className?: string }) {
  const t = useTranslations("app.preview");
  const { previewPage, doc, editing } = useSite();
  const theme = useMemo(() => resolveCreatorTheme(doc.theme, { rtlScript: previewPage.profile.locale === "ar" }), [doc.theme, previewPage.profile.locale]);
  const scroller = useRef<HTMLDivElement>(null);
  const hintId = useId();
  // The block open in the edit sheet (a new one shows up once its draft has something to show).
  const editingId = editing ? (editing.mode === "edit" ? editing.id : editing.block.id) : null;
  // The block the preview last scrolled to, so typing in it does not pull the preview back each time.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const box = scroller.current;
    if (!box || !editingId) {
      shown.current = null;
      return;
    }
    const element = box.querySelector<HTMLElement>(`[data-block-ids~="${CSS.escape(editingId)}"]`);
    if (!element) return;
    // Outlined while it is being edited, so the eye finds the change.
    element.dataset.editing = "";
    if (shown.current !== editingId) {
      shown.current = editingId;
      // Only the preview's own scroller moves: scrollIntoView would also move the dashboard around it.
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: Math.max(0, offsetWithin(element, box) - box.clientHeight / 3), behavior: reduced ? "auto" : "smooth" });
    }
    return () => {
      delete element.dataset.editing;
    };
  }, [editingId, previewPage]);
  return (
    // Concentric: the frame's radius (28) is the screen's (20) plus its padding (8).
    <div className={cn("relative mx-auto w-full max-w-preview overflow-hidden rounded-xl border border-line-strong bg-ink p-2", className)}>
      <div className="relative size-full overflow-hidden rounded-lg" style={{ transform: "translateZ(0)" }}>
        <div
          ref={scroller}
          // The edited block gets an outline (never a shadow) in the page's own accent, which the theme
          // engine keeps readable on the page's background, dark or light.
          className="absolute inset-0 overflow-y-auto overscroll-contain [&_[data-editing]]:rounded-creator-card [&_[data-editing]]:[--color-focus:var(--creator-accent-text)] [&_[data-editing]]:focus-ring"
          tabIndex={0}
          role="region"
          aria-label={t("region", { name: previewPage.profile.displayName })}
          aria-describedby={hintId}
        >
          <div inert>
            <PosterRenderer page={previewPage} theme={theme} preview />
          </div>
        </div>
      </div>
      <p id={hintId} className="sr-only">
        {t("regionHint")}
      </p>
    </div>
  );
}

/**
 * Wide screens: the page stays in view next to whatever you edit. Compact (320 px) from the desk
 * breakpoint, so a 13–14" laptop window sees it too; full width from xl. Mounted only where it shows,
 * so smaller screens do not render the page twice. Its header shares the 64 px toolbar line with the
 * sidebar logo and the screen's toolbar; the frame ends 16 px above the window's bottom.
 */
export function PreviewAside() {
  const t = useTranslations("app.preview");
  const { previewHref } = useSite();
  const desk = useMediaQuery(DESK_QUERY);
  if (!desk) return null;
  return (
    <aside
      data-preview-aside
      aria-label={t("label")}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-3 border-s border-line bg-canvas-muted px-4 pb-4 desk:flex desk:w-[calc(var(--container-preview-compact)+var(--spacing-8))] xl:w-[calc(var(--container-preview)+var(--spacing-8))]"
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2">
        <p className="text-small font-medium">{t("label")}</p>
        <Link
          href={previewHref}
          className="inline-flex h-control-sm items-center gap-2 rounded-sm px-2 text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
        >
          {t("open")}
          {/* The page opens inside the dashboard: an eye, not the "leave the app" arrow. */}
          <Icon icon={Eye} size="sm" />
        </Link>
      </div>
      <PhonePreview className="min-h-0 flex-1 max-w-preview-compact xl:max-w-preview" />
    </aside>
  );
}

/**
 * The team area's column (outside the dashboard shell): extra-wide screens only, as before. Its
 * width includes the padding, so the frame ends inside the window instead of 32 px below it.
 */
export function PlainPreviewAside() {
  const t = useTranslations("app.preview");
  const { previewHref } = useSite();
  return (
    <aside
      aria-label={t("label")}
      className="sticky top-0 hidden h-dvh w-[calc(var(--container-preview)+var(--spacing-8))] shrink-0 flex-col gap-3 border-s border-line bg-canvas-muted p-4 xl:flex"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-medium">{t("label")}</p>
        <Link href={previewHref} className="inline-flex h-control-sm items-center gap-2 rounded-sm px-2 text-small font-medium text-link hover:bg-hover focus-visible:focus-ring">
          {t("open")}
          <Icon icon={Eye} size="sm" />
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
          <Button icon={Smartphone} className={className}>
            {t("show")}
          </Button>
        ) : (
          <IconButton icon={Smartphone} label={t("show")} className={className} />
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in" />
        <Dialog.Content aria-describedby={undefined} className="layer-modal fixed inset-0 flex flex-col gap-3 p-3 outline-none motion-safe:animate-pop-in sm:p-6">
          <div className="mx-auto flex w-full max-w-preview items-center justify-between gap-2">
            <Dialog.Title className="rounded-full border border-line bg-surface-elevated px-3 py-1 text-small font-medium text-fg">{t("label")}</Dialog.Title>
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
