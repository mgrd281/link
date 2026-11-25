import type { BlockOf } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { Ticket } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useCreatorFormat } from "../shared/creator-kit";
import { EventTabsIsland } from "./events-island";
import { displayStyle, pageSide, pressable } from "./styles";

type EventItem = BlockOf<"events">["items"][number];

/** Sold-out dates are not links (nothing to do); everything else leads to tickets. */
function EventLink({ href, className, children }: { href: string | null; className: string; children: ReactNode }) {
  return href ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

function EventRow({ event, surface }: { event: EventItem; surface: string }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  const soldOut = event.status === "soldout";
  const place = event.name ? `${event.city} · ${event.venue}` : event.venue;
  return (
    <EventLink href={soldOut ? null : event.url} className={cn("flex items-center gap-4 rounded-creator-card p-3", surface, !soldOut && pressable)}>
      <span className="grid size-16 shrink-0 content-center justify-items-center gap-1 rounded-md bg-creator-bg leading-none">
        <span className="font-creator-display text-h2 leading-none" style={displayStyle}>
          {f.date(event.date, { day: "2-digit" })}
        </span>
        <span className="text-caption font-semibold text-creator-fg-muted uppercase">{f.date(event.date, { month: "short" })}</span>
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span dir="auto" className={cn(pageSide, "line-clamp-2 text-body-lg leading-snug font-semibold", soldOut && "text-creator-fg-muted line-through")}>{event.name ?? event.city}</span>
        <span dir="auto" className={cn(pageSide, "truncate text-small text-creator-fg-muted")}>
          {place}
          {event.time ? ` · ${event.time}` : null}
        </span>
        {event.status === "few" || soldOut ? (
          <span className={cn("text-caption font-semibold tracking-wide uppercase", soldOut ? "text-creator-fg-muted" : "text-creator-accent-text")}>
            {soldOut ? t("soldOut") : t("fewLeft")}
          </span>
        ) : null}
      </span>
      {soldOut ? null : (
        <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-creator-accent text-creator-accent-fg">
          <Icon icon={Ticket} size="sm" label={t("tickets")} />
        </span>
      )}
    </EventLink>
  );
}

const monthKey = (iso: string): string => iso.slice(0, 7);

/**
 * Dates grouped by month behind tabs ("All" first, so nothing is hidden by default or without JS).
 * Each date is drawn here, on the server for a public page; with dates in two or more months the
 * tabs are a client island (`./events-island.tsx`) that chooses which rows show (ADR 0008).
 */
export function EventTabs({ items, surface }: { items: EventItem[]; surface: string }) {
  const months = [...new Set(items.map((item) => monthKey(item.date)))].sort();
  const rows = items.map((event) => ({ key: event.date + event.city, month: monthKey(event.date), node: <EventRow event={event} surface={surface} /> }));
  if (months.length < 2) {
    return (
      <ol className="grid gap-2">
        {rows.map((row) => (
          <li key={row.key}>{row.node}</li>
        ))}
      </ol>
    );
  }
  return <EventTabsIsland months={months} rows={rows} />;
}
