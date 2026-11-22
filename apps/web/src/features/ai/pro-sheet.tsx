"use client";

import { Button } from "@linkyo/ui";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Sheet } from "@/features/app/sheet";
import { formatEuro, PRICES, PRO_DRAFTS } from "@/features/payments/prices";
import { Link } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";

/**
 * Free accounts with their one draft used: more drafts are part of Pro (opened only on Free; Pro at
 * zero waits for next month and is never offered anything). "Get Pro" leads to the Pro checkout once
 * payments exist; until then the button says Pro is coming, disabled.
 */
export function ProSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("app.ai.pro");
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
            <Button asChild variant="primary" trailing={<ArrowRight className="size-icon-sm rtl:-scale-x-100" aria-hidden />}>
              <Link href="/checkout/pro">{t("get")}</Link>
            </Button>
          ) : (
            <Button variant="primary" disabled>
              {t("soon")}
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
          <Sparkles aria-hidden className="size-icon-lg" />
        </span>
        <p className="text-body">{t("body", { price: formatEuro(PRICES["pro-monthly"].amountCents, locale), count: PRO_DRAFTS })}</p>
      </div>
    </Sheet>
  );
}
