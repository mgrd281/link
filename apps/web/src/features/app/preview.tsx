"use client";

import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Button, cn, Icon, IconButton } from "@linkyo/ui";
import { Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { PosterRenderer } from "@/features/directions/poster/renderer";
import { Link } from "@/i18n/navigation";

import { useSite } from "./site-context";

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

/** The creator's page, rendered by the real renderer at phone width (container queries do the rest). */
export function PhonePreview({ className }: { className?: string }) {
  const { previewPage, doc, editing } = useSite();
  const theme = useMemo(() => resolveCreatorTheme(doc.theme, { rtlScript: previewPage.profile.locale === "ar" }), [doc.theme, previewPage.profile.locale]);
  const scroller = useRef<HTMLDivElement>(null);
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
    <div className={cn("relative mx-auto w-full max-w-preview overflow-hidden rounded-xl border border-line-strong bg-ink p-1", className)}>
      <div className="relative size-full overflow-hidden rounded-lg" style={{ transform: "translateZ(0)" }}>
        <div
          ref={scroller}
          // The edited block gets an outline (never a shadow) in the page's own accent, which the theme
          // engine keeps readable on the page's background, dark or light.
          className="absolute inset-0 overflow-y-auto overscroll-contain [&_[data-editing]]:rounded-creator-card [&_[data-editing]]:[--color-focus:var(--creator-accent-text)] [&_[data-editing]]:focus-ring"
          tabIndex={0}
          role="region"
          aria-label={previewPage.profile.displayName}
        >
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
          {/* The page opens inside the dashboard: an eye, not the "leave the app" arrow. */}
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
