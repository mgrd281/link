"use client";

import { useId, useState, type ReactNode } from "react";

import { Icon } from "./icon";
import { icons } from "./icons";
import { cn } from "./lib/cn";

export interface ChartTableColumn<Row> {
  key: string;
  label: string;
  /** Numbers sit at the end of the cell, in tabular figures. */
  numeric?: boolean | undefined;
  /** The cell's content; defaults to `row[key]`. */
  cell?: ((row: Row) => ReactNode) | undefined;
}

export interface ChartTableProps<Row> {
  /** The table's caption: what the chart shows ("Aufrufe pro Tag"). */
  caption: string;
  columns: readonly ChartTableColumn<Row>[];
  rows: readonly Row[];
  /** A stable key per row (a date, an id). */
  rowKey: (row: Row) => string;
  /** The toggle's labels ("Als Tabelle zeigen" / "Tabelle ausblenden"). */
  showLabel: string;
  hideLabel: string;
  /** Start open (a screen that is all numbers). */
  defaultOpen?: boolean | undefined;
  className?: string | undefined;
}

/**
 * The numbers behind a chart, one tap away (A-12, A-19): a quiet toggle button under the chart and a
 * real table with a caption, column headers and figures aligned at the end. Replaces the `<details>`
 * disclosures with their triangle markers in both consoles. The table scrolls sideways inside its
 * frame on a phone instead of widening the page; the frame can take focus so the keyboard scrolls it.
 */
export function ChartTable<Row>({ caption, columns, rows, rowKey, showLabel, hideLabel, defaultOpen = false, className }: ChartTableProps<Row>) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn("grid gap-2", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative inline-flex h-control-sm w-fit items-center gap-2 rounded-md px-2 text-small font-medium text-fg-secondary",
          "transition-colors duration-micro ease-standard hover:bg-hover hover:text-fg focus-visible:focus-ring",
          // 32 px to see, a 48 px tall target on touch screens (as Button size sm).
          "before:absolute before:inset-x-0 before:-inset-y-2 pointer-fine:before:hidden",
        )}
      >
        <Icon
          icon={icons.expand}
          size="sm"
          className={cn("transition-transform duration-standard ease-standard motion-reduce:transition-none", open && "rotate-180")}
        />
        {open ? hideLabel : showLabel}
      </button>
      <div id={id} hidden={!open}>
        {/* A labelled region that takes focus, so a keyboard can scroll a wide table (axe: scrollable-region-focusable). */}
        <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-md border border-line focus-visible:focus-ring">
          <table className="w-full border-collapse text-small">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line bg-canvas-muted">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn("whitespace-nowrap px-3 py-2 text-caption font-medium text-fg-secondary", column.numeric ? "text-end" : "text-start")}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-line last:border-b-0">
                  {columns.map((column, index) => {
                    const content = column.cell ? column.cell(row) : ((row as Record<string, unknown>)[column.key] as ReactNode);
                    const cellClass = cn("px-3 py-2", column.numeric ? "text-end tabular-nums" : "text-start");
                    return index === 0 ? (
                      <th key={column.key} scope="row" className={cn(cellClass, "whitespace-nowrap font-regular")}>
                        {content}
                      </th>
                    ) : (
                      <td key={column.key} className={cellClass}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
