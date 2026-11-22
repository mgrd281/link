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
  MousePointerClick,
  Music2,
  Palette,
  Play,
  Plus,
  Radio,
  RotateCcw,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Square,
  Ticket,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image, { type StaticImageData } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react";

import { saveTryDraft } from "@/features/account/try-draft";
import { suggestUsername } from "@/features/account/username";
import type { RunState } from "@/features/ai/run-reducer";
import { ImageError, pickFiles, prepareImage } from "@/features/app/images";
import { socialProfile } from "@/features/app/import-links";
import type { SocialPlatform } from "@/features/app/kinds";
import { mediaSizes, PlatformGlyph, platformName } from "@/features/directions/shared/platforms";
import { STORE_NAMES } from "@/features/directions/shared/stores";
import { Link } from "@/i18n/navigation";
import { pageAddress } from "@/lib/page-url";

import type { TryItem, TryPageInput } from "./try-page";
import type { Reveal } from "./try-phone";
import { EXAMPLES, PERSONA, SAMPLE_FACTS, sampleOf } from "./try-samples";

/** The phone's size: cut off by the stage's lower edge below lg, whole beside the controls on wide screens. */
const PHONE = "max-lg:mk-play-crop lg:mk-play-phone";

/** The phone with the real page: its own chunk (renderer, pictures, theme engine), loaded when needed. */
const TryPhone = dynamic(() => import("./try-phone").then((module) => module.TryPhone), { ssr: false, loading: () => <PhoneFrame crop className={PHONE} /> });

/** The AI tab (only with a real recording, see TryIt): the run view and its controls, their own chunk, loaded like the phone. */
const TryAiPanel = dynamic(() => import("./try-ai-panel").then((module) => module.TryAiPanel), { ssr: false });
const TryAiPlayStage = dynamic(() => import("./try-ai-panel").then((module) => module.TryAiPlayStage), { ssr: false });

/**
 * The section's eyebrow: "No sign-up needed" with a pointer; once the AI tab is on, "New: pages with
 * AI" with the AI mark (Sparkles means AI and nothing else on the website).
 */
export function TryEyebrow({ ai, children }: { ai: boolean; children: ReactNode }) {
  return (
    <p className="inline-flex items-center justify-self-start md:justify-self-center gap-2 rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-semibold text-fg-secondary">
      <span className="grid size-6 place-items-center rounded-full bg-selected text-selected-fg">
        <Icon icon={ai ? Sparkles : MousePointerClick} size="sm" />
      </span>
      {children}
    </p>
  );
}

/** The phone's frame while its page loads: the same size and cut, so nothing moves when it arrives. */
function PhoneFrame({ crop = false, className }: { crop?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("relative rounded-xl border border-teal-700 bg-ink p-2", crop && "max-lg:h-full max-lg:rounded-b-none max-lg:border-b-0 max-lg:pb-0", className)}>
      <div className={cn("aspect-phone rounded-lg bg-night-200", crop && "max-lg:aspect-auto max-lg:h-full max-lg:rounded-b-none")} />
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

type Tab = "ai" | "name" | "links" | "look";
const TABS: readonly Tab[] = ["name", "links", "look"];
/** With the AI tab (a real recording exists): AI first and selected. */
const AI_TABS: readonly Tab[] = ["ai", "name", "links", "look"];

const TYPE_ICONS: Record<string, LucideIcon> = { music: Music2, video: Video, shorts: Clapperboard, events: Ticket, product: ShoppingBag, live: Radio, image: ImageIcon, app: Smartphone, repo: FolderGit2 };
const KNOWN = new Set(["music", "video", "shorts", "events", "product", "live", "image", "card", "link", "app", "repo"]);
/** Profiles that become an icon under the name, as in the welcome flow (songs, videos and channels stay blocks). */
const ICON_PROFILES: readonly SocialPlatform[] = ["instagram", "tiktok", "x", "threads", "linkedin", "facebook", "github", "whatsapp", "discord"];
const MAX_LINKS = 6;
/** A look starts the playground; the persona's own look ends the demo. */
const FIRST_LOOK = "mono";
/** The block the demo ends on: the first piece from the shop (the persona's items are keyed by their place). */
const SHOP_BLOCK = `persona-${String(PERSONA.links.indexOf("necklace"))}`;

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
    <span aria-hidden className="relative grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-surface text-fg lg:size-control-md lg:rounded-sm lg:bg-canvas-muted">
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
 * black-and-gold look picked, ending on the first piece from the shop. It runs once and stops for good at the
 * visitor's first touch; what it typed is selected on focus, so typing replaces it. Until it plays or
 * the visitor takes over, the phone already shows her finished page, marked "Example page" on the stage,
 * while the controls stay empty. "Keep this page" goes to sign-up with what the visitor made
 * themselves (name, line, photo, links; try-draft.ts) and the look on screen. The persona stays here.
 *
 * Nothing the demo does is announced: only the visitor's own additions and errors are, through the one
 * status line at the end. In the DOM the controls come first and the stage second (it shows on top on
 * phones), so Tab goes tabs → fields → button → the demo's own button.
 *
 * `ai` (a real recording exists, TryIt decides) adds the AI tab, first and selected: the recording
 * plays on the stage and its controls take the panel (try-ai-panel.tsx). Off in phase 1.
 */
export function Playground({ looks, rtl, ai = false }: { looks: [LookOption, ...LookOption[]]; rtl: boolean; ai?: boolean }) {
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
  const strip = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
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
  const tabList = ai ? AI_TABS : TABS;
  const [tab, setTab] = useState<Tab>(ai ? "ai" : "name");
  // The recorded AI run on the stage, for the AI tab's one-line progress.
  const [aiRun, setAiRun] = useState<RunState | null>(null);
  // Until the demo plays or the visitor takes over, the phone shows the persona's finished page.
  const [sample, setSample] = useState(true);
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

  const texts = useMemo(() => ({ video: t("samples.video"), necklace: t("samples.necklace"), perfume: t("samples.perfume") }), [t]);
  // What the phone builds the page from (see try-page.ts).
  const phoneInput = useMemo<TryPageInput>(
    () => ({ id, displayName, address, tagline, photo, items, locale, labels, texts }),
    [id, displayName, address, tagline, photo, items, locale, labels, texts],
  );
  // The persona's finished page (her photo, name, line, Instagram and two pieces from the shop): the
  // first thing the phone shows, before anything is changed.
  const sampleInput = useMemo<TryPageInput>(
    () => ({
      id,
      displayName: PERSONA.name,
      address: suggestUsername(PERSONA.name),
      tagline: personaTagline,
      photo: PERSONA.photo,
      items: PERSONA.links.flatMap((sample, index) => {
        const found = detectLink(EXAMPLES.find((example) => example.id === sample)?.url ?? "");
        return found ? [toAdded(found, `persona-${String(index)}`)] : [];
      }),
      locale,
      labels,
      texts,
    }),
    [id, personaTagline, locale, labels, texts],
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

  // A new link shows at the end of the list: the row of tokens on phones scrolls to it (the page never moves).
  const count = items.length;
  const lastCount = useRef(count);
  useEffect(() => {
    const element = list.current;
    const grew = count > lastCount.current;
    lastCount.current = count;
    if (!element || !grew) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: rtl ? -element.scrollWidth : element.scrollWidth, top: element.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, [count, rtl]);

  /** Songs and videos the visitor pasted get their real title and cover, as in the app. */
  const enrich = (item: Added) => {
    if (item.sample || item.social) return;
    void import("./try-page").then(({ findMetadata }) =>
      findMetadata(item.url, labels).then((meta) => {
        if (meta) setItems((current) => current.map((candidate) => (candidate.key === item.key ? { ...candidate, meta } : candidate)));
      }),
    );
  };

  /**
   * Says something to screen readers through the one status line: only what the visitor did
   * themselves (an addition, an error), never what the demo does.
   */
  const announce = (text: string) => {
    if (interacted.current) setAnnouncement(text);
  };

  /** `example`: an example's chip (always a link); at the limit the field it describes takes the focus and says why. */
  const add = (text: string, example = false) => {
    const found = text.trim() ? detectLink(text.trim()) : null;
    if (!found) {
      setError("invalid");
      announce(tPaste("invalid"));
      return;
    }
    if (items.length >= MAX_LINKS) {
      setError("limit");
      // A chip gives way to the message: focus goes to the field, whose description now says it.
      if (example) requestAnimationFrame(() => linkTarget.current?.focus());
      else announce(t("limit"));
      return;
    }
    const item = toAdded(found, `${id}-${Date.now().toString(36)}-${items.length}`);
    setItems((current) => [...current, item].slice(0, MAX_LINKS));
    enrich(item);
    announce(tPaste("added", { type: itemLabel(item) }));
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
      const message = tForm(`imageErrors.${problem instanceof ImageError ? problem.reason : "decode"}`);
      setPhotoError(message);
      announce(message);
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
    setSample(false);
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
    strip.current?.scrollTo({ left: 0 });
    show("top");
  };

  /** The persona's finished page at once (reduced motion), showing the first piece from the shop. */
  const finish = () => {
    setSample(false);
    setPhoto({ ...PERSONA.photo, own: false });
    setName(PERSONA.name);
    setTagline(personaTagline);
    setItems(personaUrls.flatMap(personaItem));
    setLookIndex(personaLook);
    setAccent(null);
    setTab("look");
    setDemo("done");
    show({ block: SHOP_BLOCK });
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
        // The payoff in view: the first piece from the shop, not the portrait.
        show({ block: SHOP_BLOCK });
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
        // A newer run took over ("Watch again" pressed in the moment after the end): it owns the state.
        if (controller.current !== run) return;
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
    // With the AI tab, the recording plays on the stage instead (it starts by itself in view).
    if (!element || ai) return;
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
      { threshold: 0.75 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      controller.current?.abort();
    };
  }, [ai]);

  /**
   * The visitor took over: the demo stops where it is (its own button stops or replays it itself),
   * and the phone shows their own page from now on, no longer the persona's example.
   */
  const takeOver = (event: SyntheticEvent) => {
    if (event.target instanceof Element && event.target.closest("[data-demo-button]")) return;
    interacted.current = true;
    controller.current?.abort();
    setSample(false);
  };

  const showTab = (index: number, focus = false) => {
    const next = tabList[(index + tabList.length) % tabList.length];
    if (!next) return;
    setTab(next);
    if (focus) tabs.current[tabList.indexOf(next)]?.focus();
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const reversed = getComputedStyle(event.currentTarget).direction === "rtl";
    const current = tabList.indexOf(tab);
    const step = { ArrowRight: reversed ? -1 : 1, ArrowLeft: reversed ? 1 : -1 }[event.key];
    if (step !== undefined) showTab(current + step, true);
    else if (event.key === "Home") showTab(0, true);
    else if (event.key === "End") showTab(tabList.length - 1, true);
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
  /** The AI tab's button: what was built in the other tabs comes along, with the link for the AI. */
  const keepAi = (aiLink: string) => {
    saveTryDraft({
      name: ownName,
      links: items.filter((item) => !item.sample).map((item) => item.url),
      ...(own.tagline && tagline.trim() ? { tagline: tagline.trim() } : {}),
      ...(photo?.own ? { photo: { src: photo.src, tone: photo.tone } } : {}),
      aiLink,
    });
  };
  const aiShown = ai && tab === "ai";

  const tabId = (entry: Tab) => `${id}-tab-${entry}`;
  const panelId = (entry: Tab) => `${id}-panel-${entry}`;
  const panel = (entry: Tab) => ({
    id: panelId(entry),
    role: "tabpanel" as const,
    "aria-labelledby": tabId(entry),
    inert: tab !== entry,
    // All panels share one cell and fill it, so switching tabs never changes the card's height.
    className: cn(
      "col-start-1 row-start-1 flex min-h-0 flex-col gap-2 transition-opacity duration-standard ease-standard motion-reduce:transition-none lg:gap-3",
      tab === entry ? "opacity-100" : "invisible opacity-0",
    ),
  });
  // Fields sit in one soft group, their label inside, as in an app's settings; focus shows as the
  // same calm teal frame as every field on the site (never a ring around a frame).
  const FIELD =
    "h-control-xl w-full min-w-0 border border-transparent bg-transparent px-4 pt-5 text-body text-fg outline-hidden transition-[border-color,background-color] duration-micro ease-standard placeholder:text-fg-tertiary hover:border-line-strong focus-visible:border-focus focus-visible:bg-surface focus-visible:focus-field";
  const FIELD_ON = "border-focus bg-surface focus-field";
  const FIELD_LABEL = "pointer-events-none absolute start-4 top-2 text-caption font-semibold text-fg-secondary transition-colors duration-micro group-focus-within/field:text-link";
  const lookCard = (selected: boolean) =>
    cn(
      "grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1 rounded-lg border-emphasis p-1 text-start transition-[border-color,scale] duration-standard ease-standard active:scale-pressed motion-reduce:transition-none motion-reduce:active:scale-none",
      selected ? "border-link" : "border-transparent hover:border-line-strong",
    );
  const remove = (key: string) => {
    setItems((current) => current.filter((candidate) => candidate.key !== key));
    setError(null);
  };
  // What the link field says: an error, the limit, or what it recognised (a profile by its platform).
  const draftProfile = detection ? socialProfile(draft.trim(), ICON_PROFILES) : undefined;
  const showExamples = !draft.trim() && error === null;
  const demoLabel = demo === "running" ? t("demo.stop") : demo === "done" ? t("demo.replay") : t("demo.play");

  return (
    <div
      ref={root}
      onPointerDownCapture={(event) => {
        // A finger scrolling past the card is not taking over; a tap is (it ends in a click).
        if (event.pointerType !== "touch") takeOver(event);
      }}
      onClickCapture={takeOver}
      onFocusCapture={takeOver}
      onKeyDownCapture={takeOver}
      className="relative mx-auto grid w-full max-w-prose grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface lg:mk-play lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1"
    >
      {/* The editor first in reading and Tab order: a segmented control, one panel of fixed height
          (nothing jumps), and "Keep this page". */}
      <div className="flex min-h-0 flex-col gap-2 px-4 pt-3 pb-3 sm:gap-3 sm:p-6 lg:gap-4 lg:p-8">
        <div
          role="tablist"
          aria-label={t("tabs.label")}
          className={cn(
            "mk-play-tabs grid h-touch-target shrink-0 rounded-full bg-canvas-muted",
            // Four segments with the AI tab: the gliding thumb is a quarter wide (less its inset on both sides).
            ai ? "grid-cols-4 before:w-[calc(25%-var(--spacing-1))]" : "grid-cols-3",
          )}
          style={{ "--i": tabList.indexOf(tab) } as CSSProperties}
        >
          {tabList.map((entry, index) => {
            const selected = tab === entry;
            return (
              <button
                key={entry}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                id={tabId(entry)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(entry)}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setTab(entry);
                }}
                onKeyDown={onTabKey}
                className={cn(
                  "inline-flex h-full min-w-0 items-center justify-center gap-1 rounded-full px-2 text-small font-semibold transition-colors duration-micro focus-visible:focus-ring",
                  selected ? "text-fg forced-colors:border" : "text-fg-secondary hover:text-fg",
                )}
              >
                {entry === "ai" ? (
                  <>
                    <Icon icon={Sparkles} size="sm" className="shrink-0" />
                    {/* Arabic's long word gives way to "AI" on narrow phones; the full name stays in the tab's name. */}
                    <span className={cn("truncate", rtl && "max-sm:hidden")}>{t("ai.tab")}</span>
                    {rtl ? (
                      <>
                        <span className="truncate sm:hidden">{t("ai.tabShort")}</span>
                        <span className="sr-only sm:hidden">{t("ai.tabLabel")}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <span className="truncate">{t(`tabs.${entry}`)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 grid-rows-1 max-lg:mk-play-panel lg:min-h-0 lg:flex-1">
          {ai ? (
            // AI: the visitor's link and the recording in one line (with "All steps"), and its own button.
            <div {...panel("ai")} className={cn(panel("ai").className, "overflow-y-auto")}>
              <TryAiPanel state={aiRun} source="recording" onKeep={keepAi} />
            </div>
          ) : null}
          {/* Profile: the photo beside one group of two fields, then the address, from the top of the panel. */}
          <div {...panel("name")} className={cn(panel("name").className, "lg:justify-start")}>
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="relative shrink-0">
                <button
                  ref={photoTarget}
                  type="button"
                  onClick={() => void pickPhoto()}
                  aria-label={photo?.own ? t("photo.change") : t("photo.add")}
                  aria-describedby={`${id}-photo-hint`}
                  className={cn(
                    "relative grid size-avatar-xl shrink-0 place-items-center overflow-hidden rounded-full transition-[background-color,color,scale] duration-micro focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none lg:size-avatar-2xl",
                    photo ? "border border-line" : "bg-canvas-muted text-fg-secondary hover:bg-tinted hover:text-tinted-fg",
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
              <div className="grid min-w-0 flex-1 rounded-lg bg-canvas-muted">
                <div className="group/field relative">
                  <label htmlFor={`${id}-name`} className={cn(FIELD_LABEL, demoFocus === "name" && "text-link")}>
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
                    className={cn(FIELD, "rounded-t-lg", demoFocus === "name" && FIELD_ON)}
                  />
                </div>
                <span aria-hidden className="ms-4 border-t border-line" />
                <div className="group/field relative">
                  <label htmlFor={`${id}-tagline`} className={cn(FIELD_LABEL, demoFocus === "tagline" && "text-link")}>
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
                    className={cn(FIELD, "rounded-b-lg", demoFocus === "tagline" && FIELD_ON)}
                  />
                </div>
              </div>
            </div>
            <p id={`${id}-name-hint`} className="flex min-w-0 shrink-0 items-center gap-2 px-1 text-caption text-fg-secondary">
              <Icon icon={Link2} size="sm" className="shrink-0" />
              <span className="truncate">{t("name.address", { address: pageAddress(address || "…") })}</span>
            </p>
            {/* The photo button's description (an error is also said once through the status line). */}
            <p id={`${id}-photo-hint`} className={cn("-mt-1 px-1 text-caption text-pretty", photoError ? "text-danger-strong" : "text-fg-secondary")}>
              {photoError ?? t("photo.hint")}
            </p>
          </div>

          {/* Links: paste one (or pick an example); below, what is on the page. */}
          <div {...panel("links")}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                add(draft);
              }}
              className="grid shrink-0 grid-cols-1 gap-2"
            >
              <label htmlFor={`${id}-link`} className="sr-only">
                {tPaste("label")}
              </label>
              <div
                className={cn(
                  "flex h-control-lg items-center gap-2 rounded-lg border border-transparent bg-canvas-muted ps-4 pe-1 transition-[border-color,background-color] duration-micro ease-standard hover:border-line-strong has-[input:focus-visible]:border-focus has-[input:focus-visible]:bg-surface has-[input:focus-visible]:focus-field",
                  demoFocus === "link" && FIELD_ON,
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
                  // An address reads left to right; the empty field's hint follows the page's language.
                  dir={draft ? "ltr" : undefined}
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={tPaste("placeholder")}
                  aria-invalid={error === "invalid" || undefined}
                  aria-describedby={`${id}-link-hint`}
                  className="h-full min-w-0 flex-1 bg-transparent text-body outline-hidden placeholder:text-fg-tertiary"
                />
                {/* Quiet until there is a link to add; then the one filled button in the panel. */}
                <button
                  ref={addTarget}
                  type="submit"
                  aria-label={tPaste("add")}
                  className={cn(
                    "grid size-control-md shrink-0 place-items-center rounded-full transition-[background-color,color,scale] duration-micro focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none",
                    detection ? "bg-primary text-primary-fg hover:bg-primary-hover" : "bg-tinted text-tinted-fg hover:bg-tinted-hover",
                  )}
                >
                  <Icon icon={Plus} size="md" />
                </button>
              </div>
              {/* One slot: the examples while the field is empty, else what the field says (the field's
                  description, not a live region: the demo types here too; the visitor's own additions
                  and errors are said through the status line). */}
              <div className="grid min-h-control-sm shrink-0">
                <p
                  id={`${id}-link-hint`}
                  className={cn("col-start-1 row-start-1 flex min-h-control-sm items-center gap-2 px-4 text-small", error ? "text-danger-strong" : "text-link")}
                >
                  {error === "invalid" ? (
                    tPaste("invalid")
                  ) : error === "limit" ? (
                    t("limit")
                  ) : detection ? (
                    <span key={detection.type} className="inline-flex items-center gap-2 font-semibold motion-safe:animate-fade-in">
                      <Icon icon={CircleCheck} size="sm" />
                      {tPaste("detected", { type: draftProfile ? platformName(draftProfile.platform) : typeLabel(typeKey(detection)) })}
                    </span>
                  ) : null}
                </p>
                {showExamples ? (
                  <div
                    role="group"
                    aria-label={tPaste("examples")}
                    className="mk-no-scrollbar col-start-1 row-start-1 -mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 motion-safe:animate-fade-in sm:-mx-6 sm:px-6 lg:m-0 lg:flex-wrap lg:overflow-visible lg:p-0"
                  >
                    {EXAMPLES.filter((example) => example.chip).map((example) => (
                      <button
                        key={example.id}
                        type="button"
                        onClick={() => {
                          add(example.url, true);
                        }}
                        className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full border border-line bg-surface ps-2 pe-3 text-small font-medium text-fg transition-[border-color,background-color,scale] duration-micro hover:border-line-strong hover:bg-hover focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none"
                      >
                        {example.icon ? <PlatformIcon icon={example.icon} size="sm" /> : <Icon icon={ShoppingBag} size="sm" />}
                        {example.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </form>
            {/* On your page: a row of tinted tokens on phones, a plain list on wide screens. */}
            <section aria-labelledby={`${id}-added`} className="flex min-h-0 flex-1 flex-col gap-1">
              <div className="flex shrink-0 items-baseline justify-between gap-3 px-1 text-caption text-fg-secondary">
                <h3 id={`${id}-added`} className="font-semibold">
                  {t("added")}
                </h3>
                <span className="font-semibold tabular-nums">{t("count", { count: items.length, max: MAX_LINKS })}</span>
              </div>
              {items.length > 0 ? (
                <ul
                  ref={list}
                  aria-label={t("added")}
                  // Phones: one row of whole titles that scrolls sideways, starting inside the card's padding;
                  // a chip brought into view (its remove button focused) keeps the same air at the edges.
                  className="mk-no-scrollbar -mx-4 -my-1 flex scroll-px-4 gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:m-0 lg:grid lg:min-h-0 lg:flex-1 lg:content-start lg:gap-1 lg:overflow-x-hidden lg:overflow-y-auto lg:p-1"
                >
                  {items.map((item) => {
                    const about = describe(item);
                    return (
                      <li
                        key={item.key}
                        className="flex h-control-sm max-w-full shrink-0 items-center gap-2 rounded-full bg-tinted ps-1 text-tinted-fg motion-safe:animate-pop-in lg:h-auto lg:min-h-control-lg lg:gap-3 lg:rounded-none lg:bg-transparent lg:ps-0 lg:text-fg"
                      >
                        <ItemThumb item={item} />
                        <span className="grid min-w-0 lg:flex-1">
                          <span className="truncate text-small font-semibold">{about.title}</span>
                          <span className="truncate text-caption text-fg-secondary max-lg:hidden">
                            <bdi>{about.detail}</bdi>
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            remove(item.key);
                          }}
                          aria-label={tPaste("remove", { title: about.title })}
                          className="grid size-control-sm shrink-0 place-items-center rounded-full transition-colors duration-micro hover:bg-tinted-hover focus-visible:focus-ring lg:size-touch-target lg:text-fg-secondary lg:hover:bg-hover lg:hover:text-fg"
                        >
                          <Icon icon={X} size="sm" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="flex h-control-sm shrink-0 items-center px-1 text-small text-fg-tertiary lg:h-auto lg:py-2">{t("editor.empty")}</p>
              )}
            </section>
          </div>

          {/* Look: every look as a little page in its own colors, type and buttons, and any color.
              Phones: one row that scrolls sideways; wide screens: a grid that fills the panel. */}
          <div {...panel("look")}>
            <div
              ref={strip}
              className="mk-no-scrollbar -mx-4 flex shrink-0 snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:m-0 lg:grid lg:min-h-0 lg:flex-1 lg:snap-none lg:grid-cols-3 lg:grid-rows-2 lg:overflow-visible lg:p-0"
            >
              <div role="radiogroup" aria-label={tLook("choose")} className="flex shrink-0 gap-2 lg:col-span-full lg:row-span-full lg:grid lg:grid-cols-3 lg:grid-rows-2">
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
                      className={cn(lookCard(selected), "w-24 shrink-0 snap-start focus-visible:focus-ring lg:w-auto")}
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
              <label
                className={cn(lookCard(accent !== null), "relative w-24 shrink-0 cursor-pointer snap-start has-[input:focus-visible]:focus-ring lg:col-start-3 lg:row-start-2 lg:w-auto")}
              >
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
                    <span className="grid place-items-center rounded-md border border-line bg-canvas-muted text-fg-secondary max-lg:aspect-portrait">
                      <Icon icon={Palette} size="lg" />
                    </span>
                  )}
                  {accent ? <Chosen /> : null}
                </span>
                <span className="pointer-events-none truncate px-1 text-small font-semibold text-fg max-sm:text-caption">{tLook("custom")}</span>
              </label>
            </div>
            {/* What the look is: read with the panel, not announced (the demo picks a look too). */}
            <p className="shrink-0 text-small text-pretty max-lg:sr-only">
              <span className="font-semibold text-fg">{look.name}</span>
              <span className="text-fg-secondary"> · {look.description}</span>
            </p>
          </div>
        </div>

        {/* One primary button per tab: the AI tab has its own ("Build it with AI, free") in its panel. */}
        <div className={cn("grid shrink-0 gap-1", aiShown && "hidden")}>
          <Link
            ref={ctaTarget}
            href={signup}
            onClick={keep}
            className={cn(
              "group inline-flex h-control-lg items-center justify-center gap-2 rounded-full bg-primary px-6 text-body font-semibold text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed active:bg-primary-pressed motion-reduce:active:scale-none lg:h-control-xl",
              demoFocus === "cta" && "scale-lift bg-primary-hover",
            )}
          >
            {t("cta")}
            <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
          </Link>
          <p className="text-center text-caption text-fg-secondary">{t("ctaHint")}</p>
        </div>
      </div>

      {/* The stage, flat Linkyo teal, after the controls in the DOM. Phones and tablets: on top, short,
          the phone rising from its lower edge, so stage, controls and "Keep this page" fit one screen.
          Wide screens: beside the controls, the whole phone on one soft disc. */}
      <div className="relative isolate grid justify-items-center overflow-hidden bg-teal-900 max-lg:order-first max-lg:mk-play-stage max-lg:pt-3 lg:items-center lg:py-10">
        <div aria-hidden className="mk-deck-halo w-[95%] bg-teal-800 max-lg:hidden" />
        {aiShown ? (
          // The AI tab: the recorded run on the run view (its own chip says it is a recording, its own button plays it).
          <div className="absolute inset-0 overflow-y-auto bg-canvas">
            <TryAiPlayStage onState={setAiRun} />
          </div>
        ) : (
          <>
            {/* Until anything changes, the phone shows the persona's finished page: said here, outside the page. */}
            {sample ? (
              <p className="absolute start-2 top-2 layer-raised inline-flex h-control-sm items-center rounded-full border border-teal-700 bg-teal-800 px-3 text-caption font-semibold text-teal-50 lg:start-3 lg:top-3">
                {t("sample")}
              </p>
            ) : null}
            {/* Watch, stop or watch again: one quiet round button in the stage's corner (WCAG 2.2.2). */}
            <button
              type="button"
              data-demo-button=""
              onClick={() => {
                interacted.current = true;
                if (demo === "running") controller.current?.abort();
                else play();
              }}
              className="absolute end-2 top-2 layer-raised grid size-touch-target place-items-center rounded-full border border-teal-700 bg-teal-800 text-teal-50 transition-[background-color,scale] duration-micro hover:bg-teal-700 focus-visible:focus-ring focus-visible:outline-teal-50 active:scale-pressed motion-reduce:active:scale-none lg:end-3 lg:top-3"
            >
              {/* Media controls keep their direction in Arabic: play points right, replay turns one way. */}
              <Icon key={demo} icon={demo === "running" ? Square : demo === "done" ? RotateCcw : Play} size="sm" className={cn("motion-safe:animate-fade-in", demo === "running" && "fill-current")} />
              <span className="sr-only">{demoLabel}</span>
            </button>
            {near ? (
              <TryPhone
                input={sample ? sampleInput : phoneInput}
                config={sample ? (looks[personaLook] ?? base).config : config}
                rtl={rtl}
                label={t("preview.label")}
                reveal={reveal}
                toast={toast}
                sample={sample}
                crop
                className={PHONE}
              />
            ) : (
              <PhoneFrame crop className={PHONE} />
            )}
          </>
        )}
      </div>
      {/* The demo's pointer: it moves to each control and taps it (a fingertip on touch screens). Decoration only. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-0 layer-raised transition-[translate,opacity] duration-slow ease-standard motion-reduce:hidden",
          cursor.visible ? "opacity-100" : "opacity-0",
        )}
        style={{ translate: `${cursor.x}px ${cursor.y}px` }}
      >
        {cursor.tap > 0 ? <span key={cursor.tap} className="mk-tap absolute -top-4 -left-4 size-8 rounded-full bg-primary" /> : null}
        <span className="absolute -top-3 -left-3 hidden size-6 rounded-full border-emphasis border-surface bg-scrim pointer-coarse:block" />
        <Icon icon={MousePointer2} size="lg" className="relative fill-ink text-white pointer-coarse:hidden" />
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
