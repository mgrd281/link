"use client";

import { cn, IconButton } from "@linkyo/ui";
import { Redo2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PreviewAside } from "./preview";
import { useSite } from "./site-context";

/**
 * Undo / redo for everything on the page (also ⌘Z / ⇧⌘Z). In Arabic "back" points right, so the
 * arrows are mirrored there, like the chevrons elsewhere in the dashboard.
 */
export function UndoRedo() {
  const t = useTranslations("app");
  const { dispatch, canUndo, canRedo } = useSite();
  return (
    <div className="flex items-center gap-1">
      <IconButton icon={Undo2} label={t("undo")} shortcut="⌘Z" disabled={!canUndo} onClick={() => dispatch({ type: "undo" })} className="rtl:[&_svg]:-scale-x-100" />
      <IconButton icon={Redo2} label={t("redo")} shortcut="⇧⌘Z" disabled={!canRedo} onClick={() => dispatch({ type: "redo" })} className="rtl:[&_svg]:-scale-x-100" />
    </div>
  );
}

/** A dashboard screen: title + actions, a readable column, and (optionally) the live page beside it. */
export function Screen({
  title,
  lead,
  actions,
  children,
  preview = false,
  wide = false,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  preview?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="flex min-w-0">
      <div className="min-w-0 flex-1">
        <div className={cn("mx-auto grid grid-cols-1 gap-6 px-4 pt-6 pb-10 md:px-8 lg:pt-10", wide ? "max-w-content" : "max-w-prose")}>
          <header className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-0 flex-1 gap-1">
              <h1 className="text-h2 tracking-tight">{title}</h1>
              {lead ? <div className="text-small text-fg-secondary">{lead}</div> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </header>
          {children}
        </div>
      </div>
      {preview ? <PreviewAside /> : null}
    </div>
  );
}

/**
 * A white card on the canvas; the dashboard's basic surface. In the app shell on phones it becomes an
 * iOS group: no outline, a smaller radius, set apart from the tinted canvas by its fill alone. In dark
 * mode `surface` is too close to the tinted canvas, so the group steps up to `surface-elevated`.
 */
export function Panel({ children, className, title, action, id }: { children: ReactNode; className?: string; title?: string; action?: ReactNode; id?: string }) {
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className={cn(
        "grid min-w-0 grid-cols-1 content-start gap-4 rounded-xl border border-line bg-surface p-4 md:p-5",
        "max-lg:group-data-[grouped]/app:rounded-lg max-lg:group-data-[grouped]/app:border-transparent dark:max-lg:group-data-[grouped]/app:bg-surface-elevated",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3">
          <h2 id={id} className="text-body-lg font-semibold">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
