"use client";

import { tokens } from "@linkyo/tokens";
import { Button, cn, IconButton, toast } from "@linkyo/ui";
import { ChevronLeft, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from "react";

import { isRtl } from "@/i18n/routing";
import { haptic } from "@/lib/haptics";

/** Phones and small tablets, below the `lg` breakpoint token (in rem, as the generated CSS has it). */
const BELOW_LG = `(width < ${tokens.breakpoint.lg / 16}rem)`;

/** How far (share of the sheet's height) or how fast (px per ms) a downward drag must go to close it. */
const DISMISS_SHARE = 0.25;
const DISMISS_SPEED = 0.6;
/** A finger that stood still this long (ms) before letting go has no speed left: it is a hold, not a flick. */
const STILL_FOR = 50;

interface Drag {
  pointer: number;
  start: number;
  last: number;
  time: number;
  speed: number;
  moving: boolean;
}

/**
 * Pull a sheet down to close it, as on iOS: the grabber and the header follow the finger (upward it
 * gives way only a little, like a rubber band), the backdrop fades with it, and letting go far or fast
 * enough closes the sheet with a tick of haptic feedback; otherwise it springs back. Phones only: on
 * wide screens the sheet is a side panel. Buttons in the header keep working (a tap is not a drag).
 * A sheet that stays open after `onClose` (a form with changes asks first) springs back too.
 */
export function useDragToDismiss(onClose: () => void) {
  const content = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const move = (offset: number, animate: boolean) => {
    const sheet = content.current;
    if (!sheet) return;
    // Reduced motion: the sheet goes straight back instead of springing.
    const spring = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transition = spring ? "translate var(--duration-spring) var(--ease-spring), opacity var(--duration-spring) var(--ease-spring)" : "none";
    sheet.style.transition = transition;
    sheet.style.translate = offset === 0 ? "" : `0 ${offset}px`;
    if (overlay.current) {
      overlay.current.style.transition = transition;
      overlay.current.style.opacity = offset > 0 ? String(Math.max(0, 1 - offset / sheet.offsetHeight)) : "";
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !window.matchMedia(BELOW_LG).matches) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    drag.current = { pointer: event.pointerId, start: event.clientY, last: event.clientY, time: event.timeStamp, speed: 0, moving: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    const delta = event.clientY - current.start;
    if (!current.moving) {
      if (Math.abs(delta) < 6) return;
      current.moving = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    current.speed = (event.clientY - current.last) / Math.max(1, event.timeStamp - current.time);
    current.last = event.clientY;
    current.time = event.timeStamp;
    move(delta > 0 ? delta : -Math.sqrt(-delta) * 2, false);
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    drag.current = null;
    if (current?.pointer !== event.pointerId || !current.moving) return;
    const delta = event.clientY - current.start;
    // The speed of the last move only counts if the finger was still moving when it let go.
    const speed = event.timeStamp - current.time > STILL_FOR ? 0 : current.speed;
    const sheet = content.current;
    if (sheet && delta > 0 && (delta > sheet.offsetHeight * DISMISS_SHARE || speed > DISMISS_SPEED)) {
      // The closing slide starts where the finger left the sheet.
      sheet.style.setProperty("--sheet-drag", `${delta}px`);
      // A flick carries on at the finger's speed instead of starting again from rest.
      sheet.style.animationTimingFunction = "var(--ease-standard)";
      haptic();
      onClose();
      // Still open on the next frame (the form asked first): back to where it was.
      requestAnimationFrame(() => {
        if (!sheet.isConnected || sheet.dataset.state !== "open") return;
        sheet.style.removeProperty("--sheet-drag");
        sheet.style.animationTimingFunction = "";
        move(0, true);
      });
    } else {
      move(0, true);
    }
  };
  return {
    content,
    overlay,
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

/** The sheets open right now (one closing while the next opens counts twice for a moment). */
const openSheets = new Set<HTMLElement>();

/**
 * Where toasts may go while sheets are open (see `Toaster`): the root carries `data-sheet-open`, and
 * on wide screens `--sheet-toast-start` and `--sheet-toast-end` mark the free space a toast stays in.
 * That is the space before the panels while it is wide enough for a toast with an action
 * (`layout.toast`); on laptops where the panel and the live preview beside it leave less (1200 to
 * about 1400 px), it is the space after the panel, over the preview; failing both, the wider one.
 */
function publishSheets() {
  const root = document.documentElement;
  if (openSheets.size === 0) {
    delete root.dataset.sheetOpen;
    root.style.removeProperty("--sheet-toast-start");
    root.style.removeProperty("--sheet-toast-end");
    return;
  }
  root.dataset.sheetOpen = "";
  const rtl = getComputedStyle(root).direction === "rtl";
  const width = root.clientWidth;
  // Layout positions (a fixed element's offsets are the window's), so the sliding-in animation does not count.
  // In inline terms: where the panels begin and end, measured from the start of the line.
  const sheets = [...openSheets];
  const startOf = (sheet: HTMLElement) => (rtl ? width - sheet.offsetLeft - sheet.offsetWidth : sheet.offsetLeft);
  const panelStart = Math.max(0, Math.min(...sheets.map(startOf)));
  const panelEnd = Math.min(width, Math.max(...sheets.map((sheet) => startOf(sheet) + sheet.offsetWidth)));
  const before = panelStart;
  const after = width - panelEnd;
  const useBefore = before >= tokens.layout.toast || before >= after;
  const px = (value: number) => `${String(Math.max(0, Math.round(value)))}px`;
  root.style.setProperty("--sheet-toast-start", px(useBefore ? 0 : panelEnd));
  root.style.setProperty("--sheet-toast-end", px(useBefore ? width - panelStart : 0));
}

/**
 * An open sheet closes the toasts already showing (a toast over its form would hide its controls,
 * the "Feature" switch at the bottom, for one) and keeps later ones clear of it while it stays open.
 */
function useToastsClear(open: boolean, content: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    toast.dismiss();
    let sheet: HTMLElement | null = null;
    // The content mounts with the open state: measured on the next frame, once it is laid out.
    const frame = requestAnimationFrame(() => {
      sheet = content.current;
      if (!sheet) return;
      openSheets.add(sheet);
      publishSheets();
    });
    const onResize = () => publishSheets();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      if (sheet) openSheets.delete(sheet);
      publishSheets();
    };
  }, [open, content]);
}

/** With a mouse, start in the first field. On touch screens, don't pop the keyboard up uninvited. */
function focusStart(sheet: HTMLElement) {
  const field = sheet.querySelector<HTMLElement>("[data-sheet-body] :is(input:not([type=hidden]), textarea, select)");
  if (field && window.matchMedia("(pointer: fine)").matches) field.focus();
  // Touch: focus the sheet itself (no keyboard popping up, no tooltip on the close button).
  else sheet.focus();
}

/**
 * A sheet: slides up from the bottom on phones (thumb-reachable actions), docks to the side on wide
 * screens. With `besidePreview` it leaves the live phone preview visible where the dashboard shows it
 * (`--preview-column`), so every change shows up on the page while you type.
 *
 * With `confirm` (edit sheets) a phone gets the iOS navigation row instead of a footer: Cancel at the
 * start, the title in the middle, the confirming action at the end, and no X (two ways to cancel are
 * one too many). Wide screens keep the title with the X, and the footer's buttons.
 *
 * With `step` the sheet can show one screen after another without closing (the Add sheet: pick a type,
 * then fill it in). A new step slides in from the reading direction; `back` puts "‹ Back" where Cancel
 * was (phones) and a back button before the title (wide screens).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  besidePreview = false,
  headerAction,
  confirm,
  cancel,
  step,
  back,
  detent = "fit",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Text, or rich text (an Arabic title with a Latin name in <bdi>). */
  title: ReactNode;
  description?: string | undefined;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  besidePreview?: boolean;
  headerAction?: ReactNode;
  /**
   * The confirming action of the phone's navigation row ("Save", "Add"). A short `label` fits the row;
   * `ariaLabel` then keeps the full name ("Add to page"), so the visible word is part of it.
   */
  confirm?: { label: string; ariaLabel?: string | undefined; onConfirm: () => void } | undefined;
  /** The cancelling action of the phone's navigation row. Without it, the row's start just closes the sheet. */
  cancel?: { label: string; onCancel: () => void } | undefined;
  /** Which screen of the sheet is showing; when it changes, the new one slides in. */
  step?: string | undefined;
  /** Back to the previous step: takes Cancel's place on phones, and sits before the title on wide screens. */
  back?: { label: string; onBack: () => void } | undefined;
  /** "large": nearly the whole screen on phones from the start, so a following step does not jump in height. */
  detent?: "fit" | "large";
}) {
  const { content, overlay, handle } = useDragToDismiss(() => onOpenChange(false));
  useToastsClear(open, content);
  const rtl = isRtl(useLocale());
  // Where focus was when the sheet opened, so it can go back there when the sheet closes. Most sheets
  // open from state rather than from a Dialog.Trigger, so Radix has no trigger of its own to return to.
  const returnTo = useRef<HTMLElement | null>(null);
  // A step that changes while the sheet is open slides in: forward (it has a way back) from the end,
  // back from the start. Opening never animates the body (the sheet itself is moving).
  const [shown, setShown] = useState<{ open: boolean; step: string | undefined; moved: -1 | 0 | 1 }>({ open, step, moved: 0 });
  if (shown.open !== open || shown.step !== step) {
    setShown({ open, step, moved: open && shown.open && shown.step !== step ? (back ? 1 : -1) : 0 });
  }
  // The new step's first field (with a mouse) or the sheet itself takes focus, as when it opened.
  useEffect(() => {
    if (shown.moved === 0 || !content.current) return;
    focusStart(content.current);
  }, [shown, content]);

  const close = (
    <Dialog.Close asChild>
      <IconButton variant="tinted" icon={X} label={closeLabel} className={cn("rounded-full", confirm && "max-lg:hidden")} />
    </Dialog.Close>
  );
  const describe = description ? <Dialog.Description className="text-small text-fg-secondary">{description}</Dialog.Description> : null;
  // Phones are full width, also in landscape: the edges keep clear of the notch (safe areas do not mirror).
  const edges = "pl-[max(var(--spacing-5),env(safe-area-inset-left))] pr-[max(var(--spacing-5),env(safe-area-inset-right))]";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          ref={overlay}
          className={cn(
            "layer-modal fixed inset-0 bg-scrim motion-safe:animate-scrim-in data-[state=closed]:motion-safe:animate-fade-out",
            besidePreview && "end-(--preview-column)",
          )}
        />
        <Dialog.Content
          ref={content}
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(event) => {
            returnTo.current = document.activeElement as HTMLElement | null;
            event.preventDefault();
            focusStart(event.currentTarget as HTMLElement);
          }}
          onCloseAutoFocus={(event) => {
            // Back to the control that opened the sheet. When that is gone (a deleted row) or was never
            // focused (iOS Safari does not focus a tapped button), the screen's main content takes focus,
            // so the keyboard and screen readers carry on from the screen, not from the top of the page.
            event.preventDefault();
            const element = returnTo.current;
            const target = element && element.isConnected && element !== document.body ? element : document.getElementById("main");
            target?.focus({ preventScroll: true });
          }}
          className={cn(
            // Phones: up from below the screen on a spring, and back down when closed. It stops 64 px (and
            // the notch) short of the top: a toast that comes while it is open stands there (see Toaster),
            // 48 px tall with its margins, so it never reaches the sheet's grabber and its header buttons.
            "layer-modal fixed inset-x-0 bottom-0 flex max-h-[calc(100dvh-var(--spacing-16)-env(safe-area-inset-top))] flex-col rounded-t-xl border border-line bg-surface-elevated text-fg outline-none",
            "motion-safe:animate-sheet-in data-[state=closed]:motion-safe:animate-sheet-out",
            detent === "large" && "max-lg:h-[calc(100dvh-var(--spacing-16)-env(safe-area-inset-top))]",
            // Wide screens: a side panel that comes in from its own edge (the start in Arabic) and fades away.
            "lg:inset-y-0 lg:start-auto lg:end-0 lg:max-h-none lg:w-full lg:max-w-prose lg:rounded-none lg:rounded-s-xl",
            "lg:motion-safe:animate-page-in lg:[animation-duration:var(--duration-slow)] lg:[animation-timing-function:var(--ease-emphasized)]",
            "lg:data-[state=closed]:motion-safe:animate-fade-out",
            besidePreview && "lg:end-(--preview-column)",
          )}
          // The side panel's edge is the end of the line: it comes in from the right, in Arabic from the left.
          style={{ "--step": rtl ? -1 : 1 } as CSSProperties}
        >
          {/* The grabber and the header are the handle: pull down to close (phones). */}
          <div {...handle} className="touch-none lg:touch-auto">
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
            {confirm ? (
              // One title on every screen size (one id names the dialog); only the buttons around it change.
              // On phones both ends sit at the body's own gutter (`edges`): the ghost button on the start
              // side pulls its 12 px of padding back (-ms-3), so its word starts where the filled button's
              // edge ends on the other side, 20 px in, in either reading direction.
              <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line pt-1 pr-[max(var(--spacing-5),env(safe-area-inset-right))] pb-2 pl-[max(var(--spacing-5),env(safe-area-inset-left))] lg:flex lg:items-start lg:gap-3 lg:px-5 lg:pt-5 lg:pb-4">
                {back ? (
                  <>
                    <Button variant="ghost" size="sm" icon={ChevronLeft} className="-ms-3 justify-self-start lg:hidden" onClick={back.onBack}>
                      {back.label}
                    </Button>
                    <IconButton variant="tinted" icon={ChevronLeft} label={back.label} className="rounded-full max-lg:hidden" onClick={back.onBack} />
                  </>
                ) : cancel ? (
                  <Button variant="ghost" size="sm" className="-ms-3 justify-self-start lg:hidden" onClick={cancel.onCancel}>
                    {cancel.label}
                  </Button>
                ) : (
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="sm" className="-ms-3 justify-self-start lg:hidden">
                      {closeLabel}
                    </Button>
                  </Dialog.Close>
                )}
                <Dialog.Title className="line-clamp-2 text-center text-body font-semibold text-balance lg:flex-1 lg:self-center lg:text-start lg:text-h3">{title}</Dialog.Title>
                <Button variant="primary" size="sm" className="justify-self-end lg:hidden" aria-label={confirm.ariaLabel} onClick={confirm.onConfirm}>
                  {confirm.label}
                </Button>
                {close}
              </header>
            ) : (
              <header className={cn("flex items-start gap-3 border-b border-line pt-3 pb-4 lg:pt-5", edges)}>
                <div className="grid min-w-0 flex-1 gap-1">
                  <Dialog.Title className="text-h3">{title}</Dialog.Title>
                  {describe}
                </div>
                {headerAction}
                {close}
              </header>
            )}
          </div>
          {/* A new step is a new screen: it starts at its top, and slides in from where it comes from
              (forward from the end of the line, back from its start; none under reduced motion). */}
          <div
            key={step}
            data-sheet-body
            style={shown.moved === 0 ? undefined : ({ "--step": rtl ? -shown.moved : shown.moved } as CSSProperties)}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain py-5",
              edges,
              shown.moved !== 0 && "motion-safe:animate-page-in",
              // With no footer below it (as on phones with a navigation row), the body clears the home indicator itself.
              !footer && "pb-[max(var(--spacing-5),env(safe-area-inset-bottom))]",
              footer && confirm && "max-lg:pb-[max(var(--spacing-5),env(safe-area-inset-bottom))]",
            )}
          >
            {/* The navigation row only has room for the title: the explanation and the extra control open the body. */}
            {confirm && (describe || headerAction) ? (
              <div className="mb-6 flex items-start justify-between gap-3">
                {describe}
                {headerAction}
              </div>
            ) : null}
            {children}
          </div>
          {footer ? (
            <footer
              className={cn(
                "flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))]",
                edges,
                // Phones confirm and cancel in the navigation row.
                confirm && "max-lg:hidden",
              )}
            >
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
