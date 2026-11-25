"use client";

import { Badge, Button, cn, Icon, icons, Tooltip } from "@linkyo/ui";
import { EyeOff, FlaskConical, Laptop, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DeviceInfo } from "@/features/account/types";
import { supabaseEnabled } from "@/lib/supabase/config";

import type { Customer, RiskFlag } from "./model";
import { bdi } from "../bidi";

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

/** The device as its glyph alone, named for screen readers ("Handy · iOS · Safari"): for a phone's compact rows. */
export function DeviceGlyph({ device }: { device: DeviceInfo }) {
  const t = useTranslations("admin.security.devices");
  return <Icon icon={DEVICE_ICONS[device.type]} size="sm" label={`${t(device.type)} · ${device.os} · ${device.browser}`} className="text-fg-tertiary" />;
}

/**
 * The device's glyph and its system and browser. A flex box (not inline-flex): an inline box that is
 * too wide is cut by its cell without an ellipsis ("Windows · Chron"). The names are Latin, so they
 * sit in their own isolate that ends in an ellipsis at their end, also in an Arabic row ("Windows ·
 * Chr…", never "…dows · Chrome"); the whole name is the title.
 */
export function DeviceLabel({ device }: { device: DeviceInfo }) {
  const t = useTranslations("admin.security.devices");
  const name = `${device.os} · ${device.browser}`;
  return (
    <span className="flex min-w-0 items-center gap-2" title={name}>
      <Icon
        icon={DEVICE_ICONS[device.type]}
        size="sm"
        label={t(device.type)}
        className="text-fg-tertiary shrink-0"
      />
      <bdi className="min-w-0 truncate">{name}</bdi>
    </span>
  );
}

/**
 * Blocking an address from a sign-in row. On the Security log it shows its word: a red glyph alone
 * on every row read like a status, not like an action. Phones and tablets get the glyph over the
 * word in a 44 × 44 px button; laptops the glyph beside it. It sits above a row whose link covers the
 * row (`layer-raised`). Its name says which address ("127.0.0.1 sperren"), with the word it shows.
 *
 * `compact` (a customer's sign-in cards, where the word would push the time out of the date): the
 * glyph alone, its name as a tooltip too, and a 48 px target on touch screens.
 */
export function BlockButton({ ip, onBlock, compact = false, className }: { ip: string; onBlock: (ip: string) => void; compact?: boolean; className?: string | undefined }) {
  const t = useTranslations("admin.security");
  if (compact) {
    return (
      <Tooltip content={t("blockIp", { ip })}>
        <button
          type="button"
          onClick={() => onBlock(ip)}
          aria-label={t("blockIp", { ip })}
          className={cn(
            "relative layer-raised grid size-control-sm place-items-center rounded-sm text-fg-tertiary transition-colors duration-micro hover:bg-hover hover:text-danger-strong focus-visible:focus-ring before:absolute before:-inset-2 pointer-fine:before:hidden",
            className,
          )}
        >
          <Icon icon={icons.block} size="sm" />
        </button>
      </Tooltip>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={icons.block}
      onClick={() => onBlock(ip)}
      aria-label={t("blockIp", { ip })}
      className={cn(
        "layer-raised text-danger-strong",
        "max-xl:h-auto max-xl:min-h-touch-target max-xl:min-w-touch-target max-xl:flex-col max-xl:gap-0.5 max-xl:px-1 max-xl:py-1 max-xl:text-caption max-xl:before:hidden",
        className,
      )}
    >
      {t("block")}
    </Button>
  );
}

/**
 * In place of customer figures that were not loaded for this role (customers/access.ts): what is
 * missing and why, never a 0 that reads like a count.
 */
export function FiguresWithheld() {
  const t = useTranslations("admin.customers");
  return (
    <section data-figures-withheld aria-labelledby="figures-withheld-title" className="border-line-strong grid justify-items-start gap-3 rounded-xl border border-dashed p-6">
      <span className="bg-canvas-muted text-fg-secondary grid size-control-md place-items-center rounded-md">
        <Icon icon={EyeOff} size="md" />
      </span>
      <h2 id="figures-withheld-title" className="text-h3 text-balance">
        {t("figuresWithheldTitle")}
      </h2>
      <p className="text-small text-fg-secondary max-w-prose text-pretty">{t("figuresWithheldBody")}</p>
    </section>
  );
}

/** Says which numbers are sample data, in every screen that shows them. */
export function DemoNote() {
  const t = useTranslations("admin.customers");
  // Real accounts: nothing on these screens is sample data.
  if (supabaseEnabled) return null;
  return (
    <p className="bg-canvas-muted text-small text-fg-secondary flex items-start gap-2 rounded-md px-3 py-2">
      <Icon icon={FlaskConical} size="sm" className="mt-0.5 shrink-0" />
      <span>{t.rich("demoNote", { bdi })}</span>
    </p>
  );
}
