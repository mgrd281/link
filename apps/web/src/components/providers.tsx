"use client";

import { Toaster, TooltipProvider } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { Direction } from "radix-ui";
import type { ReactNode } from "react";

import { isRtl } from "@/i18n/routing";

export function Providers({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const locale = useLocale();
  return (
    // Radix components (toggle groups, menus, tooltips) follow the page's direction: in Arabic the
    // first option sits on the right and the arrow keys move right to left.
    <Direction.Provider dir={isRtl(locale) ? "rtl" : "ltr"}>
      <TooltipProvider>
        {children}
        <Toaster closeLabel={t("close")} regionLabel={t("notifications")} />
      </TooltipProvider>
    </Direction.Provider>
  );
}
