import type { CSSProperties, ElementType, ReactNode } from "react";

import { Icon } from "./icon";
import { icons } from "./icons";
import { cn } from "./lib/cn";
import { Skeleton } from "./skeleton";

export interface DataListField {
  label: string;
  value: ReactNode;
  /** Numbers sit at the end of their column on wide screens, in tabular figures. */
  numeric?: boolean | undefined;
  /** Words that run onto a second line instead of being cut ("Vereinigte Arabische Emirate"). */
  wrap?: boolean | undefined;
}

export interface DataListItem {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** An avatar or an icon tile at the start of the row. */
  leading?: ReactNode;
  /** Label and value pairs; give every row the same labels in the same order. */
  fields?: readonly DataListField[] | undefined;
  /** A status badge or a small action at the end of the row. */
  trailing?: ReactNode;
  /** The whole row opens this address (the title is the link; the row is its tap area). */
  href?: string | undefined;
  /** Or the whole row is a button. */
  onSelect?: (() => void) | undefined;
}

export interface DataListProps {
  /** Names the list for screen readers ("Kundinnen und Kunden"). */
  label: string;
  items: readonly DataListItem[];
  /** The column headers on wide screens; defaults to the first item's field labels. */
  columns?: readonly string[] | undefined;
  /** Shown instead of rows when there are none. */
  empty?: ReactNode;
  loading?: boolean | undefined;
  /** Placeholder rows while loading. */
  loadingRows?: number | undefined;
  /** Under the rows: paging ("Mehr laden", "Seite 2 von 5"). */
  footer?: ReactNode;
  /** The link element for `href` rows (next/link); a plain `a` by default. */
  linkAs?: ElementType | undefined;
  /**
   * How the columns share a laptop's width. "share" (default): the title two parts, each field one.
   * "content": from xl every column is as wide as its widest value (the title and the fields stay
   * whole; `wrap` fields wrap instead), and the room left over is shared out evenly, so a short
   * column (a date, an amount) gives its room to the long ones. Below xl the shares apply.
   */
  sizing?: "share" | "content" | undefined;
  className?: string | undefined;
}

/**
 * A list of records that reads on a phone and lines up on a laptop (A-11, A-19). Below md each row is
 * a card: title, subtitle and its fields as label and value pairs. From md the fields line up in
 * columns under one header, like a table, without a table's sideways scrolling. Every value keeps its
 * label for screen readers in both layouts. A row that opens something is one big tap target.
 */
export function DataList({ label, items, columns, empty, loading = false, loadingRows = 3, footer, linkAs: Link = "a", sizing = "share", className }: DataListProps) {
  const headers = columns ?? items[0]?.fields?.map((field) => field.label) ?? [];
  const numeric = items[0]?.fields?.map((field) => Boolean(field.numeric)) ?? [];
  const content = sizing === "content";
  const grid = {
    // Title, one column per field, the trailing slot: the rows share these columns (subgrid).
    "--data-list-columns": `minmax(0, 2fr) repeat(${String(headers.length)}, minmax(0, 1fr)) auto`,
    // "content": every column sized by its values; what is left is spread over them evenly.
    "--data-list-content": `repeat(${String(headers.length + 2)}, auto)`,
    "--data-list-fields": String(Math.max(headers.length, 1)),
  } as CSSProperties;
  const showHeader = headers.length > 0 && !loading && items.length > 0;
  return (
    <div className={cn("grid gap-3", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-line bg-surface md:grid md:grid-cols-(--data-list-columns)",
          // Values longer than any laptop (a 60-letter address) scroll the list sideways rather than being cut off.
          content && "xl:grid-cols-(--data-list-content) xl:overflow-x-auto",
        )}
        style={grid}
      >
        {showHeader ? (
          // The header repeats what every row says to screen readers already; it is only for the eye.
          <div aria-hidden className="hidden border-b border-line bg-canvas-muted md:col-span-full md:grid md:grid-cols-subgrid">
            <span className="px-4 py-2" />
            {headers.map((header, index) => (
              <span
                key={header}
                className={cn(
                  "truncate px-3 py-2 text-caption font-medium text-fg-secondary",
                  numeric[index] ? "text-end" : "text-start",
                  // A long column name takes a second line rather than widening its column ("Aufrufe (30 T.)").
                  content && "xl:overflow-visible xl:whitespace-normal xl:text-balance",
                )}
              >
                {header}
              </span>
            ))}
            <span className="px-4 py-2" />
          </div>
        ) : null}
        <ul aria-label={label} aria-busy={loading || undefined} className="divide-y divide-line md:col-span-full md:grid md:grid-cols-subgrid">
          {loading
            ? Array.from({ length: loadingRows }, (_, index) => (
                <li key={index} className="flex items-center gap-3 px-4 py-3 md:col-span-full">
                  <Skeleton className="size-avatar-sm rounded-full" />
                  <span className="grid flex-1 gap-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </span>
                </li>
              ))
            : items.map((item) => <Row key={item.id} item={item} Link={Link} content={content} />)}
        </ul>
        {!loading && items.length === 0 && empty ? <div className="px-4 py-8 text-center text-small text-fg-secondary md:col-span-full">{empty}</div> : null}
      </div>
      {footer ? <div className="flex flex-wrap items-center justify-between gap-3">{footer}</div> : null}
    </div>
  );
}

function Row({ item, Link, content }: { item: DataListItem; Link: ElementType; content: boolean }) {
  // "content" sizing: from xl a cell's whole value is its column's least width (`min-w-auto`), so a
  // column is cut only where the values cannot fit; below that and with "share", a cell may shrink.
  // A value that truncates clips, and a grid counts a clipping item as 0 wide in its least width:
  // its one column then starts at the item's own width (`minmax(min-content, 1fr)`).
  const whole = content && "xl:min-w-auto";
  const wholeText = content && "xl:grid-cols-[minmax(min-content,1fr)]";
  const interactive = Boolean(item.href ?? item.onSelect);
  // The title carries the link or the button; its ::after covers the row, so the whole row is the target.
  const stretched = "after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:focus-field";
  const title = item.href ? (
    <Link href={item.href} className={cn("text-body font-semibold text-fg", stretched)}>
      {item.title}
    </Link>
  ) : item.onSelect ? (
    <button type="button" onClick={item.onSelect} className={cn("text-start text-body font-semibold text-fg", stretched)}>
      {item.title}
    </button>
  ) : (
    <span className="text-body font-semibold text-fg">{item.title}</span>
  );
  return (
    <li
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3",
        "md:col-span-full md:grid-cols-subgrid md:gap-x-0 md:px-0",
        interactive && "transition-colors duration-micro hover:bg-hover",
      )}
    >
      <div className={cn("col-span-2 flex min-w-0 items-center gap-3 md:col-span-1 md:ps-4 md:pe-3", whole)}>
        {item.leading ? <span className="shrink-0">{item.leading}</span> : null}
        <span className={cn("grid min-w-0", wholeText)}>
          <span className="truncate">{title}</span>
          {item.subtitle ? <span className="truncate text-small text-fg-secondary">{item.subtitle}</span> : null}
        </span>
      </div>
      <div className="relative layer-raised flex items-center justify-end gap-2 md:order-last md:pe-4">
        {item.trailing}
        {interactive ? <Icon icon={icons.next} size="sm" className="text-fg-tertiary" /> : null}
      </div>
      {item.fields?.length ? (
        // From md the pairs take the field columns (a subgrid), so they line up under the header.
        // Centred in the row like the title, also beside a value that takes two lines.
        <dl className="col-span-full grid grid-cols-2 gap-x-3 gap-y-1 text-small md:col-span-(--data-list-fields) md:grid-cols-subgrid md:items-center md:gap-x-0">
          {item.fields.map((field) => (
            <div key={field.label} className={cn("grid min-w-0 md:px-3", field.numeric && "md:text-end", whole, wholeText)}>
              <dt className="truncate text-caption text-fg-tertiary md:sr-only">{field.label}</dt>
              <dd className={cn("min-w-0 text-fg", field.wrap ? "text-pretty break-words" : "truncate", field.numeric && "tabular-nums")}>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}
