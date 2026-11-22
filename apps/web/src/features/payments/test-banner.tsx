import { cn, Icon } from "@linkyo/ui";
import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";

import { paymentsMode } from "@/lib/flags";

/**
 * Under the header of every page that takes or ends a contract, in a payments test build: no real
 * money moves here. Live builds show nothing (and only build with real company data).
 */
export function TestBanner({ className }: { className?: string }) {
  const t = useTranslations("legal");
  if (paymentsMode !== "test") return null;
  return (
    <p role="note" className={cn("bg-tinted text-tinted-fg text-small flex items-center justify-center gap-2 px-4 py-2 text-center font-medium", className)}>
      <Icon icon={FlaskConical} size="sm" className="shrink-0" />
      {t("testMode")}
    </p>
  );
}
