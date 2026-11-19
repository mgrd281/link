"use client";

import { detectLink, type Detection } from "@linkyo/blocks";
import { Badge, cn, Icon } from "@linkyo/ui";
import { Clapperboard, CornerDownLeft, Image as ImageIcon, Link2, Music2, Plus, Radio, ShoppingBag, Ticket, Video, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";

const ICONS: Record<string, LucideIcon> = {
  music: Music2,
  video: Video,
  shorts: Clapperboard,
  events: Ticket,
  product: ShoppingBag,
  live: Radio,
  image: ImageIcon,
};

const KNOWN = new Set(["music", "video", "shorts", "events", "product", "live", "image", "card", "link"]);

const EXAMPLES = [
  { label: "Spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" },
  { label: "YouTube", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
  { label: "Twitch", url: "https://www.twitch.tv/milaaurel" },
  { label: "Shop", url: "https://shop.milaaurel.com/products/nachtstrom-vinyl" },
] as const;

interface Added {
  key: string;
  type: string;
  label: string;
  host: string;
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** "Paste a link. Done." — the real detector from @linkyo/blocks, live, with a block that springs in. */
export function PasteDemo() {
  const t = useTranslations("marketing.paste");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [items, setItems] = useState<Added[]>([]);
  const [error, setError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const detection: Detection | null = useMemo(() => (value.trim() ? detectLink(value.trim()) : null), [value]);
  const typeKey = (d: Detection): string => (KNOWN.has(d.type) ? d.type : "link");

  const add = (text: string) => {
    const found = text.trim() ? detectLink(text.trim()) : null;
    if (!found) {
      setError(true);
      return;
    }
    const type = typeKey(found);
    const typeLabel = t(`types.${type}`);
    setItems((current) => [{ key: `${Date.now()}`, type, label: found.label, host: hostOf(found.url) }, ...current].slice(0, 4));
    setAnnouncement(t("added", { type: typeLabel }));
    setValue("");
    setError(false);
  };

  return (
    <div className="grid grid-cols-1 gap-5 rounded-xl border border-line bg-surface p-4 shadow-e2 md:p-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add(value);
        }}
        className="grid min-w-0 grid-cols-1 gap-3"
      >
        <label htmlFor={inputId} className="text-small font-semibold">
          {t("label")}
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-line-input bg-surface-elevated ps-4 pe-2 has-[input:focus-visible]:border-focus has-[input:focus-visible]:focus-ring">
          <Icon icon={Plus} size="md" className="shrink-0 text-fg-tertiary" />
          <input
            ref={inputRef}
            id={inputId}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(false);
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (detectLink(text.trim())) {
                event.preventDefault();
                add(text);
              }
            }}
            dir="ltr"
            inputMode="url"
            autoComplete="off"
            placeholder={t("placeholder")}
            aria-invalid={error || undefined}
            aria-describedby={`${inputId}-hint`}
            className="h-control-xl min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
          />
          <button
            type="submit"
            className="inline-flex h-control-md shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-small font-semibold text-primary-fg shadow-cta transition-colors duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed max-sm:size-control-md sm:px-4"
          >
            {/* Phones: a round "enter" arrow leaves room for the link; the word comes back on wider screens. */}
            <Icon icon={CornerDownLeft} size="md" className="sm:hidden rtl:-scale-x-100" />
            <span className="max-sm:sr-only">{t("add")}</span>
          </button>
        </div>
        <p id={`${inputId}-hint`} className={cn("min-h-control-sm text-small", error ? "text-danger-strong" : "text-fg-secondary")}>
          {error ? t("invalid") : detection ? <Badge tone="primary">{t("detected", { type: t(`types.${typeKey(detection)}`) })}</Badge> : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption font-medium text-fg-tertiary">{t("examples")}</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => {
                add(example.url);
                inputRef.current?.focus();
              }}
              className="inline-flex h-control-sm items-center rounded-full border border-line-strong px-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:border-line-input hover:text-fg focus-visible:focus-ring"
            >
              {example.label}
            </button>
          ))}
        </div>
      </form>

      <div className="grid gap-2">
        <p className="text-small font-semibold">{t("list")}</p>
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong p-5 text-center text-small text-fg-secondary">{t("empty")}</p>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-3 rounded-lg border border-line bg-surface-elevated p-2 pe-2 shadow-e1 motion-safe:animate-pop-in">
                <span className="grid size-control-lg shrink-0 place-items-center rounded-md bg-selected text-selected-fg">
                  <Icon icon={ICONS[item.type] ?? Link2} size="md" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-body font-semibold">{t(`types.${item.type}`)}</span>
                  <span dir="ltr" className="truncate text-start text-small text-fg-secondary">
                    {item.host}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))}
                  aria-label={t("remove", { title: `${t(`types.${item.type}`)} ${item.host}` })}
                  className="grid size-control-md shrink-0 place-items-center rounded-md text-fg-tertiary hover:bg-hover hover:text-fg focus-visible:focus-ring"
                >
                  <Icon icon={X} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
