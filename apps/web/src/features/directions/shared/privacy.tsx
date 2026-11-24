"use client";

import { cn, Icon } from "@linkyo/ui";
import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, use, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Privacy notice on creator pages. The pages set no cookies and track nothing; the only thing that
 * talks to another company is an embedded player (YouTube, TikTok …), and those load on tap. The
 * notice says so and lets visitors allow external content once for all pages. It appears only on
 * pages that have such players, and it wears the creator's own colors (it is part of their page).
 * It is one slim bar at the bottom (audit C-05), so the page opens with its photo in full; the
 * sentence and the choice per category sit behind "Settings".
 *
 * The choice is kept in localStorage: storing a consent decision is strictly necessary (TTDSG § 25 (2)).
 */
type Choice = "media" | "essential";
const KEY = "linkyo.privacy.v1";
const OPEN_EVENT = "linkyo:privacy-open";
const CLOSE_EVENT = "linkyo:privacy-close";
const listeners = new Set<() => void>();

const read = (): Choice | null => {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "media" || value === "essential" ? value : null;
  } catch {
    return null;
  }
};

function save(choice: Choice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Private mode without storage: the choice holds for this page view.
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

/** "media", "essential", null (not decided yet), or undefined while rendering on the server. */
export function usePrivacyChoice(): Choice | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

/** How many notices are on screen now (a page renders at most one; a dashboard may hold a preview too). */
let onScreen = 0;
const screenListeners = new Set<() => void>();
const subscribeScreen = (listener: () => void) => {
  screenListeners.add(listener);
  return () => {
    screenListeners.delete(listener);
  };
};
function countOnScreen(delta: number) {
  onScreen += delta;
  for (const listener of screenListeners) listener();
}
const anyOnScreen = () => onScreen > 0;
const noneOnServer = () => false;

/**
 * Whether the notice is on screen: not decided yet, or opened again from the footer, and not held
 * back by the owner's preview. For bars that share the bottom of the screen with it (the owner's bar
 * on "View my page"), so they can step aside. `hasProviders`: the page has players at all.
 */
export function usePrivacyNoticeOpen(hasProviders: boolean): boolean {
  const shown = useSyncExternalStore(subscribeScreen, anyOnScreen, noneOnServer);
  return hasProviders && shown;
}

/** Footer link that brings the notice back, so a decision can always be changed. */
export function PrivacySettingsLink({ className }: { className?: string }) {
  const t = useTranslations("creator");
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className}>
      {t("privacySettings")}
    </button>
  );
}

/** A switch in the creator's colors (the dashboard's Switch wears Linkyo's colors, not theirs). */
function ThemedSwitch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange?: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-control-sm w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-micro focus-visible:focus-ring disabled:opacity-secondary",
        checked ? "bg-creator-accent" : "bg-creator-line-strong",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-6 rounded-full transition-transform duration-micro ease-standard",
          checked ? "translate-x-5 bg-creator-accent-fg rtl:-translate-x-5" : "bg-creator-surface",
        )}
      />
    </button>
  );
}

/**
 * Inside the templates gallery's preview frame (`data-linkyo-preview`) the notice stays away: it would
 * cover the page being shown, and nothing external loads there anyway (each video still asks when
 * tapped). On the page itself, and in any other frame, it shows as always.
 */
const inGalleryPreview = () => window.frameElement?.hasAttribute("data-linkyo-preview") ?? false;
const staysPut = () => () => undefined;
/** Whether this page is shown inside the templates gallery's preview frame (false on the server). */
export const useInGalleryPreview = (): boolean => useSyncExternalStore(staysPut, inGalleryPreview, () => false);

const OwnerPreviewContext = createContext(false);

/**
 * The owner looking at their own page in the dashboard (its phone preview, "View my page"): the page
 * exactly as visitors see it, minus the notice that asks visitors for their choice (audit D-17). The
 * owner is no visitor, and the notice would cover the page they are judging. Their footer link still
 * opens it, so they can see it and make their own choice; visitors keep seeing it as before.
 * `bar`: the owner's floating bar sits at the bottom ("View my page"), so the page ends with room for
 * it: its last line (the footer with that link) can be scrolled clear of the bar, even on a short page.
 */
export function OwnerPreview({ children, bar = false }: { children: ReactNode; bar?: boolean }) {
  return (
    <OwnerPreviewContext value>
      {children}
      {bar ? <div aria-hidden className="h-[calc(var(--spacing-control-md)+var(--spacing-2)+max(var(--spacing-4),env(safe-area-inset-bottom)))]" /> : null}
    </OwnerPreviewContext>
  );
}

/**
 * The bar's buttons: one control row, small type on phones so the three choices fit one line; a
 * label that still does not fit (a narrow phone, a wide face) wraps inside its button instead of
 * pushing the bar wider. Touch grows the tap area to the touch target.
 */
const barButton = cn(
  "relative inline-flex h-control-md min-w-0 items-center justify-center gap-2 rounded-creator-button px-3 text-center text-caption leading-tight font-semibold text-balance",
  "transition-[scale,background-color,color] duration-micro focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none",
  "before:absolute before:inset-0 pointer-coarse:before:-inset-0.5 @prose:px-4 @prose:text-small",
);
const sheetButton =
  "min-h-control-lg w-full rounded-creator-button px-4 py-2 text-body font-semibold leading-tight text-balance transition-[scale,background-color] duration-micro focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none";

/**
 * One slim bar across the bottom of the page in the creator's own colors (their surface, a hairline
 * on top): on phones the shield (it opens the settings) and the two choices; on wider screens the
 * title, "Settings" and the two choices. Never taller than one control row, so the first screen stays
 * the creator's. "Settings" opens the full sentence and a switch per category; the main button is
 * filled with the creator's accent. Honest copy: there are no tracking cookies here. While the Linkyo
 * bar (dock) is shown under it, the bar sits right above it instead of covering it.
 */
export function PrivacyNotice({ providers }: { providers: string[] }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const choice = usePrivacyChoice();
  const previewed = useInGalleryPreview();
  const owner = use(OwnerPreviewContext);
  const [reopened, setReopened] = useState(false);
  const [details, setDetails] = useState(false);
  const [media, setMedia] = useState(false);
  const sentenceId = useId();
  const manage = useRef<HTMLButtonElement>(null);
  const settingsTitle = useRef<HTMLParagraphElement>(null);
  // Focus follows the visitor between the bar and the settings (the button they pressed is gone).
  const moveFocus = useRef(false);

  useEffect(() => {
    const open = () => {
      setReopened(true);
      setDetails(false);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  // Visitors see it until they decide; the owner's preview only when the footer link asks for it.
  const visible = !previewed && choice !== undefined && (reopened || (choice === null && !owner));
  useEffect(() => {
    if (!visible) return;
    countOnScreen(1);
    return () => countOnScreen(-1);
  }, [visible]);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (details ? settingsTitle.current : manage.current)?.focus();
  }, [details]);

  if (!visible) return null;
  const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(providers);
  const sentence = t("privacyBody", { providers: list });
  const decide = (next: Choice) => {
    save(next);
    window.dispatchEvent(new Event(CLOSE_EVENT));
    setReopened(false);
    setDetails(false);
  };
  const showDetails = (show: boolean) => {
    if (show) setMedia(choice === "media");
    moveFocus.current = true;
    setDetails(show);
  };

  if (details) {
    return (
      <section
        aria-label={t("privacyLabel")}
        data-privacy-notice="settings"
        className="layer-overlay fixed inset-x-0 bottom-0 max-h-dvh overflow-y-auto overscroll-contain border-t border-creator-line bg-creator-surface text-creator-fg"
      >
        <div className="mx-auto grid max-w-creator gap-4 px-5 pt-5 pb-[max(var(--spacing-5),env(safe-area-inset-bottom))]">
          <div className="grid gap-2">
            {/* Not a heading: the notice is no part of the creator's page outline (the region is labelled). */}
            <p
              ref={settingsTitle}
              tabIndex={-1}
              className="flex items-center gap-2 justify-self-start rounded-xs text-h3 font-semibold text-creator-accent-text focus-visible:focus-ring"
            >
              <Icon icon={ShieldCheck} size="md" />
              {t("privacySettings")}
            </p>
            <p className="text-small text-pretty text-creator-fg-muted">{sentence}</p>
          </div>
          <ul className="grid gap-2">
            <li className="flex items-start gap-3 rounded-creator-card bg-creator-surface-2 p-3">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-body font-semibold">{t("privacyNecessary")}</span>
                <span className="text-small text-creator-fg-muted">{t("privacyNecessaryBody")}</span>
              </span>
              <span className="shrink-0 pt-0.5 text-small font-medium text-creator-fg-muted">{t("privacyAlwaysOn")}</span>
            </li>
            <li className="flex items-start gap-3 rounded-creator-card bg-creator-surface-2 p-3">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-body font-semibold">{t("privacyMedia")}</span>
                <span className="text-small text-creator-fg-muted">{t("privacyMediaBody", { providers: list })}</span>
              </span>
              <ThemedSwitch checked={media} onChange={setMedia} label={t("privacyMedia")} />
            </li>
          </ul>
          <div className="grid gap-2">
            <button type="button" onClick={() => decide(media ? "media" : "essential")} className={cn(sheetButton, "bg-creator-accent text-creator-accent-fg")}>
              {t("privacySave")}
            </button>
            <button
              type="button"
              onClick={() => showDetails(false)}
              className="justify-self-center rounded-xs px-2 py-2 text-small text-creator-fg-muted hover:text-creator-fg focus-visible:focus-ring"
            >
              {t("privacyBack")}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Room after the footer, so the bar never covers the page's last line. */}
      <div aria-hidden className="h-[calc(var(--spacing-control-lg)+env(safe-area-inset-bottom))]" />
      <section
        aria-label={t("privacyLabel")}
        data-privacy-notice="bar"
        className={cn(
          "layer-overlay fixed inset-x-0 bottom-0 border-t border-creator-line bg-creator-surface pb-[env(safe-area-inset-bottom)] text-creator-fg motion-safe:animate-rise-in",
          // Above the Linkyo bar while it is shown: its pill, the pill's padding and border, its own padding.
          "transition-[bottom] duration-standard ease-standard motion-reduce:transition-none",
          "[[data-shown]~&]:bottom-[calc(var(--spacing-control-md)+2*var(--spacing-1)+2*var(--border-width-hairline)+max(var(--spacing-3),env(safe-area-inset-bottom)))] [[data-shown]~&]:pb-0",
        )}
      >
        <div className="mx-auto flex h-control-lg max-w-work items-center gap-2 px-3 @prose:px-creator-gutter">
          <p className="hidden min-w-0 flex-1 items-center gap-2 text-small font-semibold text-creator-accent-text @column-wide:flex">
            <Icon icon={ShieldCheck} size="md" />
            <span className="truncate">{t("privacyTitle")}</span>
          </p>
          {/* Phones: the shield alone, named "Settings"; wider screens: the word (with the shield until the title carries it). */}
          <button
            ref={manage}
            type="button"
            onClick={() => showDetails(true)}
            className={cn(barButton, "me-auto shrink-0 text-creator-fg-muted hover:text-creator-fg @max-prose:w-control-md @max-prose:px-0 @column-wide:me-0")}
          >
            <Icon icon={ShieldCheck} size="md" className="text-creator-accent-text @column-wide:hidden" />
            <span className="@max-prose:sr-only">{t("privacyManage")}</span>
          </button>
          <button type="button" onClick={() => decide("essential")} className={cn(barButton, "border border-creator-accent-text text-creator-accent-text hover:bg-creator-surface-2")}>
            {t("privacyEssential")}
          </button>
          <button type="button" onClick={() => decide("media")} aria-describedby={sentenceId} className={cn(barButton, "bg-creator-accent text-creator-accent-fg")}>
            {t("privacyAllow")}
          </button>
        </div>
        {/* The sentence the settings show, read with the main choice: which companies load, and when. */}
        <p id={sentenceId} className="sr-only">
          {sentence}
        </p>
      </section>
    </>
  );
}
