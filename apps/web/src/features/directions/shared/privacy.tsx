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

export function PrivacyNotice({ providers, raised = false }: { providers: string[]; raised?: boolean }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const choice = usePrivacyChoice();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  if (choice === undefined || (choice !== null && !reopened)) return null;
  const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(providers);
  const decide = (next: Choice) => {
    save(next);
    setReopened(false);
  };

  return (
    <section
      aria-label={t("privacyLabel")}
      className={cn(
        "layer-sticky fixed inset-x-0 mx-auto w-full max-w-creator px-3 motion-safe:animate-rise-in",
        raised ? "bottom-20" : "bottom-0 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))]",
      )}
    >
      <div className="grid gap-3 rounded-creator-card border border-creator-line bg-creator-surface p-4 text-creator-fg shadow-e3">
        <div className="flex items-start gap-3">
          <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-creator-surface-2 text-creator-accent-text">
            <Icon icon={ShieldCheck} size="md" />
          </span>
          <div className="grid min-w-0 gap-1">
            <h2 className="text-body font-semibold">{t("privacyTitle")}</h2>
            <p className="text-small text-creator-fg-muted">{t("privacyBody", { providers: list })}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => decide("essential")}
            className="min-h-control-md rounded-creator-button py-2 leading-tight text-balance border border-creator-line-strong px-3 text-small font-semibold text-creator-fg transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring active:scale-pressed"
          >
            {t("privacyEssential")}
          </button>
          <button
            type="button"
            onClick={() => decide("media")}
            className="min-h-control-md rounded-creator-button py-2 leading-tight text-balance bg-creator-accent px-3 text-small font-semibold text-creator-accent-fg transition-[scale] duration-micro focus-visible:focus-ring active:scale-pressed"
          >
            {t("privacyAllow")}
          </button>
        </div>
      </div>
    </section>
  );
}
