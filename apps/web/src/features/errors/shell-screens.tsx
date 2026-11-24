"use client";

import { Button, Icon } from "@linkyo/ui";
import { CircleAlert, SearchX, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

/**
 * Inside the dashboard's or the team area's frame (their rail and bars stay): a screen that does not
 * exist or failed. Only the content column is replaced, so every other place is still one tap away.
 * The semantic classes follow the frame's palette: black and grey in the dashboard, teal in the team
 * area.
 */
function ShellMessage({ icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-prose justify-items-center gap-4 px-4 pt-16 pb-10 text-center">
      <span className="grid size-control-xl place-items-center rounded-full border border-line bg-surface text-fg-secondary">
        <Icon icon={icon} size="lg" />
      </span>
      <div className="grid gap-1">
        <h1 className="text-title text-balance rtl:tracking-normal">{title}</h1>
        <p className="text-small font-regular text-pretty text-fg-secondary">{body}</p>
      </div>
      {children}
    </div>
  );
}

export function ShellNotFound({ area }: { area: "app" | "admin" }) {
  const t = useTranslations("errors");
  return (
    <ShellMessage icon={SearchX} title={t("notFound.title")} body={area === "app" ? t("notFound.appBody") : t("notFound.teamBody")}>
      <Button asChild variant="primary">
        <Link href={area === "app" ? "/app" : "/admin"}>{area === "app" ? t("actions.dashboard") : t("actions.team")}</Link>
      </Button>
    </ShellMessage>
  );
}

export function ShellError({ retry }: { retry: () => void }) {
  const t = useTranslations("errors");
  return (
    <ShellMessage icon={CircleAlert} title={t("error.title")} body={t("error.body")}>
      <Button variant="primary" onClick={retry}>
        {t("actions.retry")}
      </Button>
    </ShellMessage>
  );
}
