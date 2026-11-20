"use client";

import { detectLink, NO_IMAGE, type Block, type Detection, type Page, type Platform } from "@linkyo/blocks";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cn, Icon, PlatformIcon } from "@linkyo/ui";
import {
  ArrowRight,
  Camera,
  CircleCheck,
  Clapperboard,
  Eraser,
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
  Ticket,
  UserRound,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { saveTryDraft } from "@/features/account/try-draft";
import { suggestUsername } from "@/features/account/username";
import { blockFromLink } from "@/features/app/blocks";
import { ImageError, pickFiles, prepareImage } from "@/features/app/images";
import { socialProfile } from "@/features/app/import-links";
import type { SocialPlatform } from "@/features/app/kinds";
import { fetchLinkMetadata, metadataPatch, metadataUrl, type LinkMetadata } from "@/features/app/metadata";
import { mediaSizes, PlatformGlyph, platformName } from "@/features/directions/shared/creator-kit";
import { resolveMedia } from "@/features/directions/shared/media";
import { Link } from "@/i18n/navigation";

import { TryPhone, type Reveal } from "./try-phone";
import { EXAMPLES, PERSONA, sampleBlock, sampleOf, type SampleId } from "./try-samples";

/** One look to try: a complete look from the template gallery, named after its template. */
export interface LookOption {
  id: string;
  config: CreatorThemeConfig;
  name: string;
  description: string;
}

type Tab = "name" | "links" | "look";
const TABS: { id: Tab; icon: LucideIcon }[] = [
  { id: "name", icon: UserRound },
  { id: "links", icon: Link2 },
  { id: "look", icon: Palette },
];

const TYPE_ICONS: Record<string, LucideIcon> = { music: Music2, video: Video, shorts: Clapperboard, events: Ticket, product: ShoppingBag, live: Radio, image: ImageIcon };
const KNOWN = new Set(["music", "video", "shorts", "events", "product", "live", "image", "card", "link"]);
/** Profiles that become an icon under the name, as in the welcome flow (songs, videos and channels stay blocks). */
const ICON_PROFILES: readonly SocialPlatform[] = ["instagram", "tiktok", "x", "threads", "linkedin", "facebook", "github", "whatsapp", "discord"];
const MAX_LINKS = 6;
/** A look starts the playground; the persona's own look ends the demo. */
const FIRST_LOOK = "daylight";
/** The demo's steps, each with its caption: photo, name and line, links, look, live. */
const DEMO_STEPS = ["photo", "profile", "links", "look", "live"] as const;

interface Added {
  key: string;
  url: string;
  type: string;
  platform: Platform | undefined;
  /** A social profile: an icon under the name instead of a block. */
  social: SocialPlatform | undefined;
  /** An example link: shown with the persona's pictures, never looked up or carried over. */
  sample: SampleId | undefined;
  /** The real title and picture of a pasted song or video, once the server found them. */
  meta?: LinkMetadata;
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
  return platform && platform !== "website" ? <PlatformGlyph platform={platform} size="sm" /> : <Icon icon={TYPE_ICONS[item.type] ?? Link2} size="sm" />;
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
 * The first time it scrolls into view it introduces Juno Kade, the DJ from the template gallery: the
 * portrait, the name and the line typed, Instagram, the new single and a live set pasted, and their own
 * look picked. It runs once and stops for good at the visitor's first touch; what it typed is selected
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
  const [announcement, setAnnouncement] = useState("");
  const [reveal, setReveal] = useState<Reveal>({ to: "top", at: 0 });
  // The demo: which step it is on, the cursor, the control it pretends to focus, the phone's message.
  const [demo, setDemo] = useState<{ step: number; state: "idle" | "running" | "done" }>({ step: -1, state: "idle" });
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false, tap: 0 });
  const [demoFocus, setDemoFocus] = useState<"name" | "tagline" | "link" | "cta" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const show = (to: Reveal["to"]) => {
    setReveal((current) => ({ to, at: current.at + 1 }));
  };

  const themes = useMemo(() => looks.map((option) => resolveCreatorTheme(option.config, { rtlScript: rtl })), [looks, rtl]);
  const base = looks[lookIndex] ?? looks[0];
  const config: CreatorThemeConfig = accent ? { ...base.config, accent } : base.config;
  const customTheme = useMemo(() => (accent ? resolveCreatorTheme({ ...base.config, accent }, { rtlScript: rtl }) : null), [accent, base, rtl]);
  const theme = customTheme ?? themes[lookIndex] ?? resolveCreatorTheme(base.config, { rtlScript: rtl });
  const look = accent ? { ...base, name: tLook("custom"), description: tLook("customHint") } : base;

  const detection = draft.trim() ? detectLink(draft.trim()) : null;
  const address = suggestUsername(name);
  const typeLabel = (type: string) => tPaste(`types.${type}`);
  const itemLabel = (item: Added) => (item.social ? platformName(item.social) : typeLabel(item.type));
  const displayName = name.trim() || t("preview.name");
  const labels = useMemo(() => ({ video: tTypes("video"), music: tTypes("music"), event: tTypes("events") }), [tTypes]);

  // The page as the renderer gets it: the same profile and blocks a new account starts with.
  const page = useMemo<Page>(() => {
    const socials = items.flatMap((item) => (item.social ? [{ platform: item.social, url: item.url }] : []));
    const blocks = items.flatMap((item): Block[] => {
      if (item.social) return [];
      if (item.sample && item.sample !== "instagram") {
        return [
          sampleBlock(item.sample, item.key, item.url, {
            artist: displayName,
            channel: (address || "junokade").replace(/-/g, "_"),
            texts: { video: t("samples.video"), product: t("samples.product") },
          }),
        ];
      }
      const found = detectLink(item.url);
      if (!found) return [];
      const block = { ...blockFromLink(found, labels, displayName), id: item.key };
      const patch = item.meta ? metadataPatch(block, block, item.meta) : null;
      return [patch ? ({ ...block, ...patch } as Block) : block];
    });
    const line = tagline.trim();
    return {
      profile: {
        username: address || "…",
        displayName,
        bio: "",
        avatar: photo ? { src: photo.src, alt: "", tone: photo.tone } : { src: NO_IMAGE, alt: "" },
        ...(line ? { tagline: line } : {}),
        verified: false,
        locale: locale === "ar" || locale === "en" ? locale : "de",
      },
      blocks: socials.length > 0 ? [{ id: `${id}-socials`, type: "socials", visible: true, highlight: false, items: socials }, ...blocks] : blocks,
    };
  }, [items, displayName, tagline, address, photo, labels, locale, t, id]);

  /** Songs and videos the visitor pasted get their real title and cover, as in the app. */
  const enrich = (item: Added) => {
    if (item.sample || item.social) return;
    const found = detectLink(item.url);
    const url = found ? metadataUrl(blockFromLink(found, labels, "")) : null;
    if (!url) return;
    void fetchLinkMetadata(url).then((meta) => {
      if (meta) setItems((current) => current.map((candidate) => (candidate.key === item.key ? { ...candidate, meta } : candidate)));
    });
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
  const pulseLook = looks.findIndex((option) => option.id === "pulse");
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
    setDemo({ step: DEMO_STEPS.length, state: "done" });
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
    const step = (index: number) => {
      setDemo({ step: index, state: "running" });
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    reset();
    void (async () => {
      try {
        step(0);
        await wait(700);
        pointAt(photoTarget.current);
        await wait(700);
        tap();
        setPhoto({ ...PERSONA.photo, own: false });
        await wait(800);

        step(1);
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

        step(2);
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

        step(3);
        pointAt(tabs.current[2]);
        await wait(650);
        tap();
        setTab("look");
        await wait(450);
        if (pulseLook >= 0) {
          pointAt(radios.current[pulseLook]);
          await wait(550);
          tap();
          setLookIndex(pulseLook);
          await wait(1100);
        }
        pointAt(radios.current[personaLook]);
        await wait(550);
        tap();
        setLookIndex(personaLook);
        show("top");
        await wait(900);

        step(4);
        setToast(t("demo.live"));
        pointAt(ctaTarget.current);
        await wait(700);
        setDemoFocus("cta");
        await wait(1800);
        setDemoFocus(null);
        setCursor((current) => ({ ...current, visible: false }));
        setDemo({ step: DEMO_STEPS.length, state: "done" });
        await wait(1500);
        setToast(null);
      } catch {
        // Stopped by the visitor: what is there stays, and it is their turn.
        setCursor((current) => ({ ...current, visible: false }));
        setDemoFocus(null);
        setToast(null);
        setDemo((current) => (current.state === "running" ? { ...current, state: "done" } : current));
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
    frame.current = requestAnimationFrame(() => {
      setAccent(value);
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
    // All panels share one cell, so switching tabs never changes the card's height.
    className: cn("col-start-1 row-start-1 grid content-start gap-3 transition-opacity duration-standard ease-standard motion-reduce:transition-none", tab === entry ? "opacity-100" : "invisible opacity-0"),
  });
  const demoButton =
    "inline-flex h-control-sm items-center gap-2 rounded-full border border-line bg-surface px-3 text-small font-semibold text-fg transition-[border-color,background-color,scale] duration-micro hover:border-line-strong hover:bg-hover focus-visible:focus-ring active:scale-pressed";
  const field =
    "h-control-lg w-full min-w-0 rounded-full border border-transparent bg-canvas-muted px-4 text-body text-fg outline-none transition-colors duration-micro placeholder:text-fg-tertiary focus-visible:border-link focus-visible:focus-ring";

  return (
    <div
      ref={root}
      onPointerDownCapture={takeOver}
      onFocusCapture={takeOver}
      onKeyDownCapture={takeOver}
      className="relative mx-auto grid w-full max-w-prose grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      {/* The stage: the phone with the page, above the controls on phones (its lower part out of
          view, it scrolls to each change) and beside them, whole, on wide screens. */}
      <div className="relative isolate grid justify-items-center overflow-hidden border-b border-line bg-canvas-muted max-lg:aspect-portrait max-lg:pt-8 lg:order-last lg:items-center lg:border-s lg:border-b-0 lg:py-12">
        <div aria-hidden className="mk-deck-halo w-[140%] border border-line" />
        <div aria-hidden className="mk-deck-halo w-[95%] bg-tint-teal" />
        <TryPhone page={page} theme={theme} label={t("preview.label")} reveal={reveal} toast={toast} className="w-sidebar max-lg:self-start lg:w-3/5" />
      </div>

      <div className="grid content-start gap-4 p-4 sm:p-6 lg:content-center lg:p-8">
        {/* The demo's progress, its caption, and afterwards the way to watch it again or start empty. */}
        <div className="grid gap-2">
          <div aria-hidden className="grid grid-cols-5 gap-1">
            {DEMO_STEPS.map((entry, index) => (
              <span
                key={entry}
                className={cn(
                  "h-1 rounded-full transition-colors duration-standard ease-standard motion-reduce:transition-none",
                  demo.state !== "idle" && index <= demo.step ? "bg-primary" : "bg-line",
                )}
              />
            ))}
          </div>
          <div className="flex min-h-control-sm flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p data-demo-caption className="text-small font-semibold text-fg">
              {demo.state === "running" ? t(`demo.steps.${DEMO_STEPS[demo.step] ?? "live"}`) : demo.state === "done" ? t("demo.yourTurn") : t("demo.watch")}
            </p>
            {demo.state === "idle" ? (
              <button type="button" onClick={play} className={demoButton}>
                <Icon icon={Play} size="sm" className="rtl:-scale-x-100" />
                {t("demo.play")}
              </button>
            ) : demo.state === "done" ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={play} className={demoButton}>
                  <Icon icon={RotateCcw} size="sm" className="rtl:-scale-x-100" />
                  {t("demo.replay")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setAnnouncement(t("demo.cleared"));
                  }}
                  className="inline-flex h-control-sm items-center gap-2 rounded-full px-3 text-small font-semibold text-fg-secondary transition-[color,background-color,scale] duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring active:scale-pressed"
                >
                  <Icon icon={Eraser} size="sm" />
                  {t("demo.clear")}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div role="tablist" aria-label={t("tabs.label")} className="grid grid-cols-3 gap-1 rounded-full bg-canvas-muted p-1">
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

        <div className="grid">
          <div {...panel("name")}>
            <div className="flex items-end gap-3">
              <div className="relative shrink-0">
                <button
                  ref={photoTarget}
                  type="button"
                  onClick={() => void pickPhoto()}
                  aria-label={photo?.own ? t("photo.change") : t("photo.add")}
                  className={cn(
                    "relative grid size-control-xl place-items-center overflow-hidden rounded-full transition-[border-color,background-color,scale] duration-micro focus-visible:focus-ring active:scale-pressed",
                    photo ? "border border-line" : "border border-dashed border-line-strong bg-canvas-muted text-fg-secondary hover:border-link hover:text-link",
                  )}
                >
                  {photo ? (
                    <Image key={photo.src} src={resolveMedia(photo.src)} alt="" fill sizes={mediaSizes.thumb} className="object-cover motion-safe:animate-pop-in" />
                  ) : (
                    <Icon icon={Camera} size="md" />
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
                    className="absolute -end-1 -top-1 grid size-6 place-items-center rounded-full border border-line bg-surface-elevated text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
                  >
                    <Icon icon={X} size="sm" />
                  </button>
                ) : null}
              </div>
              <div className="grid min-w-0 flex-1 gap-1">
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
            </div>
            <div className="grid gap-1">
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
            <p id={`${id}-name-hint`} className={cn("flex min-w-0 items-center gap-2 px-1 text-small", photoError ? "text-danger-strong" : "text-fg-secondary")}>
              {photoError ?? (
                <>
                  <Icon icon={Link2} size="sm" className="shrink-0" />
                  <span className="truncate">{t("name.address", { address: `linkyo.app/${address || "…"}` })}</span>
                </>
              )}
            </p>
          </div>

          <div {...panel("links")}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                add(draft);
              }}
              className="grid gap-1"
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
            <div role="group" aria-label={tPaste("examples")} className="mk-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {EXAMPLES.map((example) => (
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
            {items.length > 0 ? (
              <ul aria-label={t("added")} className="mk-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                {items.map((item) => (
                  <li key={item.key} className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full bg-selected ps-3 pe-1 text-small font-medium text-selected-fg">
                    <BlockIcon item={item} />
                    {itemLabel(item)}
                    <button
                      type="button"
                      onClick={() => {
                        setItems((current) => current.filter((candidate) => candidate.key !== item.key));
                        setError(null);
                      }}
                      aria-label={tPaste("remove", { title: itemLabel(item) })}
                      className="grid size-6 place-items-center rounded-full transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
                    >
                      <Icon icon={X} size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div {...panel("look")}>
            <div className="flex flex-wrap items-center gap-1">
              <div role="radiogroup" aria-label={tLook("choose")} className="flex items-center gap-1">
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
                      style={themes[index]?.cssVars}
                      className={cn(
                        "grid size-touch-target shrink-0 place-items-center rounded-full border-emphasis p-1 transition-[border-color,scale] duration-standard ease-standard focus-visible:focus-ring active:scale-pressed motion-reduce:transition-none",
                        selected ? "border-link" : "border-transparent hover:border-line-strong",
                      )}
                    >
                      <span className="size-full rounded-full border border-line bg-linear-135 from-creator-bg from-50% to-creator-accent to-50%" />
                    </button>
                  );
                })}
              </div>
              <label
                style={customTheme?.cssVars}
                className={cn(
                  "relative grid size-touch-target shrink-0 cursor-pointer place-items-center rounded-full border-emphasis p-1 transition-[border-color,scale] duration-standard ease-standard has-[input:focus-visible]:focus-ring active:scale-pressed motion-reduce:transition-none",
                  accent ? "border-link" : "border-transparent hover:border-line-strong",
                )}
              >
                <input
                  type="color"
                  aria-label={tLook("custom")}
                  onChange={(event) => {
                    pickColor(event.target.value);
                  }}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <span className={cn("pointer-events-none grid size-full place-items-center rounded-full", accent ? "bg-creator-accent text-creator-accent-fg" : "border border-dashed border-line-input text-fg-secondary")}>
                  <Icon icon={Palette} size="sm" />
                </span>
              </label>
            </div>
            <p aria-live="polite" className="text-small text-pretty">
              <span className="font-semibold text-fg">{look.name}</span>
              <span className="text-fg-secondary"> · {look.description}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-2 border-t border-line pt-4">
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
