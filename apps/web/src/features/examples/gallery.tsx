"use client";

import { cn, Icon, IconButton } from "@linkyo/ui";
import { ArrowRight, ExternalLink, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useState, type CSSProperties } from "react";

import { MediaImage, Monogram } from "@/features/directions/shared/creator-kit";
import { displayStyle } from "@/features/directions/poster/styles";
import { Link } from "@/i18n/navigation";

import { CATEGORIES, type Category } from "./looks";

/** Everything a card needs, prepared on the server (theme already resolved to CSS variables). */
export interface GalleryItem {
  slug: string;
  name: string;
  tagline: string;
  category: Category;
  locale: "de" | "en" | "ar";
  style: CSSProperties;
  photo: string | null;
  logo: string | null;
  hero: "portrait" | "logo" | "duotone";
  links: string[];
  signup: string;
}

const thumbSizes = "(max-width: 40rem) 50vw, (max-width: 64rem) 33vw, 25vw";

/** A miniature of the page in its own colors and fonts: picture, name, line, first two buttons. */
function Miniature({ item }: { item: GalleryItem }) {
  const logo = item.hero === "logo" && item.logo;
  return (
    <div
      style={item.style}
      dir={item.locale === "ar" ? "rtl" : "ltr"}
      lang={item.locale}
      className="relative aspect-portrait overflow-hidden rounded-xl border border-line bg-creator-bg font-creator-body text-creator-fg shadow-e1 transition-[translate,box-shadow] duration-standard ease-standard group-hover:-translate-y-1 group-hover:shadow-e3 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
    >
      <div className={cn("absolute inset-x-0 top-0 h-3/5 overflow-hidden mask-b-from-40% mask-b-to-100%", item.hero === "duotone" && "isolate bg-creator-bg")}>
        {item.photo ? (
          <MediaImage
            src={item.photo}
            alt=""
            sizes={thumbSizes}
            className={cn(logo && "scale-lift blur-glass", item.hero === "duotone" && "grayscale contrast-125 mix-blend-screen")}
          />
        ) : (
          <Monogram name={item.name} className="text-display" />
        )}
        {logo ? (
          <>
            <div aria-hidden className="absolute inset-0 bg-creator-bg opacity-secondary" />
            <span className="absolute inset-x-1/4 top-1/2 aspect-square -translate-y-1/2">
              <MediaImage src={item.logo ?? ""} alt="" sizes={thumbSizes} className="object-contain" />
            </span>
          </>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 grid gap-2 p-3">
        {logo ? null : (
          <p className="truncate font-creator-display text-h3 leading-tight" style={displayStyle}>
            {item.name}
          </p>
        )}
        <p className="truncate text-caption text-creator-fg-muted">{item.tagline}</p>
        {item.links.slice(0, 2).map((title) => (
          <span key={title} className="block truncate rounded-creator-button bg-creator-surface px-3 py-2 text-caption font-medium">
            {title}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The gallery: filter by category, tap a page to try it in a phone-sized preview, then use it as a
 * template (sign-up starts with exactly that look) or open the full page.
 */
export function ExampleGallery({ items }: { items: GalleryItem[] }) {
  const t = useTranslations("examples");
  const [category, setCategory] = useState<Category | "all">("all");
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const shown = category === "all" ? items : items.filter((item) => item.category === category);
  const count = (key: Category) => items.filter((item) => item.category === key).length;

  return (
    <>
      <div role="group" aria-label={t("filter")} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(["all", ...CATEGORIES] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={category === key}
            onClick={() => setCategory(key)}
            className="inline-flex h-control-md shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-small font-medium text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring aria-pressed:border-transparent aria-pressed:bg-fg aria-pressed:text-canvas"
          >
            {key === "all" ? t("all") : t(`categories.${key}`)}
            <span className="tabular-nums">{key === "all" ? items.length : count(key)}</span>
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
        {shown.map((item) => (
          <li key={item.slug} className="grid content-start gap-3">
            <button type="button" onClick={() => setOpen(item)} className="group block rounded-xl text-start focus-visible:focus-ring">
              <span className="sr-only">{t("preview", { name: item.name })}</span>
              {/* The miniature is a picture of the page; the button's name says what it does. */}
              <span aria-hidden className="block">
                <Miniature item={item} />
              </span>
            </button>
            <div className="grid gap-0.5 px-1">
              <p dir="auto" className="truncate text-small font-semibold">
                {item.name}
              </p>
              <p className="truncate text-caption text-fg-secondary">
                {t(`categories.${item.category}`)} · {t(`languages.${item.locale}`)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <Dialog.Root open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <Dialog.Portal>
          <Dialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            className="layer-modal fixed inset-0 flex flex-col gap-3 p-3 outline-none motion-safe:animate-pop-in sm:p-6 lg:flex-row lg:items-center lg:justify-center lg:gap-8"
          >
            {open ? (
              <>
                <div className="flex items-center justify-between gap-2 lg:hidden">
                  <Dialog.Title className="truncate rounded-full bg-surface-elevated px-3 py-1 text-small font-semibold text-fg shadow-e1">{open.name}</Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton icon={X} label={t("close")} variant="secondary" />
                  </Dialog.Close>
                </div>
                <div className="relative mx-auto min-h-0 w-full max-w-preview flex-1 overflow-hidden rounded-xl border border-line-strong bg-ink p-1 shadow-e3 lg:mx-0 lg:h-full lg:max-h-dvh lg:flex-none">
                  <iframe title={t("frame", { name: open.name })} src={`/${open.locale}/p/${open.slug}`} className="size-full rounded-lg bg-canvas" />
                </div>
                <div className="grid gap-2 rounded-xl bg-surface-elevated p-3 text-fg shadow-e3 lg:w-sidebar lg:gap-4 lg:p-5">
                  <div className="hidden items-start justify-between gap-2 lg:flex">
                    <p className="text-h3">{open.name}</p>
                    <Dialog.Close asChild>
                      <IconButton icon={X} label={t("close")} />
                    </Dialog.Close>
                  </div>
                  <p className="hidden text-small text-fg-secondary lg:block">
                    {t(`categories.${open.category}`)} · {t(`languages.${open.locale}`)}
                  </p>
                  <Link
                    href={open.signup}
                    className="inline-flex h-control-lg items-center justify-center gap-2 rounded-md bg-primary px-5 text-body font-semibold text-primary-fg shadow-e1 transition-colors duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
                  >
                    {t("use")}
                    <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
                  </Link>
                  <p className="hidden text-caption text-fg-secondary lg:block">{t("useHint")}</p>
                  <a
                    href={`/${open.locale}/p/${open.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-control-md items-center justify-center gap-2 rounded-md px-4 text-small font-semibold text-fg hover:bg-hover focus-visible:focus-ring"
                  >
                    {t("open")}
                    <Icon icon={ExternalLink} size="sm" />
                  </a>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
