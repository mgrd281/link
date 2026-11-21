"use client";

import { Button, Icon } from "@linkyo/ui";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * A screen in the dashboard failed to render. Only that screen is replaced: the sidebar and the tab
 * bar stay, so every other place is still one tap away, and saved work is untouched.
 */
export default function ShellError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("app.crash");
  return (
    <div className="mx-auto grid max-w-prose justify-items-center gap-4 px-4 pt-16 pb-10 text-center">
      <span className="grid size-control-xl place-items-center rounded-full bg-danger-subtle text-danger-strong">
        <Icon icon={CircleAlert} size="lg" />
      </span>
      <div className="grid gap-1">
        <h1 className="text-title text-balance rtl:tracking-normal">{t("title")}</h1>
        <p className="text-small font-regular text-fg-secondary">{t("body")}</p>
      </div>
      <Button variant="primary" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
