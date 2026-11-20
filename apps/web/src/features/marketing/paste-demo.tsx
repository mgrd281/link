"use client";

import { detectLink, type Detection } from "@linkyo/blocks";
import { cn, Icon, PlatformIcon } from "@linkyo/ui";
import { CircleCheck, Clapperboard, Image as ImageIcon, Link2, Music2, Plus, Radio, ShoppingBag, Ticket, Video, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { siSpotify, siTwitch, siYoutube, type SimpleIcon } from "simple-icons";

const ICONS: Record<string, LucideIcon> = {
  music: Music2,
  video: Video,
  shorts: Clapperboard,
  events: Ticket,
  product: ShoppingBag,
  live: Radio,
  image: ImageIcon,
};

const PLATFORM_ICONS: Partial<Record<string, SimpleIcon>> = { spotify: siSpotify, youtube: siYoutube, twitch: siTwitch };

const KNOWN = new Set(["music", "video", "shorts", "events", "product", "live", "image", "card", "link"]);

const EXAMPLES = [
  { label: "Spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", icon: siSpotify },
  { label: "YouTube", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", icon: siYoutube },
  { label: "Twitch", url: "https://www.twitch.tv/milaaurel", icon: siTwitch },
  { label: "Shop", url: "https://shop.milaaurel.com/products/nachtstrom-vinyl", icon: null },
] as const;

/** What the demo shows by itself, once: two links "pasted", one after the other. */
const TOUR = [EXAMPLES[0].url, EXAMPLES[1].url] as const;

interface Added {
  key: string;
  type: string;
  platform: string | undefined;
  host: string;
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const typeKey = (detection: Detection): string => (KNOWN.has(detection.type) ? detection.type : "link");

/** The block's picture: the platform's own mark when it is known, otherwise an icon for its kind. */
function BlockIcon({ type, platform }: { type: string; platform: string | undefined }) {
  const mark = platform ? PLATFORM_ICONS[platform] : undefined;
  return mark ? <PlatformIcon icon={mark} size="md" /> : <Icon icon={ICONS[type] ?? Link2} size="md" />;
}

/**
 * "Paste a link. Done." The real detector from @linkyo/blocks, live: paste or type any link (or tap
 * an example) and the right block springs onto the page below.
 *
 * The first time it scrolls into view it shows itself once: a Spotify link appears in the field,
 * is recognised, becomes a block; then a YouTube link. It stops for good the moment someone
 * touches it (a link it left in the field stays, selected: Enter adds it, typing replaces it), and
 * it is quiet for screen readers (only the visitor's own additions are announced).
 */
export function PasteDemo() {
  const t = useTranslations("marketing.paste");
  const inputId = useId();
  const root = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const touched = useRef(false);
  const [value, setValue] = useState("");
  const [items, setItems] = useState<Added[]>([]);
  const [error, setError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const detection: Detection | null = value.trim() ? detectLink(value.trim()) : null;

  const add = (text: string, quietly = false) => {
    const found = text.trim() ? detectLink(text.trim()) : null;
    if (!found) {
      setError(true);
      return;
    }
    const type = typeKey(found);
    setItems((current) => [{ key: `${Date.now()}-${current.length}`, type, platform: found.platform, host: hostOf(found.url) }, ...current].slice(0, 3));
    if (!quietly) setAnnouncement(t("added", { type: t(`types.${type}`) }));
    setValue("");
    setError(false);
  };

  // The tour: once, when at least half of the demo is on screen, unless someone got there first.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (!touched.current) run();
        }, ms),
      );
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || touched.current) return;
        observer.disconnect();
        TOUR.forEach((url, index) => {
          const start = 700 + index * 1900;
          later(start, () => {
            setValue(url);
          });
          later(start + 1000, () => {
            add(url, true);
          });
        });
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
    // add only uses setters and the translator: running the tour once per mount is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The visitor took over: the tour stops where it is. */
  const takeOver = () => {
    touched.current = true;
  };

  const detectedType = detection ? t(`types.${typeKey(detection)}`) : null;

  return (
    <div ref={root} onPointerDownCapture={takeOver} onFocusCapture={takeOver} onKeyDownCapture={takeOver} className="grid w-full grid-cols-1 gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add(value);
        }}
        className="grid min-w-0 grid-cols-1 gap-2"
      >
        <label htmlFor={inputId} className="sr-only">
          {t("label")}
        </label>
        <div className="flex h-control-lg items-center gap-2 rounded-full border border-transparent bg-canvas-muted ps-4 pe-1 transition-colors duration-micro has-[input:focus-visible]:border-link has-[input:focus-visible]:focus-ring">
          <Icon icon={Link2} size="md" className="shrink-0 text-fg-tertiary" />
          <input
            ref={inputRef}
            id={inputId}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(false);
            }}
            // A link the tour left in the field is selected on focus: Enter adds it, typing replaces it.
            onFocus={(event) => {
              const field = event.currentTarget;
              if (TOUR.some((url) => url === field.value)) field.select();
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
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("placeholder")}
            aria-invalid={error || undefined}
            aria-describedby={`${inputId}-hint`}
            className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
          />
          <button
            type="submit"
            aria-label={t("add")}
            className="grid size-control-md shrink-0 place-items-center rounded-full bg-primary text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
          >
            <Icon icon={Plus} size="md" />
          </button>
        </div>
        {/* One line under the field: what was recognised, or what went wrong. Never jumps. */}
        <p id={`${inputId}-hint`} className={cn("flex min-h-6 items-center gap-2 px-4 text-small", error ? "text-danger-strong" : "text-link")}>
          {error ? (
            t("invalid")
          ) : detectedType ? (
            <span key={detectedType} className="inline-flex items-center gap-2 font-semibold motion-safe:animate-fade-in">
              <Icon icon={CircleCheck} size="sm" />
              {t("detected", { type: detectedType })}
            </span>
          ) : null}
        </p>
      </form>

      <div className="grid gap-2">
        <p className="text-caption font-semibold text-fg-secondary">{t("examples")}</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => {
                add(example.url);
                inputRef.current?.focus();
              }}
              className="inline-flex h-control-sm items-center gap-2 rounded-full border border-line bg-surface ps-2 pe-3 text-small font-medium text-fg transition-[border-color,background-color,scale] duration-micro hover:border-line-strong hover:bg-hover focus-visible:focus-ring active:scale-pressed"
            >
              {example.icon ? <PlatformIcon icon={example.icon} size="sm" /> : <Icon icon={ShoppingBag} size="sm" />}
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-caption font-semibold text-fg-secondary">{t("list")}</p>
        {items.length === 0 ? (
          <div className="grid gap-2">
            <p className="grid min-h-control-xl place-items-center rounded-lg border border-dashed border-line-strong px-4 text-center text-small text-fg-secondary">{t("empty")}</p>
            <div aria-hidden className="h-control-xl rounded-lg border border-dashed border-line" />
          </div>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={item.key} className="flex min-h-control-xl items-center gap-3 rounded-lg bg-canvas-muted p-2 motion-safe:animate-pop-in">
                <span className="grid size-control-md shrink-0 place-items-center rounded-md bg-primary text-primary-fg">
                  <BlockIcon type={item.type} platform={item.platform} />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-small font-semibold">{t(`types.${item.type}`)}</span>
                  <span dir="ltr" className="truncate text-start text-caption text-fg-secondary">
                    {item.host}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setItems((current) => current.filter((candidate) => candidate.key !== item.key));
                  }}
                  aria-label={t("remove", { title: `${t(`types.${item.type}`)} ${item.host}` })}
                  className="grid size-control-md shrink-0 place-items-center rounded-full text-fg-tertiary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring"
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
