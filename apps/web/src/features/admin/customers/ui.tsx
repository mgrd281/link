"use client";

import { Badge, Icon } from "@linkyo/ui";
import { FlaskConical, Laptop, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DeviceInfo } from "@/features/account/types";

import type { Customer, RiskFlag } from "./model";

export function PlanBadge({ customer }: { customer: Customer }) {
  const t = useTranslations("admin.customers");
  return customer.subscription.plan === "pro" ? (
    <Badge size="sm" tone="primary">
      Pro
    </Badge>
  ) : (
    <Badge size="sm" tone="outline">
      {t("plans.free")}
    </Badge>
  );
}

/** Subscription state, plus "suspended" and "this device" where they apply. */
export function StatusBadges({ customer }: { customer: Customer }) {
  const t = useTranslations("admin.customers");
  const status = customer.subscription.status;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {status ? (
        <Badge
          size="sm"
          dot
          tone={
            status === "active"
              ? "success"
              : status === "trialing"
                ? "primary"
                : status === "past_due"
                  ? "danger"
                  : "neutral"
          }
        >
          {t(`subscription.${status}`)}
        </Badge>
      ) : null}
      {customer.status === "suspended" ? (
        <Badge size="sm" tone="danger">
          {t("suspended")}
        </Badge>
      ) : null}
      {customer.source === "device" ? (
        <Badge size="sm" tone="warning">
          {t("thisDevice")}
        </Badge>
      ) : null}
    </span>
  );
}

export function RiskBadges({ flags }: { flags: readonly RiskFlag[] }) {
  const t = useTranslations("admin.security.risk");
  if (!flags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <Badge
          key={flag}
          size="sm"
          tone={flag === "failed-burst" || flag === "blocked-ip" ? "danger" : "warning"}
        >
          {t(flag)}
        </Badge>
      ))}
    </span>
  );
}

const DEVICE_ICONS: Record<DeviceInfo["type"], LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Laptop,
};

export function DeviceLabel({ device }: { device: DeviceInfo }) {
  const t = useTranslations("admin.security.devices");
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Icon
        icon={DEVICE_ICONS[device.type]}
        size="sm"
        label={t(device.type)}
        className="text-fg-tertiary shrink-0"
      />
      <span className="truncate">
        {device.os} · {device.browser}
      </span>
    </span>
  );
}

/** Says which numbers are sample data, in every screen that shows them. */
export function DemoNote() {
  const t = useTranslations("admin.customers");
  return (
    <p className="bg-canvas-muted text-small text-fg-secondary flex items-start gap-2 rounded-md px-3 py-2">
      <Icon icon={FlaskConical} size="sm" className="mt-0.5 shrink-0" />
      <span>{t("demoNote")}</span>
    </p>
  );
}
