"use client";

import { Icon, Segmented } from "@linkyo/ui";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";

import { Screen } from "@/features/app/screen";
import { CardFace, type GalleryItem } from "@/features/examples/gallery-card";

/** One design of the theme engine, prepared on the server: its name, line and colours. */
export interface DesignCard {
  id: string;
  label: string;
  description: string;
  style: CSSProperties;
}

type Filter = "designs" | "examples" | "people";

const cardLink = "group grid gap-2 rounded-lg focus-visible:focus-ring md:rounded-xl";

/**
 * Vorlagen: every design the editor offers and every page of the public gallery, in one place for the
 * team. Each card opens the real page in a new tab; nothing here changes data.
 */
export function TemplatesScreen({
  designs,
  examples,
  people,
}: {
  designs: DesignCard[];
  examples: GalleryItem[];
  people: GalleryItem[];
}) {
  const t = useTranslations("admin.templates");
  const tGallery = useTranslations("examples");
  const [filter, setFilter] = useState<Filter>("designs");
  const label = (item: GalleryItem) =>
    item.badge ? tGallery(`badges.${item.badge}`) : tGallery(`categories.${item.category}`);
  const pages = filter === "examples" ? examples : people;

  return (
    <Screen
      title={t("title")}
      lead={t("lead", { designs: designs.length, pages: examples.length + people.length })}
      wide
    >
      <div className="grid grid-cols-1 gap-6">
        <Segmented<Filter>
          label={t("filterLabel")}
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "designs", label: t("designs", { count: designs.length }) },
            { value: "examples", label: t("examples", { count: examples.length }) },
            { value: "people", label: t("people", { count: people.length }) },
          ]}
        />

        {filter === "designs" ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {designs.map((design) => (
              <li key={design.id}>
                <a
                  href={`/directions/poster?template=${design.id}`}
                  target="_blank"
                  rel="noopener"
                  className={cardLink}
                >
                  <span
                    style={design.style}
                    aria-hidden
                    className="aspect-portrait border-line bg-creator-bg font-creator-body text-creator-fg grid content-end gap-2 overflow-hidden rounded-lg border p-4 md:rounded-xl"
                  >
                    <span className="font-creator-display text-h2 leading-none">Aa</span>
                    <span className="h-control-sm rounded-creator-button bg-creator-accent w-2/3" />
                    <span className="bg-creator-surface-2 h-2 w-full rounded-full" />
                    <span className="bg-creator-surface-2 h-2 w-1/2 rounded-full" />
                  </span>
                  <span className="grid gap-1">
                    <span className="text-body group-hover:text-link flex items-center gap-1 font-semibold">
                      {design.label}
                      <Icon icon={ExternalLink} size="sm" className="text-fg-tertiary shrink-0" />
                    </span>
                    <span className="text-small text-fg-secondary line-clamp-2">{design.description}</span>
                    <span className="sr-only">{t("newTab")}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pages.map((item) => (
              <li key={item.slug}>
                <a
                  href={`/${item.locale}/p/${item.slug}`}
                  target="_blank"
                  rel="noopener"
                  className={cardLink}
                >
                  <span aria-hidden>
                    <CardFace item={item} label={label(item)} />
                  </span>
                  <span className="grid gap-1">
                    <span
                      lang={item.locale}
                      className="text-body group-hover:text-link truncate font-semibold"
                    >
                      {item.name}
                    </span>
                    <span className="text-small text-fg-secondary truncate">
                      <bdi dir="ltr">/p/{item.slug}</bdi>
                    </span>
                    <span className="sr-only">{t("newTab")}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}
