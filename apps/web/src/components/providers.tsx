"use client";

import { Toaster, TooltipProvider } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { Direction } from "radix-ui";
import type { ReactNode } from "react";

import { isRtl } from "@/i18n/routing";

/**
 * Tooltips and toasts, for the parts of Linkyo that show them: the dashboard, the team console, the
 * design system and the design prototypes put this in their layouts. The root layout carries only the
 * page's direction (`./page-direction.tsx`), so a page without tooltips or toasts (a creator page)
 * loads none of their code (ADR 0008).
 */
export function Providers({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const locale = useLocale();
  return (
    // Radix components (toggle groups, menus, tooltips) follow the page's direction: in Arabic the
    // first option sits on the right and the arrow keys move right to left.
    <Direction.Provider dir={isRtl(locale) ? "rtl" : "ltr"}>
      <TooltipProvider>
        {children}
        <Toaster closeLabel={t("close")} regionLabel={String(t.raw("notifications"))} />
      </TooltipProvider>
    </Direction.Provider>
  );
}
