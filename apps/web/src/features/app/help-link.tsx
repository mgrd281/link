"use client";

import { cn, Icon } from "@linkyo/ui";
import { CircleHelp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { HelpSlug } from "@/features/help/articles";
import { Link } from "@/i18n/navigation";

import { ListGroup, ListRow } from "./list";
import { helpLink } from "./routes";

/** The articles a dashboard screen links to by name (W-04); each has its words under `app.settings.helpLinks`. */
export type ScreenHelp = Extract<HelpSlug, "statistik" | "seitenadresse" | "impressum" | "konto-loeschen" | "teilen">;

/**
 * A screen's way to its help article on /hilfe, in the same tab: a link as the dashboard draws one
 * (body coloured, bold, with an icon, `hover:text-link-hover`), never inside running text. On touch
 * screens its target grows to 44 px with a `::before`.
 */
export function HelpLink({ slug, className }: { slug: ScreenHelp; className?: string }) {
  const t = useTranslations("app.settings");
  const locale = useLocale();
  return (
    <Link
      href={helpLink(locale, slug)}
      data-help={slug}
      className={cn(
        "relative inline-flex items-center gap-2 justify-self-start rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring",
        "before:absolute before:inset-x-0 before:-inset-y-3 pointer-fine:before:hidden",
        className,
      )}
    >
      <Icon icon={CircleHelp} size="sm" className="shrink-0" />
      {/* The name says it is help ("Hilfe: Wie Linkyo zählt"); the eye has the glyph. */}
      <span className="sr-only">{t("groups.help")}: </span>
      {t(`helpLinks.${slug}`)}
    </Link>
  );
}

/** The same way to an article as a group of its own (beside a form pane's fields on laptops). */
export function HelpGroup({ slug }: { slug: ScreenHelp }) {
  const t = useTranslations("app.settings");
  const locale = useLocale();
  return (
    <ListGroup title={t("groups.help")}>
      <ListRow icon={CircleHelp} title={t(`helpLinks.${slug}`)} subtitle={t(`helpLeads.${slug}`)} subtitleWrap href={helpLink(locale, slug)} />
    </ListGroup>
  );
}
