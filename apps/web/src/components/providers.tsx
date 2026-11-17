"use client";

import { Toaster, TooltipProvider } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  return (
    <TooltipProvider>
      {children}
      <Toaster closeLabel={t("close")} />
    </TooltipProvider>
  );
}
