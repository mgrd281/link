"use client";

import { cn, Icon } from "@linkyo/ui";
import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Privacy notice on creator pages. The pages set no cookies and track nothing; the only thing that
 * talks to another company is an embedded player (YouTube, TikTok …), and those load on tap. The
 * notice says so and lets visitors allow external content once for all pages. It appears only on
 * pages that have such players, and it wears the creator's own colors (it is part of their page).
 *
 * The choice is kept in localStorage: storing a consent decision is strictly necessary (TTDSG § 25 (2)).
 */
type Choice = "media" | "essential";
const KEY = "linkyo.privacy.v1";
const OPEN_EVENT = "linkyo:privacy-open";
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
          "size-6 rounded-full shadow-e1 transition-transform duration-micro ease-standard",
          checked ? "translate-x-5 bg-creator-accent-fg rtl:-translate-x-5" : "bg-creator-surface",
        )}
      />
    </button>
  );
}

const sheetButton = "min-h-control-lg w-full rounded-creator-button px-4 py-2 text-body font-semibold leading-tight text-balance transition-[scale,background-color] duration-micro focus-visible:focus-ring active:scale-pressed";

/**
 * A sheet across the bottom of the page in the creator's own colors: their background and text, the
 * title in their accent, the main button filled with it. Two clear choices, and settings for those who
 * want to decide per category. Honest copy: there are no tracking cookies here.
 */
export function PrivacyNotice({ providers }: { providers: string[] }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const choice = usePrivacyChoice();
  const [reopened, setReopened] = useState(false);
  const [details, setDetails] = useState(false);
  const [media, setMedia] = useState(false);

  useEffect(() => {
    const open = () => {
      setReopened(true);
      setDetails(false);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  if (choice === undefined || (choice !== null && !reopened)) return null;
  const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(providers);
  const decide = (next: Choice) => {
    save(next);
    setReopened(false);
    setDetails(false);
  };
  const openDetails = () => {
    setMedia(choice === "media");
    setDetails(true);
  };

  return (
    <section
      aria-label={t("privacyLabel")}
      className="layer-overlay fixed inset-x-0 bottom-0 border-t border-creator-line bg-creator-bg text-creator-fg shadow-e3 motion-safe:animate-rise-in"
    >
      <div className="mx-auto grid max-w-creator gap-4 px-5 pt-5 pb-[max(var(--spacing-5),env(safe-area-inset-bottom))]">
        <div className="grid gap-2">
          <h2 className="flex items-center gap-2 text-h3 font-semibold text-creator-accent-text">
            <Icon icon={ShieldCheck} size="md" />
            {details ? t("privacySettings") : t("privacyTitle")}
          </h2>
          {details ? null : <p className="text-body text-creator-fg-muted">{t("privacyBody", { providers: list })}</p>}
        </div>

        {details ? (
          <ul className="grid gap-2">
            <li className="flex items-start gap-3 rounded-creator-card bg-creator-surface p-3">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-body font-semibold">{t("privacyNecessary")}</span>
                <span className="text-small text-creator-fg-muted">{t("privacyNecessaryBody")}</span>
              </span>
              <span className="shrink-0 pt-0.5 text-small font-medium text-creator-fg-muted">{t("privacyAlwaysOn")}</span>
            </li>
            <li className="flex items-start gap-3 rounded-creator-card bg-creator-surface p-3">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-body font-semibold">{t("privacyMedia")}</span>
                <span className="text-small text-creator-fg-muted">{t("privacyMediaBody", { providers: list })}</span>
              </span>
              <ThemedSwitch checked={media} onChange={setMedia} label={t("privacyMedia")} />
            </li>
          </ul>
        ) : null}

        <div className="grid gap-2">
          {details ? (
            <button type="button" onClick={() => decide(media ? "media" : "essential")} className={cn(sheetButton, "bg-creator-accent text-creator-accent-fg")}>
              {t("privacySave")}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => decide("media")} className={cn(sheetButton, "bg-creator-accent text-creator-accent-fg")}>
                {t("privacyAllow")}
              </button>
              <button type="button" onClick={() => decide("essential")} className={cn(sheetButton, "border border-creator-accent-text text-creator-accent-text hover:bg-creator-surface")}>
                {t("privacyEssential")}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={details ? () => setDetails(false) : openDetails}
            className="justify-self-center rounded-xs px-2 py-2 text-small text-creator-fg-muted underline underline-offset-4 hover:text-creator-fg focus-visible:focus-ring"
          >
            {details ? t("privacyBack") : t("privacyManage")}
          </button>
        </div>
      </div>
    </section>
  );
}
