"use client";

import { cn, Icon } from "@linkyo/ui";
import { ArrowRight, Camera, CodeXml, PenTool, type LucideIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

import { CardFace, type GalleryItem } from "@/features/examples/gallery-card";
import { Link } from "@/i18n/navigation";

import type { Profession } from "./model";

const ICONS: Record<Profession, LucideIcon> = { photography: Camera, design: PenTool, build: CodeXml };

/** One field's tab, prepared on the server: its pages as cards and its templates with their words. */
export interface FieldTab {
  key: Profession;
  label: string;
  pages: { item: GalleryItem; href: string; open: string; template: ReactNode }[];
  templates: { id: string; name: ReactNode; description: string; start: string; startLabel: ReactNode }[];
}

/**
 * The fields as tabs (photography, design and architecture, development and crafts). Each shows its
 * templates in words, with "Start with this template", beside its example pages as the gallery's
 * cards in their own colours. Tabs follow the reading direction (arrow keys mirror in Arabic).
 */
export function PortfolioFields({ tabs, label, chip }: { tabs: FieldTab[]; label: string; chip: string }) {
  const locale = useLocale();
  const first = tabs[0];
  if (!first) return null;
  return (
    <Tabs.Root defaultValue={first.key} dir={locale === "ar" ? "rtl" : "ltr"} className="mt-8 grid gap-8 md:mt-10">
      {/* Phones: equal segments, the icon over a label that may wrap (nothing scrolls sideways);
          wider screens: one row of pills. */}
      <Tabs.List
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-canvas-muted p-1 md:inline-flex md:w-max md:justify-self-start md:rounded-full"
      >
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.key}
            value={tab.key}
            className="flex min-h-touch-target flex-col items-center justify-center gap-1 rounded-lg border border-transparent px-2 py-2 text-center text-caption font-semibold text-balance text-fg-secondary transition-colors duration-micro hover:text-fg focus-visible:focus-ring data-[state=active]:border-line data-[state=active]:bg-surface-elevated data-[state=active]:text-fg md:h-control-md md:flex-row md:gap-2 md:rounded-full md:px-4 md:py-0 md:text-small md:whitespace-nowrap"
          >
            <Icon icon={ICONS[tab.key]} size="sm" className="shrink-0" />
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content
          key={tab.key}
          value={tab.key}
          forceMount
          className="grid gap-8 rounded-xl focus-visible:focus-ring data-[state=inactive]:hidden lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12"
        >
          <ul className="grid content-start gap-6">
            {tab.templates.map((template) => (
              <li key={template.id} className="grid justify-items-start gap-2 border-t border-line pt-5 first:border-t-0 first:pt-0">
                <h3 className="text-h3 tracking-tight">{template.name}</h3>
                <p className="max-w-prose text-body text-pretty text-fg-secondary">{template.description}</p>
                <Link
                  href={template.start}
                  className="group -mx-2 inline-flex min-h-touch-target items-center gap-2 rounded-full px-2 text-body font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed"
                >
                  {template.startLabel}
                  <Icon icon={ArrowRight} size="sm" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
          {/* One page stands alone at a readable size; several share the row. */}
          <ul className={cn("grid gap-4 lg:gap-6", tab.pages.length === 1 ? "max-w-preview-compact grid-cols-1" : tab.pages.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
            {tab.pages.map((page) => (
              <li key={page.item.slug} className="grid content-start gap-2">
                {/* The card is a picture of the page; the link's name says where it leads (as in the gallery). */}
                <a
                  href={page.href}
                  className="group block rounded-lg transition-[translate] duration-standard ease-standard hover:-translate-y-1 focus-visible:focus-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:rounded-xl"
                >
                  <span className="sr-only">{page.open}</span>
                  <span aria-hidden className="block">
                    <CardFace item={page.item} label={chip} />
                  </span>
                </a>
                <p className="px-1 text-caption text-fg-secondary">{page.template}</p>
              </li>
            ))}
          </ul>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
