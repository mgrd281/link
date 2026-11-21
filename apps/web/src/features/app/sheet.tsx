"use client";

import { Button, cn, IconButton } from "@linkyo/ui";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, type PointerEvent, type ReactNode } from "react";

import { haptic } from "@/lib/haptics";

/** How far (share of the sheet's height) or how fast (px per ms) a downward drag must go to close it. */
const DISMISS_SHARE = 0.25;
const DISMISS_SPEED = 0.6;

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
    if (event.button !== 0 || !window.matchMedia("(width < 64rem)").matches) return;
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
    const sheet = content.current;
    if (sheet && delta > 0 && (delta > sheet.offsetHeight * DISMISS_SHARE || current.speed > DISMISS_SPEED)) {
      // The closing slide starts where the finger left the sheet.
      sheet.style.setProperty("--sheet-drag", `${delta}px`);
      // A flick carries on at the finger's speed instead of starting again from rest.
      sheet.style.animationTimingFunction = "var(--ease-standard)";
      haptic();
      onClose();
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

/**
 * A sheet: slides up from the bottom on phones (thumb-reachable actions), docks to the side on wide
 * screens. With `besidePreview` it leaves the live phone preview visible on extra-wide screens, so
 * every change shows up on the page while you type.
 *
 * With `confirm` (edit sheets) a phone gets the iOS navigation row instead of a footer: Cancel at the
 * start, the title in the middle, the confirming action at the end, and no X (two ways to cancel are
 * one too many). Wide screens keep the title with the X, and the footer's buttons.
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  besidePreview?: boolean;
  headerAction?: ReactNode;
  /** The confirming action of the phone's navigation row ("Save", "Add to page"). */
  confirm?: { label: string; onConfirm: () => void } | undefined;
  /** The cancelling action of the phone's navigation row. Without it, the row's start just closes the sheet. */
  cancel?: { label: string; onCancel: () => void } | undefined;
}) {
  const { content, overlay, handle } = useDragToDismiss(() => onOpenChange(false));
  // Where focus was when the sheet opened, so it can go back there when the sheet closes. Most sheets
  // open from state rather than from a Dialog.Trigger, so Radix has no trigger of its own to return to.
  const returnTo = useRef<HTMLElement | null>(null);
  const close = (
    <Dialog.Close asChild>
      <IconButton variant="tinted" icon={X} label={closeLabel} className={cn("rounded-full", confirm && "max-lg:hidden")} />
    </Dialog.Close>
  );
  const describe = description ? <Dialog.Description className="text-small text-fg-secondary">{description}</Dialog.Description> : null;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          ref={overlay}
          className={cn(
            "layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in data-[state=closed]:motion-safe:animate-fade-out",
            besidePreview && "xl:end-[calc(var(--container-preview)+var(--spacing-8))]",
          )}
        />
        <Dialog.Content
          ref={content}
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(event) => {
            returnTo.current = document.activeElement as HTMLElement | null;
            // With a mouse, start in the first field. On touch screens, don't pop the keyboard up uninvited.
            const content = event.currentTarget as HTMLElement;
            const field = content.querySelector<HTMLElement>("[data-sheet-body] :is(input:not([type=hidden]), textarea, select)");
            event.preventDefault();
            // Touch: focus the sheet itself (no keyboard popping up, no tooltip on the close button).
            if (field && window.matchMedia("(pointer: fine)").matches) field.focus();
            else content.focus();
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
            // Phones: up from below the screen on a spring, and back down when closed. Wide screens: a side panel.
            "layer-modal fixed inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-xl border border-line bg-surface-elevated text-fg outline-none",
            "motion-safe:animate-sheet-in data-[state=closed]:motion-safe:animate-sheet-out",
            "lg:inset-y-0 lg:start-auto lg:end-0 lg:max-h-none lg:w-full lg:max-w-prose lg:rounded-none lg:rounded-s-xl lg:motion-safe:animate-rise-in lg:data-[state=closed]:motion-safe:animate-fade-out",
            besidePreview && "xl:end-[calc(var(--container-preview)+var(--spacing-8))]",
          )}
        >
          {/* The grabber and the header are the handle: pull down to close (phones). */}
          <div {...handle} className="touch-none lg:touch-auto">
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
            {confirm ? (
              // One title on every screen size (one id names the dialog); only the buttons around it change.
              <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line px-2 pt-1 pb-2 lg:flex lg:items-start lg:gap-3 lg:px-5 lg:pt-5 lg:pb-4">
                {cancel ? (
                  <Button variant="ghost" size="sm" className="justify-self-start lg:hidden" onClick={cancel.onCancel}>
                    {cancel.label}
                  </Button>
                ) : (
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="sm" className="justify-self-start lg:hidden">
                      {closeLabel}
                    </Button>
                  </Dialog.Close>
                )}
                <Dialog.Title className="line-clamp-2 text-center text-body font-semibold text-balance lg:flex-1 lg:text-start lg:text-h3">{title}</Dialog.Title>
                <Button variant="primary" size="sm" className="justify-self-end lg:hidden" onClick={confirm.onConfirm}>
                  {confirm.label}
                </Button>
                {close}
              </header>
            ) : (
              <header className="flex items-start gap-3 border-b border-line px-5 pt-3 pb-4 lg:pt-5">
                <div className="grid min-w-0 flex-1 gap-1">
                  <Dialog.Title className="text-h3">{title}</Dialog.Title>
                  {describe}
                </div>
                {headerAction}
                {close}
              </header>
            )}
          </div>
          <div
            data-sheet-body
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5",
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
                "flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 pt-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))]",
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
