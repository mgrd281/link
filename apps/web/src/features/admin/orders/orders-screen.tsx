"use client";

import { Badge, Icon, Segmented, Skeleton } from "@linkyo/ui";
import { CircleAlert, Inbox, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Screen } from "@/features/app/screen";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

import { useAdmin } from "../session";

import { AiSwitch } from "./ai-switch";
import { ContractsPanel, SlaBadge } from "./contracts-panel";
import { loadQueue, type OrderPackage, type OrderScope, type OrderStatus, type QueueOrder } from "./orders-data";

const SCOPES: readonly OrderScope[] = ["open", "mine", "delivered", "all"];

/** The clock the chips count from; it moves once a minute. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("orders.status");
  const tone = status === "delivered" || status === "completed" ? "success" : status === "refunded" || status === "withdrawn" ? "neutral" : status === "revision_requested" ? "warning" : "primary";
  return (
    <Badge size="sm" tone={tone}>
      {t(status)}
    </Badge>
  );
}

export function PackageBadge({ value }: { value: OrderPackage }) {
  const t = useTranslations("orders.package");
  return (
    <Badge size="sm" tone={value === "premium" ? "primary" : "outline"}>
      {t(value)}
    </Badge>
  );
}

/** The withdrawal chip that replaces the due chip while a withdrawal waits for a decision. */
export function WithdrawalBadge() {
  const t = useTranslations("admin.orders");
  return (
    <Badge size="sm" tone="danger" data-withdrawal-pending>
      <Icon icon={CircleAlert} size="sm" />
      {t("withdrawalPending")}
    </Badge>
  );
}

function DueCell({ order, now }: { order: QueueOrder; now: Date }) {
  if (order.withdrawalPending) return <WithdrawalBadge />;
  const open = !["delivered", "completed", "refunded", "withdrawn"].includes(order.status);
  if (!order.due || !open) return <span className="text-fg-tertiary">–</span>;
  return <SlaBadge due={order.due} now={now} />;
}

function Customer({ order }: { order: QueueOrder }) {
  return (
    <span className="grid min-w-0">
      {order.customer.username ? (
        <span dir="ltr" className="truncate text-start font-medium">
          @{order.customer.username}
        </span>
      ) : null}
      <span dir="ltr" className="truncate text-start text-caption text-fg-secondary">
        {order.customer.email}
      </span>
    </span>
  );
}

function Queue({ scope, now }: { scope: OrderScope; now: Date }) {
  const t = useTranslations("admin.orders");
  const [orders, setOrders] = useState<QueueOrder[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadQueue(scope)
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setOrders(list);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  if (orders === null) {
    return (
      <div className="grid gap-3" aria-hidden>
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-line bg-surface p-4 text-small text-fg-secondary">
        <Icon icon={Inbox} size="sm" />
        {t("empty")}
      </p>
    );
  }
  const assignee = (order: QueueOrder) =>
    order.assignee ? (
      <span dir="ltr" className="truncate">
        {order.assignee.label}
      </span>
    ) : (
      <span className="text-fg-tertiary">{t("unassigned")}</span>
    );

  return (
    <>
      {/* Phones: one card per order. */}
      <ul data-orders-list className="grid gap-3 md:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/admin/orders/${order.id}`}
              data-order={order.number}
              className="grid gap-3 rounded-lg border border-line bg-surface p-4 transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
            >
              <span className="flex flex-wrap items-center gap-2">
                <bdi className="text-body font-semibold tabular-nums">{order.number}</bdi>
                <PackageBadge value={order.package} />
                <StatusBadge status={order.status} />
              </span>
              <Customer order={order} />
              <span className="flex flex-wrap items-center justify-between gap-2 text-small">
                <DueCell order={order} now={now} />
                <span className="inline-flex min-w-0 items-center gap-1 text-fg-secondary">
                  <Icon icon={UserRound} size="sm" className="shrink-0" />
                  {assignee(order)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* From md: a table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block" role="region" aria-label={t("title")} tabIndex={0}>
        <table data-orders-table className="w-full text-small">
          <thead className="text-caption text-fg-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t("cols.number")}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t("cols.package")}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t("cols.customer")}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t("cols.status")}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t("cols.due")}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t("cols.assignee")}
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} data-order={order.number} className="border-t border-line hover:bg-hover">
                <th scope="row" className="px-4 py-3 text-start font-regular">
                  <Link href={`/admin/orders/${order.id}`} className="rounded-xs font-semibold whitespace-nowrap text-link tabular-nums transition-colors duration-micro hover:text-fg focus-visible:focus-ring">
                    <bdi>{order.number}</bdi>
                  </Link>
                </th>
                <td className="px-4 py-3">
                  <PackageBadge value={order.package} />
                </td>
                <td className="px-4 py-3">
                  <Customer order={order} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3">
                  <DueCell order={order} now={now} />
                </td>
                <td className="px-4 py-3">{assignee(order)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * The page-service queue (`/admin/orders`, teal like the whole team area): orders by deadline with an
 * SLA chip that always has words, withdrawals waiting for a decision first; a second tab with
 * withdrawals and cancellations; the AI switch in the header.
 */
export function OrdersScreen() {
  const t = useTranslations("admin.orders");
  const { can } = useAdmin();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const now = useMinuteClock();
  const contracts = can("billing.view");
  const tab = params.get("tab") === "contracts" && contracts ? "contracts" : "orders";
  const [scope, setScope] = useState<OrderScope>(SCOPES.find((value) => value === params.get("scope")) ?? "open");

  return (
    <Screen title={t("title")} lead={t("lead")} wide>
      {/* Under the title (not beside it): on a phone the title keeps the full width. */}
      <div className="flex justify-start">
        <AiSwitch />
      </div>
      {contracts ? (
        <Segmented
          label={t("title")}
          value={tab}
          onValueChange={(next) => router.replace(next === "contracts" ? `${pathname}?tab=contracts` : pathname)}
          options={[
            { value: "orders", label: t("tabs.orders") },
            { value: "contracts", label: t("tabs.contracts") },
          ]}
        />
      ) : null}
      {tab === "orders" ? (
        <div className="grid gap-4">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <Segmented
              label={t("tabs.orders")}
              size="sm"
              value={scope}
              onValueChange={setScope}
              className="whitespace-nowrap"
              options={SCOPES.map((value) => ({ value, label: t(`filters.${value}`) }))}
            />
          </div>
          {/* A new filter is a new list (it starts from its skeleton). */}
          <Queue key={scope} scope={scope} now={now} />
        </div>
      ) : (
        <ContractsPanel now={now} />
      )}
    </Screen>
  );
}
