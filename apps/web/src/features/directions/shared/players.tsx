"use client";

import type { VideoPlayback } from "@linkyo/blocks";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cx } from "./cx";
import { usePrivacyChoice } from "./privacy";
import { PREVIEW_SECONDS, youtubeEnded, youtubeId, youtubeWatchUrl } from "./providers";

const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";

/**
 * iPhone, iPad and Safari only let an embedded video start with sound from a tap inside the player.
 * Started muted, it plays on the visitor's first tap on our poster (YouTube shows "unmute").
 */
function startsMuted(): boolean {
  const { userAgent, maxTouchPoints } = window.navigator;
  const ios = /iP(hone|ad|od)/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1);
  const safari = userAgent.includes("Safari/") && !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg|OPR|Android)\//.test(userAgent);
  return ios || safari;
}

/**
 * The YouTube player in privacy mode. In preview mode it stops after PREVIEW_SECONDS and tells us
 * (postMessage), so the page can offer to keep watching on YouTube.
 */
function YouTubePlayer({ video, title, preview, className, onEnded }: { video: string; title: string; preview: boolean; className: string; onEnded: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!preview) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== YOUTUBE_EMBED_ORIGIN || event.source !== frame.current?.contentWindow) return;
      if (youtubeEnded(event.data)) onEnded();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [preview, onEnded]);
  // Ask the player to report its state (it answers only after a "listening" message).
  const listen = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), YOUTUBE_EMBED_ORIGIN);
  const params = `${startsMuted() ? "&mute=1" : ""}${preview ? `&end=${PREVIEW_SECONDS}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}` : ""}`;
  return (
    <iframe
      ref={frame}
      src={`${YOUTUBE_EMBED_ORIGIN}/embed/${video}?autoplay=1&rel=0&playsinline=1${params}`}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={preview ? listen : undefined}
      className={className}
    />
  );
}

/** The player's icons, drawn where the page is rendered (`./islands.tsx`). */
export interface ClickToLoadIcons {
  play: ReactNode;
  external: ReactNode;
  shield: ReactNode;
}

/**
 * Each state's classes, the caller's `className` merged in where the page is rendered: the link to the
 * platform, the ended preview, the player, the note once loaded, and the poster button.
 */
export interface ClickToLoadClasses {
  link: string;
  ended: string;
  player: string;
  loaded: string;
  button: string;
}

/**
 * Click-to-load embed (brand privacy promise): nothing from YouTube/TikTok/Instagram loads until the
 * visitor taps. Phase 0 shows the post-tap state as a placeholder; Phase 1 swaps in the nocookie player.
 */
export function ClickToLoadIsland({
  provider,
  title,
  poster,
  classes,
  icons,
  children,
  compact = false,
  url,
  playback = "inline",
}: {
  provider: string;
  url?: string | undefined;
  playback?: VideoPlayback | undefined;
  title: string;
  poster: ReactNode;
  classes: ClickToLoadClasses;
  icons: ClickToLoadIcons;
  children?: ReactNode;
  compact?: boolean;
}) {
  const t = useTranslations("creator");
  const [loaded, setLoaded] = useState(false);
  const [ended, setEnded] = useState(false);
  // Once a visitor has allowed external content, the per-player notice is no longer needed.
  const allowed = usePrivacyChoice() === "media";
  const video = url ? youtubeId(url) : null;
  const preview = playback === "preview" && video !== null;
  const playButton = (
    <span className="absolute inset-0 grid place-items-center" aria-hidden>
      <span
        className={cx(
          "grid place-items-center rounded-full bg-creator-accent text-creator-accent-fg",
          "transition-[scale] duration-standard ease-standard group-hover/video:scale-lift motion-reduce:transition-none",
          compact ? "size-control-md" : "size-control-xl",
        )}
      >
        {icons.play}
      </span>
    </span>
  );

  // Opens on the platform: a plain link, nothing loads on the page.
  if (playback === "external" && url) {
    return (
      <a href={video ? youtubeWatchUrl(video) : url} target="_blank" rel="noopener" className={classes.link}>
        <span className="sr-only">{t("watchOn", { title, provider })}</span>
        {poster}
        {playButton}
        <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-caption" aria-hidden>
          <span className="inline-flex items-center gap-1 rounded-full bg-creator-glass px-2 py-1 text-creator-fg backdrop-blur-glass">
            {t("opensOn", { provider })}
            {icons.external}
          </span>
          {compact ? null : children}
        </span>
        {compact ? children : null}
      </a>
    );
  }

  // The preview has played: keep watching on the platform, from where it stopped.
  if (ended && video) {
    return (
      <div className={classes.ended}>
        <span aria-hidden className="absolute inset-0 opacity-secondary">
          {poster}
        </span>
        <span aria-hidden className="absolute inset-0 bg-creator-bg opacity-secondary" />
        <div className="relative grid place-content-center justify-items-center gap-3 p-4 text-center" role="status">
          <p className="text-small font-semibold text-creator-fg">{t("previewEnded")}</p>
          <a
            href={youtubeWatchUrl(video, PREVIEW_SECONDS)}
            target="_blank"
            rel="noopener"
            className="inline-flex h-control-md items-center gap-2 rounded-full bg-creator-accent px-4 text-small font-semibold text-creator-accent-fg focus-visible:focus-ring"
          >
            {t("continueOn", { provider })}
            {icons.external}
          </a>
        </div>
      </div>
    );
  }

  if (loaded && video) return <YouTubePlayer video={video} title={title} preview={preview} className={classes.player} onEnded={() => setEnded(true)} />;
  if (loaded) {
    return (
      <div className={classes.loaded} role="status">
        {icons.shield}
        <p className="max-w-prose">{t("playerHere")}</p>
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setLoaded(true)} className={classes.button}>
      <span className="sr-only">{t(preview ? "playPreview" : "playVideo", { title, seconds: PREVIEW_SECONDS })}</span>
      {poster}
      {playButton}
      {preview ? (
        <span aria-hidden className="absolute start-3 top-3 rounded-full bg-creator-glass px-2 py-1 text-caption font-semibold text-creator-fg backdrop-blur-glass">
          {t("previewChip", { seconds: PREVIEW_SECONDS })}
        </span>
      ) : null}
      {!compact ? (
        <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-caption">
          {allowed ? <span /> : <span className="rounded-full bg-creator-glass px-2 py-1 text-creator-fg backdrop-blur-glass">{t("loadsFrom", { provider })}</span>}
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** The newsletter form's icons, drawn where the page is rendered (`./islands.tsx`). */
export interface NewsletterIcons {
  info: ReactNode;
  email: ReactNode;
  submit: ReactNode;
  promise: ReactNode;
}

/**
 * Newsletter sign-up: one field, one button in the creator's accent, a promise underneath. Stacks on
 * phones (a thumb-wide button), sits side by side on wide screens.
 *
 * There is no newsletter service yet, so the form only appears where nothing could be sent anyway
 * (example pages, the owner's preview in the dashboard and samples; real pages leave newsletter
 * blocks out, public-page.ts). It never claims a send: submitting says that sign-ups do not exist yet
 * and that nothing was sent or kept, words that are true on each of those surfaces. No request
 * leaves the page.
 */
export function NewsletterFormIsland({ icons }: { icons: NewsletterIcons }) {
  const t = useTranslations("creator");
  const id = useId();
  const [example, setExample] = useState(false);
  if (example) {
    return (
      <div role="status" data-newsletter-example className="flex items-start gap-3 rounded-creator-button border border-creator-line bg-creator-bg p-4">
        <span className="grid size-control-md shrink-0 place-items-center rounded-full border border-creator-line-strong text-creator-fg">{icons.info}</span>
        <span className="grid min-w-0 gap-0.5">
          <span className="text-body font-semibold">{t("newsletter.exampleTitle")}</span>
          <span className="text-small text-creator-fg-muted">{t("newsletter.exampleBody")}</span>
        </span>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        // Nothing is sent: the browser has checked the address, the page says what happens to it.
        event.preventDefault();
        setExample(true);
      }}
      className="grid grid-cols-1 gap-3"
    >
      <div className="grid grid-cols-1 gap-2 @prose:grid-cols-[minmax(0,1fr)_auto]">
        <label
          htmlFor={id}
          className="flex h-control-lg min-w-0 items-center gap-3 rounded-creator-button border border-creator-line-strong bg-creator-bg px-4 transition-colors duration-micro focus-within:border-creator-accent-text focus-within:focus-field focus-within:outline-creator-accent-text"
        >
          {icons.email}
          <span className="sr-only">{t("emailLabel")}</span>
          <input
            id={id}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            placeholder={t("emailPlaceholder")}
            className="h-full w-full min-w-0 bg-transparent text-start text-body text-creator-fg outline-none placeholder:text-creator-fg-muted rtl:text-end"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-control-lg w-full items-center justify-center gap-2 rounded-creator-button bg-creator-accent px-6 text-body font-semibold text-creator-accent-fg transition-[scale,opacity] duration-micro focus-visible:focus-ring active:scale-pressed @prose:w-auto"
        >
          {t("subscribe")}
          {icons.submit}
        </button>
      </div>
      <p className="flex items-center gap-2 text-caption text-creator-fg-muted">
        {icons.promise}
        {t("newsletterPromise")}
      </p>
    </form>
  );
}
