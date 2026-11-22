"use client";

import { Badge, cn, Icon, IconButton, Skeleton } from "@linkyo/ui";
import { ArrowLeft, ArrowRight, CircleCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { EmailLocale } from "@/features/email/templates/render";
import { Link, useRouter } from "@/i18n/navigation";
import { browserSupabase } from "@/lib/supabase/browser";

import { useSite } from "../site-context";
import { useScrolled } from "../use-scrolled";

import { BriefingForm, dueParts } from "./briefing-form";

type Status = "paid" | "awaiting_briefing" | "queued" | "in_progress" | "delivered" | "revision_requested" | "completed" | "refunded" | "withdrawn";

interface Proposal {
  id: string;
  round: number;
  status: string;
  deliveredAt: string | null;
}

interface Order {
  id: string;
  number: string;
  package: "start" | "premium";
  status: Status;
  promisedDueAt: string;
  dueAt: string | null;
  briefed: boolean;
  withdrawalPending: boolean;
  proposals: Proposal[];
}

const STATUSES: readonly Status[] = ["paid", "awaiting_briefing", "queued", "in_progress", "delivered", "revision_requested", "completed", "refunded", "withdrawn"];

/** `my_order` as the screen needs it; null when it is not the caller's order. */
function readOrder(value: unknown): Order | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.number !== "string" || typeof row.promisedDueAt !== "string") return null;
  const status = STATUSES.find((candidate) => candidate === row.status) ?? "paid";
  const proposals = Array.isArray(row.proposals) ? (row.proposals as Record<string, unknown>[]) : [];
  return {
    id: row.id,
    number: row.number,
    package: row.package === "premium" ? "premium" : "start",
    status,
    promisedDueAt: row.promisedDueAt,
    dueAt: typeof row.dueAt === "string" ? row.dueAt : null,
    briefed: row.briefed === true,
    withdrawalPending: row.withdrawalPending === true,
    proposals: proposals
      .filter((proposal) => typeof proposal.id === "string")
      .map((proposal) => ({
        id: String(proposal.id),
        round: typeof proposal.round === "number" ? proposal.round : 0,
        status: String(proposal.status),
        deliveredAt: typeof proposal.deliveredAt === "string" ? proposal.deliveredAt : null,
      })),
  };
}

/** A standalone dashboard link: body-coloured, bold, with an icon (ADR 0062). */
const consoleLink = "inline-flex min-h-touch-target items-center gap-2 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring";

/**
 * A page-service order (`/app/orders/<id>`, a full-screen task of the dashboard): its number, status
 * and ready date, the briefing form until the briefing is in (then a note that changes come as a
 * revision round), and the delivered proposals.
 */
export function OrderScreen({ orderId }: { orderId: string }) {
  const t = useTranslations("app.orders");
  const tStatus = useTranslations("orders.status");
  const tPackage = useTranslations("orders.package");
  const locale = useLocale() as EmailLocale;
  const router = useRouter();
  const { account } = useSite();
  const scrolled = useScrolled();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [sentDue, setSentDue] = useState<string | null>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let cancelled = false;
    void browserSupabase()
      .rpc("my_order", { target: orderId })
      .then(({ data }) => {
        if (!cancelled) setOrder(readOrder(data));
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (sentDue) sentRef.current?.focus();
  }, [sentDue]);

  const open = order && !order.briefed && !order.withdrawalPending && (order.status === "paid" || order.status === "awaiting_briefing");
  const due = order ? dueParts(sentDue ?? order.dueAt ?? order.promisedDueAt, locale) : null;
  const delivered = order?.proposals.filter((proposal) => proposal.deliveredAt) ?? [];

  return (
    // data-console="frame": part of the dashboard, black and grey from the first paint (ADR 0062).
    <div data-console="frame" className="flex min-h-dvh flex-col bg-canvas text-fg">
      <header className={cn("sticky top-0 layer-sticky h-16 bg-canvas", scrolled && "border-b border-line")}>
        <div className="mx-auto flex h-full max-w-prose items-center gap-2 pr-[max(var(--spacing-2),env(safe-area-inset-right))] pl-[max(var(--spacing-2),env(safe-area-inset-left))] md:px-6">
          <IconButton icon={X} label={t("back")} onClick={() => router.push("/app")} />
          <h1 className="min-w-0 flex-1 truncate text-body-lg font-semibold">{t("title")}</h1>
        </div>
      </header>

      <main id="main" className="mx-auto grid w-full max-w-prose grid-cols-1 content-start gap-6 px-4 pt-4 pb-12 md:px-8 md:pt-8">
        {order === undefined ? (
          <div className="grid gap-4" aria-hidden>
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : order === null ? (
          <Link href="/app" className={consoleLink}>
            <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
            {t("back")}
          </Link>
        ) : (
          <>
            <section aria-labelledby="order-number" className="grid gap-3 rounded-lg border border-line bg-surface p-4 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="order-number" className="text-h3">
                  <OrderNumber label={t("number", { number: SLOT })} number={order.number} />
                </h2>
                <Badge>{tStatus(order.status)}</Badge>
              </div>
              <p className="text-body text-fg-secondary">{tPackage(order.package)}</p>
              {due ? <p className="text-body font-medium">{t("due", due)}</p> : null}
            </section>

            <section aria-labelledby="briefing-title" className="grid gap-4 rounded-lg border border-line bg-surface p-4 lg:p-6">
              <h2 id="briefing-title" className="text-h3">
                {t("briefing.title")}
              </h2>
              {sentDue && due ? (
                <p ref={sentRef} tabIndex={-1} role="status" className="flex items-start gap-2 text-body font-medium outline-none">
                  <Icon icon={CircleCheck} size="md" className="mt-0.5 shrink-0 text-success-strong" />
                  {t("briefing.sent", due)}
                </p>
              ) : open ? (
                <>
                  <p className="text-body text-pretty text-fg-secondary">{t("briefing.lead")}</p>
                  <BriefingForm orderId={order.id} accountId={account.id} pkg={order.package} onSent={setSentDue} />
                </>
              ) : (
                <p className="text-body text-pretty text-fg-secondary">{t("briefing.locked")}</p>
              )}
            </section>

            {delivered.length > 0 ? (
              <section aria-labelledby="proposals-title" className="grid gap-2 rounded-lg border border-line bg-surface p-4 lg:p-6">
                <h2 id="proposals-title" className="text-h3">
                  {t("proposals")}
                </h2>
                <ul className="grid">
                  {delivered.map((proposal) => (
                    <li key={proposal.id}>
                      <Link href={`/app/proposals/${proposal.id}`} className={consoleLink}>
                        {t("viewProposal")}
                        <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <Link href="/app" className={consoleLink}>
              <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
              {t("back")}
            </Link>
          </>
        )}
      </main>
    </div>
  );
}

/** Stands in for the order number while the sentence is formatted (it gets its own <bdi>). */
const SLOT = "\u0000";

function OrderNumber({ label, number }: { label: string; number: string }) {
  const [before = "", after = ""] = label.split(SLOT);
  return (
    <>
      {before}
      <bdi dir="ltr">{number}</bdi>
      {after}
    </>
  );
}
