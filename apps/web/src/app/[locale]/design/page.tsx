import { tokens } from "@linkyo/tokens";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";

import { SiteHeader } from "@/components/site-header";
import { ButtonSection, ControlsSection, StatesSection } from "@/features/design-system/components-showcase";
import { CreatorThemesSection } from "@/features/design-system/creator-playground";
import { BrandSection, ColorSection, LayoutSection, TypeSection } from "@/features/design-system/foundations";
import { IconSection, MotionSection } from "@/features/design-system/motion-icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "design" });
  return { title: t("title") };
}

function countLeaves(node: unknown): number {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return 1;
  const record = node as Record<string, unknown>;
  if ("light" in record && "dark" in record) return 1;
  return Object.values(record).reduce<number>((sum, child) => sum + countLeaves(child), 0);
}

const SECTIONS = ["brand", "color", "type", "layout", "motion", "icons", "buttons", "controls", "states", "creator"] as const;

export default function DesignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("design");
  const stats = [
    { value: countLeaves(tokens).toLocaleString(locale), label: t("stats.tokens") },
    { value: "18", label: t("stats.components") },
    { value: (4000 * 19).toLocaleString(locale), label: t("stats.pairs") },
    { value: "3", label: t("stats.locales") },
  ];
  return (
    <>
      <SiteHeader active="design" />
      <div className="mx-auto flex max-w-content gap-12 px-5">
        <aside className="hidden w-sidebar shrink-0 lg:block" aria-label={t("toc")}>
          <nav className="sticky top-24 grid gap-1 py-16">
            <p className="mb-2 text-caption font-medium text-fg-tertiary">{t("toc")}</p>
            {SECTIONS.map((id, index) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex items-center gap-3 rounded-sm px-2 py-1 text-small text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring"
              >
                <span className="font-mono text-caption text-fg-tertiary">{String(index + 1).padStart(2, "0")}</span>
                {t(`${id}.title`)}
              </a>
            ))}
          </nav>
        </aside>
        <main id="main" className="min-w-0 flex-1 pb-24">
          <header className="grid gap-6 py-16">
            <h1 className="text-display tracking-display">{t("title")}</h1>
            <p className="max-w-prose text-body-lg text-fg-secondary">{t("lead")}</p>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="grid gap-1 bg-surface p-5">
                  <dt className="order-2 text-small text-fg-secondary">{stat.label}</dt>
                  <dd className="order-1 font-mono text-h2">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </header>
          <BrandSection />
          <ColorSection />
          <TypeSection />
          <LayoutSection />
          <MotionSection />
          <IconSection />
          <ButtonSection />
          <ControlsSection />
          <StatesSection />
          <CreatorThemesSection />
        </main>
      </div>
    </>
  );
}
