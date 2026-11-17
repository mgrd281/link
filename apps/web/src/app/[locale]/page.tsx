import { Icon, Logo } from "@linkyo/ui";
import { ArrowRight, Layers, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const cards = [
    { href: "/design" as const, icon: Palette, title: t("designTitle"), body: t("designBody") },
    { href: "/directions" as const, icon: Layers, title: t("directionsTitle"), body: t("directionsBody") },
  ];
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto grid max-w-content gap-12 px-5 py-24">
        <div className="grid gap-6">
          <Logo className="h-12" />
          <h1 className="max-w-prose text-display tracking-display">{t("title")}</h1>
          <p className="max-w-prose text-body-lg text-fg-secondary">{t("lead")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group grid gap-6 rounded-lg border border-line bg-surface p-6 shadow-e1 transition-[box-shadow,border-color] duration-standard ease-standard hover:border-line-strong hover:shadow-e2 focus-visible:focus-ring"
            >
              <span className="grid size-control-lg place-items-center rounded-md bg-selected text-selected-fg">
                <Icon icon={card.icon} size="md" />
              </span>
              <span className="grid gap-2">
                <span className="text-h3">{card.title}</span>
                <span className="text-body text-fg-secondary">{card.body}</span>
              </span>
              <span className="inline-flex items-center gap-2 text-small font-medium text-link">
                {t("open")}
                <Icon icon={ArrowRight} size="sm" className="transition-transform duration-micro group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
