"use client";

import { Button, Icon } from "@linkyo/ui";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useAppMode } from "@/features/app-mode/use-app-mode";
import { Sheet } from "@/features/app/sheet";
import { formatEuro, PRICES, PRO_DRAFTS } from "@/features/payments/prices";
import { Link } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";

/**
 * Free accounts with their one draft used: more drafts are part of Pro (opened only on Free; Pro at
 * zero waits for next month and is never offered anything). "Get Pro" leads to the Pro checkout once
 * payments exist; until then the sheet says Pro is coming, with no button that cannot do anything.
 * Either way the plan pane (Settings › Plan) is one tap away: the plan, what it holds, drafts left.
 *
 * In the iPhone app (app mode) the sheet only states the fact, that AI drafts are not enabled for this
 * account, and leads to the plan: no "Pro", no price, no "not now" that hints at later, no way to buy
 * (App Store 3.1.1, 3.1.3(f); `appMode.ai`).
 */
export function ProSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("app.ai.pro");
  const tApp = useTranslations("appMode.ai");
  const tPlan = useTranslations("app.settings.plan");
  const locale = useLocale() as "de" | "en" | "ar";
  const app = useAppMode();
  const close = app ? tApp("close") : t("later");
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={app ? tApp("title") : t("title")}
      closeLabel={close}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {close}
          </Button>
          {paymentsEnabled && !app ? (
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
        {app ? null : <p className="text-body">{t("body", { price: formatEuro(PRICES["pro-monthly"].amountCents, locale), count: PRO_DRAFTS })}</p>}
        {paymentsEnabled || app ? null : <p className="text-body font-semibold">{t("soon")}</p>}
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
