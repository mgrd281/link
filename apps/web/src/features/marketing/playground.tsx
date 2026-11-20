"use client";

import type { Platform } from "@linkyo/blocks";
import { detectLink, type Detection } from "@linkyo/blocks/detect";
import type { CreatorButtonStyle } from "@linkyo/tokens";
import type { CreatorThemeConfig, HeroStyle } from "@linkyo/tokens/creator";
import { cn, Icon, PlatformIcon } from "@linkyo/ui";
import {
  ArrowRight,
  Camera,
  Check,
  CircleCheck,
  Clapperboard,
  FolderGit2,
  Image as ImageIcon,
  Link2,
  MousePointer2,
  Music2,
  Palette,
  Play,
  Plus,
  Radio,
  RotateCcw,
  ShoppingBag,
  Smartphone,
  Ticket,
  UserRound,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image, { type StaticImageData } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { saveTryDraft } from "@/features/account/try-draft";
import { suggestUsername } from "@/features/account/username";
import { ImageError, pickFiles, prepareImage } from "@/features/app/images";
import { socialProfile } from "@/features/app/import-links";
import type { SocialPlatform } from "@/features/app/kinds";
import { mediaSizes, PlatformGlyph, platformName } from "@/features/directions/shared/platforms";
import { STORE_NAMES } from "@/features/directions/shared/stores";
import { Link } from "@/i18n/navigation";

import type { TryItem, TryPageInput } from "./try-page";
import type { Reveal } from "./try-phone";
import { EXAMPLES, PERSONA, SAMPLE_FACTS, sampleOf } from "./try-samples";

/** The phone with the real page: its own chunk (renderer, pictures, theme engine), loaded when needed. */
const TryPhone = dynamic(() => import("./try-phone").then((module) => module.TryPhone), { ssr: false, loading: () => <PhoneFrame /> });

/** The phone's frame while its page loads: the same size, so nothing moves when it arrives. */
function PhoneFrame({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative rounded-xl border border-line-strong bg-ink p-2", className)}>
      <div className="aspect-phone rounded-lg bg-night-200" />
    </div>
  );
}

/** One look to try: a complete look from the template gallery, named after its template. */
export interface LookOption {
  id: string;
  config: CreatorThemeConfig;
  name: string;
  description: string;
  /** The look's colors and type for its card, resolved on the server (the engine loads with the phone). */
  vars: Record<string, string>;
  /** How its buttons look (filled, outlined …), for the card's two little buttons. */
  button: CreatorButtonStyle;
  /** Where the photo sits (a cinema still, a halo, an arch …), so each card shows the template's shape. */
  hero: HeroStyle;
}

type Tab = "name" | "links" | "look";
const TABS: { id: Tab; icon: LucideIcon }[] = [
  { id: "name", icon: UserRound },
  { id: "links", icon: Link2 },
  { id: "look", icon: Palette },
];

const TYPE_ICONS: Record<string, LucideIcon> = { music: Music2, video: Video, shorts: Clapperboard, events: Ticket, product: ShoppingBag, live: Radio, image: ImageIcon, app: Smartphone, repo: FolderGit2 };
const KNOWN = new Set(["music", "video", "shorts", "events", "product", "live", "image", "card", "link", "app", "repo"]);
/** Profiles that become an icon under the name, as in the welcome flow (songs, videos and channels stay blocks). */
const ICON_PROFILES: readonly SocialPlatform[] = ["instagram", "tiktok", "x", "threads", "linkedin", "facebook", "github", "whatsapp", "discord"];
const MAX_LINKS = 6;
/** A look starts the playground; the persona's own look ends the demo. */
const FIRST_LOOK = "mono";

/**
 * A link as the controls keep it. A social profile (social) becomes an icon under the name; an
 * example (sample) shows the persona's pictures and is never looked up or carried over; meta is the
 * real title and picture of a pasted song or video, once the server found them.
 */
interface Added extends TryItem {
  type: string;
  platform: Platform | undefined;
}

interface Photo {
  src: string;
  tone: "light" | "dark";
  /** The visitor's own photo (the persona's is not carried into an account). */
  own: boolean;
}

const typeKey = (detection: Detection): string => (KNOWN.has(detection.type) ? detection.type : "link");

function toAdded(found: Detection, key: string): Added {
  return {
    key,
    url: found.url,
    type: typeKey(found),
    platform: found.platform as Platform | undefined,
    social: socialProfile(found.url, ICON_PROFILES)?.platform,
    sample: sampleOf(found.url),
  };
}

function BlockIcon({ item }: { item: Added }) {
  const platform = item.social ?? item.platform;
  // A shop link shows a bag, whichever shop system it runs on; an app a phone, whichever store it is in.
  if ((item.type === "product" || item.type === "app") && !item.social) return <Icon icon={TYPE_ICONS[item.type] ?? Link2} size="sm" />;
  return platform && platform !== "website" ? <PlatformGlyph platform={platform} size="sm" /> : <Icon icon={TYPE_ICONS[item.type] ?? Link2} size="sm" />;
}

/** A link's thumbnail in the list: an example's own picture, else the platform's or the block's icon. */
function ItemThumb({ item }: { item: Added }) {
  const picture = item.sample === "necklace" || item.sample === "perfume" || item.sample === "youtube" ? SAMPLE_FACTS[item.sample].picture : null;
  return (
    <span aria-hidden className="relative grid size-control-md shrink-0 place-items-center overflow-hidden rounded-sm bg-canvas-muted text-fg">
      {picture ? <Image src={picture} alt="" fill sizes={mediaSizes.thumb} className="object-cover" /> : <BlockIcon item={item} />}
    </span>
  );
}

/** The little buttons on a look's card, in the look's own button style. */
const MINI_BUTTON: Record<CreatorButtonStyle, string> = {
  filled: "bg-creator-accent",
  soft: "bg-creator-surface-2",
  outline: "border border-creator-accent",
  glass: "border border-creator-line bg-creator-glass",
  shadow: "border border-creator-line bg-creator-surface",
  minimal: "border-b border-creator-line-strong",
};

/** The look's display type: its weight, spacing and capitals come with the look. */
const DISPLAY_TYPE = {
  fontWeight: "var(--creator-display-weight)",
  letterSpacing: "var(--creator-display-tracking)",
  textTransform: "var(--creator-display-transform)",
} as CSSProperties;

/**
 * A look in miniature, in its own colors and type: the photo in the template's shape (fading into the
 * page, a cinema still with the name over it, a halo or an arch), the first name, two buttons.
 * Decoration only: the radio around it says which look it is.
 */
function LookPreview({
  vars,
  button,
  hero,
  photo,
  name,
}: {
  vars: Record<string, string>;
  button: CreatorButtonStyle;
  hero: HeroStyle;
  photo: string | StaticImageData | null;
  name: string;
}) {
  const picture = photo ? <Image src={photo} alt="" fill sizes={mediaSizes.third} className={cn("object-cover object-top", hero === "mono" && "grayscale")} /> : null;
  const cinema = hero === "cinema";
  return (
    <span aria-hidden style={vars} className="relative flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-creator-bg text-creator-fg max-lg:aspect-portrait">
      {cinema ? (
        // The whole card is the still; the name sits low, at the reading start.
        <span className="absolute inset-0 bg-creator-surface-2">
          {picture}
          <span className="absolute inset-0 bg-linear-to-t from-creator-bg from-10% to-transparent to-70%" />
        </span>
      ) : hero === "halo" || hero === "arch" ? (
        <span className="relative grid h-1/2 shrink-0 place-items-center pt-2">
          <span className={cn("relative h-full", hero === "halo" ? "aspect-square" : "aspect-portrait")}>
            {hero === "halo" ? <span className="poster-halo absolute -inset-0.5" /> : null}
            <span className={cn("absolute inset-0 overflow-hidden bg-creator-surface-2", hero === "halo" ? "rounded-full border-emphasis border-creator-bg" : "rounded-t-full")}>{picture}</span>
          </span>
        </span>
      ) : (
        <span className="relative h-1/2 shrink-0 bg-creator-surface-2">
          {picture}
          <span className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-creator-bg to-transparent" />
        </span>
      )}
      <span
        className={cn("relative truncate px-2 font-creator-display text-body leading-tight", cinema ? "mt-auto text-start" : "text-center", hero === "halo" || hero === "arch" ? "mt-1" : !cinema && "-mt-3")}
        style={DISPLAY_TYPE}
      >
        {name}
      </span>
      <span className={cn("relative grid gap-1 p-2", !cinema && "mt-auto")}>
        <span className={cn("h-2 rounded-creator-button", MINI_BUTTON[button])} />
        <span className={cn("h-2 rounded-creator-button", MINI_BUTTON[button])} />
      </span>
    </span>
  );
}

/** The mark on the chosen look's card. */
function Chosen() {
  return (
    <span aria-hidden className="absolute end-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-fg motion-safe:animate-pop-in">
      <Icon icon={Check} size="sm" />
    </span>
  );
}

/**
 * Try Linkyo before signing up: a real page, built while you watch. The phone shows the page exactly
 * as visitors will see it (the real renderer, templates and blocks, see TryPhone); the controls
 * beside it (below it on phones) are the editor in miniature: photo, name and a line about you, links,
 * a look.
 *
 * Pasted links go through the real detector and become the real blocks; profiles (Instagram, TikTok …)
 * become icons under the name; songs and videos get their real title and cover from our server, as
 * in the app. A photo is resized in the browser and stays there until the visitor signs up.
 *
 * The first time it scrolls into view it introduces Lou Ferreira, the designer from the template gallery: the
 * portrait, the name and the line typed, Instagram and two pieces from the shop pasted, and the
 * black-and-gold look picked. It runs once and stops for good at the visitor's first touch; what it typed is selected
 * on focus, so typing replaces it. "Keep this page" goes to sign-up with what the visitor made
 * themselves (name, line, photo, links; try-draft.ts) and the look on screen. The persona stays here.
 */
export function Playground({ looks, rtl }: { looks: [LookOption, ...LookOption[]]; rtl: boolean }) {
  const t = useTranslations("marketing.try");
  const tPaste = useTranslations("marketing.paste");
  const tLook = useTranslations("marketing.features.look");
  const tTypes = useTranslations("dashboard.types");
  const tForm = useTranslations("app.form");
  const locale = useLocale();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const interacted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  // What the demo's cursor goes to.
  const photoTarget = useRef<HTMLButtonElement>(null);
  const nameTarget = useRef<HTMLInputElement>(null);
  const taglineTarget = useRef<HTMLInputElement>(null);
  const linkTarget = useRef<HTMLInputElement>(null);
  const addTarget = useRef<HTMLButtonElement>(null);
  const ctaTarget = useRef<HTMLAnchorElement>(null);
  const frame = useRef(0);
  const personaTagline = t("persona.tagline");
  const [tab, setTab] = useState<Tab>("name");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  // What is the visitor's own (and not the persona's): only that goes to sign-up.
  const [own, setOwn] = useState({ name: false, tagline: false });
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<Added[]>([]);
  const [error, setError] = useState<"invalid" | "limit" | null>(null);
  // The look's template, and the visitor's own color on it (null: the look's own accent).
  const [lookIndex, setLookIndex] = useState(() => Math.max(0, looks.findIndex((option) => option.id === FIRST_LOOK)));
  const [accent, setAccent] = useState<string | null>(null);
  const [customVars, setCustomVars] = useState<Record<string, string> | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [reveal, setReveal] = useState<Reveal>({ to: "top", at: 0 });
  // The demo: which step it is on, the cursor, the control it pretends to focus, the phone's message.
  const [demo, setDemo] = useState<"idle" | "running" | "done">("idle");
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false, tap: 0 });
  const [demoFocus, setDemoFocus] = useState<"name" | "tagline" | "link" | "cta" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const show = (to: Reveal["to"]) => {
    setReveal((current) => ({ to, at: current.at + 1 }));
  };

  const base = looks[lookIndex] ?? looks[0];
  const config = useMemo<CreatorThemeConfig>(() => (accent ? { ...base.config, accent } : base.config), [accent, base]);
  const look = accent ? { ...base, name: tLook("custom"), description: tLook("customHint") } : base;

  const detection = draft.trim() ? detectLink(draft.trim()) : null;
  const address = suggestUsername(name);
  const typeLabel = (type: string) => tPaste(`types.${type}`);
  const itemLabel = (item: Added) => (item.social ? platformName(item.social) : typeLabel(item.type));
  const displayName = name.trim() || t("preview.name");
  const labels = useMemo(() => ({ video: tTypes("video"), music: tTypes("music"), event: tTypes("events") }), [tTypes]);

  // What the phone builds the page from (see try-page.ts).
  const phoneInput = useMemo<TryPageInput>(
    () => ({ id, displayName, address, tagline, photo, items, locale, labels, texts: { video: t("samples.video"), necklace: t("samples.necklace"), perfume: t("samples.perfume") } }),
    [id, displayName, address, tagline, photo, items, locale, labels, t],
  );
  /** What a row in "On your page" says: the block's title, then its price, handle, length or source. */
  const describe = (item: Added): { title: string; detail: string } => {
    const host = item.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ?? item.url;
    if (item.social) {
      const handle = socialProfile(item.url, ICON_PROFILES)?.handle;
      return { title: platformName(item.social), detail: handle ? `@${handle}` : host };
    }
    if (item.sample === "necklace" || item.sample === "perfume") {
      const fact = SAMPLE_FACTS[item.sample];
      const price = new Intl.NumberFormat(locale, { style: "currency", currency: fact.currency, minimumFractionDigits: 0 }).format(fact.price);
      return { title: item.sample === "necklace" ? t("samples.necklace") : t("samples.perfume"), detail: price };
    }
    if (item.sample === "youtube") {
      const { duration } = SAMPLE_FACTS.youtube;
      return { title: t("samples.video"), detail: `YouTube · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` };
    }
    // An app: its maker (or the store); a skill or repository: where it lives on GitHub.
    if (item.type === "app") return { title: item.meta?.title ?? itemLabel(item), detail: item.meta?.author ?? STORE_NAMES[detectLink(item.url)?.platform === "googleplay" ? "googleplay" : "appstore"] };
    if (item.type === "repo") return { title: item.meta?.title ?? itemLabel(item), detail: detectLink(item.url)?.id ?? host };
    // YouTube's artist channels are called "Artist - Topic".
    return { title: item.meta?.title ?? itemLabel(item), detail: item.meta?.author?.replace(/ - Topic$/, "") ?? host };
  };
  // The look cards show the visitor's photo and first name (or the persona's), in each look.
  const previewPhoto = photo ? (photo.own ? photo.src : PERSONA.picture) : null;
  const previewName = name.trim() ? (name.trim().split(/\s+/)[0] ?? "Aa") : "Aa";
  // The phone loads a screen before the playground is in view.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      // One screen ahead.
      { rootMargin: "100% 0%" },
    );
    observer.observe(element);
    // Once the page is idle, its code is fetched ahead, so a fast scroll never waits for it.
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(() => void import("./try-phone"), { timeout: 5000 }) : 0;
    return () => {
      observer.disconnect();
      if (idle) window.cancelIdleCallback(idle);
    };
  }, []);

  /** Songs and videos the visitor pasted get their real title and cover, as in the app. */
  const enrich = (item: Added) => {
    if (item.sample || item.social) return;
    void import("./try-page").then(({ findMetadata }) =>
      findMetadata(item.url, labels).then((meta) => {
        if (meta) setItems((current) => current.map((candidate) => (candidate.key === item.key ? { ...candidate, meta } : candidate)));
      }),
    );
  };

  const add = (text: string) => {
    const found = text.trim() ? detectLink(text.trim()) : null;
    if (!found) {
      setError("invalid");
      return;
    }
    if (items.length >= MAX_LINKS) {
      setError("limit");
      return;
    }
    const item = toAdded(found, `${id}-${Date.now().toString(36)}-${items.length}`);
    setItems((current) => [...current, item].slice(0, MAX_LINKS));
    enrich(item);
    setAnnouncement(tPaste("added", { type: itemLabel(item) }));
    setDraft("");
    setError(null);
    // A profile shows under the name; anything else is the newest block, at the end.
    show(item.social ? "top" : "end");
  };

  const pickPhoto = async () => {
    const [file] = await pickFiles({ accept: "image/*" });
    if (!file) return;
    try {
      const prepared = await prepareImage(file, "avatar");
      setPhoto({ src: prepared.src, tone: prepared.tone, own: true });
      setPhotoError(null);
      show("top");
    } catch (problem) {
      setPhotoError(tForm(`imageErrors.${problem instanceof ImageError ? problem.reason : "decode"}`));
    }
  };

  // The guided demo: a cursor builds the persona's page, step by step, in the real controls.
  const personaLook = Math.max(
    0,
    looks.findIndex((option) => option.id === PERSONA.look),
  );
  const firstLook = Math.max(
    0,
    looks.findIndex((option) => option.id === FIRST_LOOK),
  );
  const personaUrls = PERSONA.links.map((sample) => EXAMPLES.find((example) => example.id === sample)?.url ?? "");
  const personaItem = (url: string, index: number) => {
    const found = detectLink(url);
    return found ? [toAdded(found, `persona-${index}`)] : [];
  };

  /** Everything back to an empty page. */
  const reset = () => {
    setPhoto(null);
    setName("");
    setTagline("");
    setOwn({ name: false, tagline: false });
    setItems([]);
    setDraft("");
    setError(null);
    setLookIndex(firstLook);
    setAccent(null);
    setTab("name");
    setToast(null);
    show("top");
  };

  /** The persona's finished page at once (reduced motion). */
  const finish = () => {
    setPhoto({ ...PERSONA.photo, own: false });
    setName(PERSONA.name);
    setTagline(personaTagline);
    setItems(personaUrls.flatMap(personaItem));
    setLookIndex(personaLook);
    setAccent(null);
    setTab("look");
    setDemo("done");
  };

  const pointAt = (element: Element | null | undefined) => {
    const box = root.current?.getBoundingClientRect();
    const target = element?.getBoundingClientRect();
    if (!box || !target) return;
    setCursor((current) => ({ ...current, visible: true, x: target.left - box.left + target.width / 2, y: target.top - box.top + target.height / 2 }));
  };
  const tap = () => {
    setCursor((current) => ({ ...current, tap: current.tap + 1 }));
  };

  const play = () => {
    controller.current?.abort();
    const run = new AbortController();
    controller.current = run;
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, ms);
        run.signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(new Error("stopped"));
          },
          { once: true },
        );
      });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    reset();
    setDemo("running");
    void (async () => {
      try {
        await wait(700);
        pointAt(photoTarget.current);
        await wait(700);
        tap();
        setPhoto({ ...PERSONA.photo, own: false });
        await wait(800);

        pointAt(nameTarget.current);
        await wait(650);
        tap();
        setDemoFocus("name");
        for (const [index] of Array.from(PERSONA.name).entries()) {
          setName(PERSONA.name.slice(0, index + 1));
          await wait(60);
        }
        await wait(250);
        pointAt(taglineTarget.current);
        await wait(600);
        tap();
        setDemoFocus("tagline");
        for (const [index] of Array.from(personaTagline).entries()) {
          setTagline(personaTagline.slice(0, index + 1));
          await wait(28);
        }
        await wait(400);
        setDemoFocus(null);

        pointAt(tabs.current[1]);
        await wait(650);
        tap();
        setTab("links");
        await wait(450);
        for (const [index, url] of personaUrls.entries()) {
          pointAt(linkTarget.current);
          await wait(index === 0 ? 600 : 450);
          tap();
          setDemoFocus("link");
          setDraft(url);
          await wait(850);
          pointAt(addTarget.current);
          await wait(450);
          tap();
          const added = personaItem(url, index);
          setItems((current) => [...current, ...added]);
          setDraft("");
          setDemoFocus(null);
          show(added[0]?.social ? "top" : "end");
          await wait(750);
        }

        pointAt(tabs.current[2]);
        await wait(650);
        tap();
        setTab("look");
        await wait(450);
        pointAt(radios.current[personaLook]);
        await wait(550);
        tap();
        setLookIndex(personaLook);
        show("top");
        await wait(900);

        setToast(t("demo.live"));
        pointAt(ctaTarget.current);
        await wait(700);
        setDemoFocus("cta");
        await wait(1800);
        setDemoFocus(null);
        setCursor((current) => ({ ...current, visible: false }));
        setDemo("done");
        await wait(1500);
        setToast(null);
      } catch {
        // Stopped by the visitor: what is there stays, and it is their turn.
        setCursor((current) => ({ ...current, visible: false }));
        setDemoFocus(null);
        setToast(null);
        setDemo((current) => (current === "running" ? "done" : current));
      }
    })();
  };

  // The demo plays once, when most of the playground is on screen, unless someone got there first.
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        // A moment to arrive (and for anyone who came here to type to start typing), then it plays.
        timer = window.setTimeout(() => {
          if (!interacted.current) playRef.current();
        }, 600);
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      controller.current?.abort();
    };
  }, []);

  /** The visitor took over: the demo stops where it is. */
  const takeOver = () => {
    interacted.current = true;
    controller.current?.abort();
  };

  const showTab = (index: number, focus = false) => {
    const next = TABS[(index + TABS.length) % TABS.length];
    if (!next) return;
    setTab(next.id);
    if (focus) tabs.current[TABS.indexOf(next)]?.focus();
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const reversed = getComputedStyle(event.currentTarget).direction === "rtl";
    const current = TABS.findIndex((entry) => entry.id === tab);
    const step = { ArrowRight: reversed ? -1 : 1, ArrowLeft: reversed ? 1 : -1 }[event.key];
    if (step !== undefined) showTab(current + step, true);
    else if (event.key === "Home") showTab(0, true);
    else if (event.key === "End") showTab(TABS.length - 1, true);
    else return;
    event.preventDefault();
  };

  const chooseLook = (index: number, focus = false) => {
    const next = (index + looks.length) % looks.length;
    setLookIndex(next);
    setAccent(null);
    if (focus) radios.current[next]?.focus();
  };
  const onLookKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const reversed = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = { ArrowRight: reversed ? -1 : 1, ArrowDown: 1, ArrowLeft: reversed ? 1 : -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    chooseLook(lookIndex + step, true);
  };
  // Any color, in the look that is showing: one result per frame while the picker is dragged.
  const pickColor = (value: string) => {
    cancelAnimationFrame(frame.current);
    const look = base.config;
    frame.current = requestAnimationFrame(() => {
      setAccent(value);
      // The swatch shows the whole look in that color; the engine loads on first use.
      void import("@linkyo/tokens/creator").then(({ resolveCreatorTheme }) => {
        setCustomVars(resolveCreatorTheme({ ...look, accent: value }, { rtlScript: rtl }).cssVars);
      });
    });
  };

  const ownName = own.name ? name.trim() : "";
  const params = new URLSearchParams();
  if (ownName && address) params.set("name", address);
  if (ownName) params.set("display", ownName);
  params.set("template", config.template ?? "nocturne");
  if (config.accent) params.set("accent", config.accent.replace("#", "").toLowerCase());
  const signup = `/signup?${params.toString()}`;
  const keep = () => {
    saveTryDraft({
      name: ownName,
      links: items.filter((item) => !item.sample).map((item) => item.url),
      ...(own.tagline && tagline.trim() ? { tagline: tagline.trim() } : {}),
      ...(photo?.own ? { photo: { src: photo.src, tone: photo.tone } } : {}),
      theme: config,
    });
  };

  const tabId = (entry: Tab) => `${id}-tab-${entry}`;
  const panelId = (entry: Tab) => `${id}-panel-${entry}`;
  const panel = (entry: Tab) => ({
    id: panelId(entry),
    role: "tabpanel" as const,
    "aria-labelledby": tabId(entry),
    inert: tab !== entry,
    // All panels share one cell and fill it, so switching tabs never changes the card's height.
    className: cn("col-start-1 row-start-1 flex min-h-0 flex-col gap-3 transition-opacity duration-standard ease-standard motion-reduce:transition-none", tab === entry ? "opacity-100" : "invisible opacity-0"),
  });
  const field =
    "h-control-lg w-full min-w-0 rounded-full border border-transparent bg-canvas-muted px-4 text-body text-fg outline-none transition-colors duration-micro placeholder:text-fg-tertiary focus-visible:border-link focus-visible:focus-ring";
  const lookCard = (selected: boolean) =>
    cn(
      "grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1 rounded-lg border-emphasis p-1 text-start transition-[border-color,scale] duration-standard ease-standard active:scale-pressed motion-reduce:transition-none",
      selected ? "border-link" : "border-transparent hover:border-line-strong",
    );
  const remove = (key: string) => {
    setItems((current) => current.filter((candidate) => candidate.key !== key));
    setError(null);
  };

  return (
    <div
      ref={root}
      onPointerDownCapture={takeOver}
      onFocusCapture={takeOver}
      onKeyDownCapture={takeOver}
      className="relative mx-auto grid w-full max-w-prose grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface lg:mk-play lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1"
    >
      {/* The stage, in deep Linkyo teal: the phone with the page, above the controls on phones (its
          lower part out of view; it scrolls to each change) and beside them, whole, on wide screens,
          where the card is as tall as the screen allows. */}
      <div className="relative isolate grid justify-items-center overflow-hidden border-b border-line bg-teal-900 max-lg:aspect-portrait max-lg:pt-8 lg:order-last lg:items-center lg:border-s lg:border-b-0 lg:py-10">
        <div aria-hidden className="mk-deck-halo w-[140%] border border-teal-800" />
        <div aria-hidden className="mk-deck-halo w-[95%] bg-teal-800" />
        {/* Watch the demo (again): a quiet round button in the stage's corner, not while it plays. */}
        {demo === "running" ? null : (
          <button
            type="button"
            onClick={play}
            aria-label={demo === "done" ? t("demo.replay") : t("demo.play")}
            title={demo === "done" ? t("demo.replay") : t("demo.play")}
            className="absolute end-2 top-2 layer-raised grid size-control-md place-items-center rounded-full border border-teal-700 bg-teal-800 text-teal-50 transition-[background-color,scale] duration-micro hover:bg-teal-700 focus-visible:focus-ring active:scale-pressed motion-safe:animate-fade-in lg:end-3 lg:top-3 lg:size-touch-target"
          >
            <Icon icon={demo === "done" ? RotateCcw : Play} size="sm" className="rtl:-scale-x-100" />
          </button>
        )}
        {near ? (
          <TryPhone input={phoneInput} config={config} rtl={rtl} label={t("preview.label")} reveal={reveal} toast={toast} className="w-sidebar max-lg:self-start lg:mk-play-phone" />
        ) : (
          <PhoneFrame className="w-sidebar max-lg:self-start lg:mk-play-phone" />
        )}
      </div>

      {/* The editor: three tabs, each a full panel (nothing jumps between them), and "Keep this page". */}
      <div className="flex min-h-0 flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <div role="tablist" aria-label={t("tabs.label")} className="grid shrink-0 grid-cols-3 gap-1 rounded-full bg-canvas-muted p-1">
          {TABS.map((entry, index) => {
            const selected = tab === entry.id;
            return (
              <button
                key={entry.id}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                id={tabId(entry.id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(entry.id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setTab(entry.id);
                }}
                onKeyDown={onTabKey}
                className={cn(
                  "inline-flex h-control-md min-w-0 items-center justify-center gap-2 rounded-full border text-small font-semibold transition-colors duration-micro focus-visible:focus-ring",
                  selected ? "border-line bg-surface-elevated text-fg" : "border-transparent text-fg-secondary hover:text-fg",
                )}
              >
                <Icon icon={entry.icon} size="sm" />
                <span className="truncate">{t(`tabs.${entry.id}`)}</span>
                {entry.id === "links" && items.length > 0 ? (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-caption text-primary-fg tabular-nums">{items.length}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* One column no wider than the card (the examples' row scrolls inside it on phones). */}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1">
          {/* Profile: the photo large on a quiet stage, then the name, the line and the address. */}
          <div {...panel("name")}>
            <div className="grid min-h-0 flex-1 place-content-center justify-items-center gap-3 rounded-lg bg-canvas-muted p-4">
              <div className="relative">
                <button
                  ref={photoTarget}
                  type="button"
                  onClick={() => void pickPhoto()}
                  aria-label={photo?.own ? t("photo.change") : t("photo.add")}
                  className={cn(
                    "relative grid size-avatar-xl place-items-center overflow-hidden rounded-full transition-[border-color,background-color,scale] duration-micro focus-visible:focus-ring active:scale-pressed lg:size-avatar-2xl",
                    photo ? "border border-line" : "border border-dashed border-line-strong bg-surface text-fg-secondary hover:border-link hover:text-link",
                  )}
                >
                  {photo ? (
                    <Image key={photo.src} src={photo.own ? photo.src : PERSONA.picture} alt="" fill sizes={mediaSizes.avatar} className="object-cover motion-safe:animate-pop-in" />
                  ) : (
                    <Icon icon={Camera} size="lg" />
                  )}
                </button>
                {photo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      show("top");
                    }}
                    aria-label={t("photo.remove")}
                    className="absolute -end-1 -top-1 grid size-8 place-items-center rounded-full border border-line bg-surface-elevated text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
                  >
                    <Icon icon={X} size="sm" />
                  </button>
                ) : null}
              </div>
              <p aria-live="polite" className={cn("text-center text-caption text-pretty", photoError ? "text-danger-strong" : "text-fg-secondary")}>
                {photoError ?? t("photo.hint")}
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-1 gap-1">
              <label htmlFor={`${id}-name`} className="px-1 text-small font-semibold">
                {t("name.label")}
              </label>
              <input
                ref={nameTarget}
                id={`${id}-name`}
                value={name}
                onChange={(event) => {
                  setName(event.target.value.slice(0, 60));
                  setOwn((current) => ({ ...current, name: true }));
                  show("top");
                }}
                onFocus={(event) => {
                  if (event.currentTarget.value === PERSONA.name) event.currentTarget.select();
                }}
                maxLength={60}
                autoComplete="name"
                placeholder={t("name.placeholder")}
                aria-describedby={`${id}-name-hint`}
                className={cn(field, demoFocus === "name" && "border-link focus-ring")}
              />
            </div>
            <div className="grid shrink-0 grid-cols-1 gap-1">
              <label htmlFor={`${id}-tagline`} className="px-1 text-small font-semibold">
                {t("tagline.label")}
              </label>
              <input
                ref={taglineTarget}
                id={`${id}-tagline`}
                value={tagline}
                onChange={(event) => {
                  setTagline(event.target.value.slice(0, 80));
                  setOwn((current) => ({ ...current, tagline: true }));
                  show("top");
                }}
                onFocus={(event) => {
                  if (event.currentTarget.value === personaTagline) event.currentTarget.select();
                }}
                maxLength={80}
                placeholder={t("tagline.placeholder")}
                className={cn(field, demoFocus === "tagline" && "border-link focus-ring")}
              />
            </div>
            <p id={`${id}-name-hint`} className="flex min-w-0 shrink-0 items-center gap-2 px-1 text-small text-fg-secondary">
              <Icon icon={Link2} size="sm" className="shrink-0" />
              <span className="truncate">{t("name.address", { address: `linkyo.app/${address || "…"}` })}</span>
            </p>
          </div>

          {/* Links: paste or pick an example; below, what is on the page, each with its picture and detail. */}
          <div {...panel("links")}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                add(draft);
              }}
              className="grid shrink-0 grid-cols-1 gap-1"
            >
              <label htmlFor={`${id}-link`} className="sr-only">
                {tPaste("label")}
              </label>
              <div
                className={cn(
                  "flex h-control-lg items-center gap-2 rounded-full border border-transparent bg-canvas-muted ps-4 pe-1 transition-colors duration-micro has-[input:focus-visible]:border-link has-[input:focus-visible]:focus-ring",
                  demoFocus === "link" && "border-link focus-ring",
                )}
              >
                <Icon icon={Link2} size="md" className="shrink-0 text-fg-tertiary" />
                <input
                  ref={linkTarget}
                  id={`${id}-link`}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                  }}
                  onFocus={(event) => {
                    const input = event.currentTarget;
                    if (EXAMPLES.some((example) => example.url === input.value)) input.select();
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
                  placeholder={tPaste("placeholder")}
                  aria-invalid={error === "invalid" || undefined}
                  aria-describedby={`${id}-link-hint`}
                  className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
                />
                <button
                  ref={addTarget}
                  type="submit"
                  aria-label={tPaste("add")}
                  className="grid size-control-md shrink-0 place-items-center rounded-full bg-primary text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
                >
                  <Icon icon={Plus} size="md" />
                </button>
              </div>
              <p id={`${id}-link-hint`} className={cn("flex min-h-6 items-center gap-2 px-4 text-small", error ? "text-danger-strong" : "text-link")}>
                {error === "invalid" ? (
                  tPaste("invalid")
                ) : error === "limit" ? (
                  t("limit")
                ) : detection ? (
                  <span key={detection.type} className="inline-flex items-center gap-2 font-semibold motion-safe:animate-fade-in">
                    <Icon icon={CircleCheck} size="sm" />
                    {tPaste("detected", { type: typeLabel(typeKey(detection)) })}
                  </span>
                ) : null}
              </p>
            </form>
            {/* One row on phones (it scrolls sideways), so the demo's links never make the card taller. */}
            <div role="group" aria-label={tPaste("examples")} className="mk-no-scrollbar -mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 lg:flex-wrap">
              {EXAMPLES.filter((example) => example.chip).map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => {
                    add(example.url);
                  }}
                  className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full border border-line bg-surface ps-2 pe-3 text-small font-medium text-fg transition-[border-color,background-color,scale] duration-micro hover:border-line-strong hover:bg-hover focus-visible:focus-ring active:scale-pressed"
                >
                  {example.icon ? <PlatformIcon icon={example.icon} size="sm" /> : <Icon icon={ShoppingBag} size="sm" />}
                  {example.label}
                </button>
              ))}
            </div>
            <section aria-labelledby={`${id}-added`} className="flex min-h-0 flex-1 flex-col rounded-lg border border-line">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2">
                <h3 id={`${id}-added`} className="text-caption font-semibold tracking-wide text-fg-secondary uppercase">
                  {t("added")}
                </h3>
                <span className="text-caption font-semibold text-fg-secondary tabular-nums">{t("count", { count: items.length, max: MAX_LINKS })}</span>
              </div>
              {items.length > 0 ? (
                <ul aria-label={t("added")} className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-2">
                  {items.map((item) => {
                    const about = describe(item);
                    return (
                      <li key={item.key} className="flex min-h-control-lg items-center gap-3 rounded-md ps-1 motion-safe:animate-fade-in">
                        <ItemThumb item={item} />
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate text-small font-semibold text-fg">{about.title}</span>
                          <span className="truncate text-caption text-fg-secondary">
                            <bdi>{about.detail}</bdi>
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            remove(item.key);
                          }}
                          aria-label={tPaste("remove", { title: about.title })}
                          className="grid size-touch-target shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring"
                        >
                          <Icon icon={X} size="sm" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="grid flex-1 place-content-center justify-items-center gap-2 p-6 text-center text-small text-fg-secondary">
                  <span aria-hidden className="grid size-control-lg place-items-center rounded-full bg-canvas-muted">
                    <Icon icon={Link2} size="md" />
                  </span>
                  {t("editor.empty")}
                </p>
              )}
            </section>
          </div>

          {/* Look: every look as a little page in its own colors, type and buttons, and any color. */}
          <div {...panel("look")}>
            {/* Wide screens: the cards fill the panel. Phones: they keep a page's proportions. */}
            <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-2 max-lg:flex-none">
              <div role="radiogroup" aria-label={tLook("choose")} className="col-span-full row-span-full grid grid-cols-3 grid-rows-2 gap-2">
                {looks.map((option, index) => {
                  const selected = !accent && index === lookIndex;
                  return (
                    <button
                      key={option.id}
                      ref={(node) => {
                        radios.current[index] = node;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={option.name}
                      tabIndex={index === lookIndex ? 0 : -1}
                      onClick={() => {
                        chooseLook(index);
                      }}
                      onKeyDown={onLookKey}
                      className={cn(lookCard(selected), "focus-visible:focus-ring")}
                    >
                      <span className="relative grid min-h-0">
                        <LookPreview vars={option.vars} button={option.button} hero={option.hero} photo={previewPhoto} name={previewName} />
                        {selected ? <Chosen /> : null}
                      </span>
                      <span className="truncate px-1 text-small font-semibold text-fg max-sm:text-caption">{option.name}</span>
                    </button>
                  );
                })}
              </div>
              {/* Any color, on the look that is showing (in the free cell after the five looks). */}
              <label className={cn(lookCard(accent !== null), "relative col-start-3 row-start-2 cursor-pointer has-[input:focus-visible]:focus-ring")}>
                <input
                  type="color"
                  aria-label={tLook("custom")}
                  onChange={(event) => {
                    pickColor(event.target.value);
                  }}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <span className="pointer-events-none relative grid min-h-0">
                  {accent && customVars ? (
                    <LookPreview vars={customVars} button={base.button} hero={base.hero} photo={previewPhoto} name={previewName} />
                  ) : (
                    <span className="grid place-items-center rounded-md border border-dashed border-line-strong bg-canvas-muted text-fg-secondary max-lg:aspect-portrait">
                      <Icon icon={Palette} size="lg" />
                    </span>
                  )}
                  {accent ? <Chosen /> : null}
                </span>
                <span className="pointer-events-none truncate px-1 text-small font-semibold text-fg max-sm:text-caption">{tLook("custom")}</span>
              </label>
            </div>
            <p aria-live="polite" className="shrink-0 text-small text-pretty">
              <span className="font-semibold text-fg">{look.name}</span>
              <span className="text-fg-secondary"> · {look.description}</span>
            </p>
          </div>
        </div>

        <div className="grid shrink-0 gap-2 border-t border-line pt-4">
          <Link
            ref={ctaTarget}
            href={signup}
            onClick={keep}
            className={cn(
              "group inline-flex h-control-xl items-center justify-center gap-2 rounded-full bg-primary px-6 text-body font-semibold text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed",
              demoFocus === "cta" && "bg-primary-hover focus-ring",
            )}
          >
            {t("cta")}
            <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
          </Link>
          <p className="text-center text-caption text-fg-secondary">{t("ctaHint")}</p>
        </div>
      </div>
      {/* The demo's cursor: it moves to each control and taps it. Decoration only. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-0 layer-raised transition-[translate,opacity] duration-slow ease-standard motion-reduce:hidden",
          cursor.visible ? "opacity-100" : "opacity-0",
        )}
        style={{ translate: `${cursor.x}px ${cursor.y}px` }}
      >
        {cursor.tap > 0 ? <span key={cursor.tap} className="mk-tap absolute -top-4 -left-4 size-8 rounded-full bg-primary" /> : null}
        <Icon icon={MousePointer2} size="lg" className="relative fill-ink text-white" />
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
