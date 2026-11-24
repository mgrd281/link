"use client";

import { Button, Icon } from "@linkyo/ui";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Sheet } from "@/features/app/sheet";
import { formatEuro, PRICES, PRO_DRAFTS } from "@/features/payments/prices";
import { Link } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";

/**
 * Free accounts with their one draft used: more drafts are part of Pro (opened only on Free; Pro at
 * zero waits for next month and is never offered anything). "Get Pro" leads to the Pro checkout once
 * payments exist; until then the sheet says Pro is coming, with no button that cannot do anything.
 * Either way the plan pane (Settings › Plan) is one tap away: the plan, what it holds, drafts left.
 */
export function ProSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("app.ai.pro");
  const tPlan = useTranslations("app.settings.plan");
  const locale = useLocale() as "de" | "en" | "ar";
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      closeLabel={t("later")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("later")}
          </Button>
          {paymentsEnabled ? (
            <Button asChild variant="primary" trailing={<Icon icon={ArrowRight} size="sm" />}>
              <Link href="/checkout/pro">{t("get")}</Link>
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
          <Sparkles aria-hidden className="size-icon-lg" />
        </span>
        <p className="text-body">{t("body", { price: formatEuro(PRICES["pro-monthly"].amountCents, locale), count: PRO_DRAFTS })}</p>
        {paymentsEnabled ? null : <p className="text-body font-semibold">{t("soon")}</p>}
        {/* A standalone link (bold, with a chevron), as links are in the dashboard. */}
        <Link
          href="/app/settings/plan"
          onClick={() => onOpenChange(false)}
          className="inline-flex items-center gap-1 justify-self-start rounded-sm font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring"
        >
          {tPlan("open")}
          <Icon icon={ChevronRight} size="sm" />
        </Link>
      </div>
    </Sheet>
  );
}
