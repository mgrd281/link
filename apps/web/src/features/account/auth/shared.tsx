"use client";

import { Badge, PlatformIcon } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { siApple, siGoogle } from "simple-icons";

import { useRouter } from "@/i18n/navigation";

import { useAccount } from "../store";

const noop = () => () => undefined;

/** A query parameter, read without an effect (empty during server render). */
export function useSearchParam(name: string): string {
  return useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get(name) ?? "",
    () => "",
  );
}

/** Only in-app destinations are allowed after log-in (no open redirects). */
export const safeNext = (value: string): string | null => (/^\/(?:app|admin)(?:\/[\w/-]*)?$/.test(value) ? value : null);

/**
 * Auth pages are for signed-out people. As soon as there is a session (after sign-up, log-in, or
 * when someone opens /login while signed in) this sends them on: new accounts to the welcome flow,
 * everyone else to where they wanted to go or the dashboard.
 */
export function useLeaveWhenSignedIn() {
  const snapshot = useAccount();
  const router = useRouter();
  const next = useSearchParam("next");
  useEffect(() => {
    if (snapshot.status !== "signedIn") return;
    router.replace(snapshot.site.onboarded ? (safeNext(next) ?? "/app") : "/app/welcome");
  }, [snapshot, router, next]);
  return snapshot.status === "signedIn";
}

/**
 * Google and Apple sign-in arrive with real accounts (Supabase Auth). Until then the buttons are
 * shown, clearly marked, so the final layout can be judged; they do nothing.
 */
export function SocialButtons() {
  const t = useTranslations("auth");
  return (
    <div className="grid grid-cols-1 gap-2">
      {[
        { key: "google", icon: siGoogle },
        { key: "apple", icon: siApple },
      ].map((provider) => (
        <button
          key={provider.key}
          type="button"
          disabled
          className="flex h-control-lg items-center gap-3 rounded-md border border-line-strong bg-surface px-4 text-body font-medium text-fg disabled:cursor-not-allowed"
        >
          <PlatformIcon icon={provider.icon} size="md" />
          <span className="flex-1 text-start">{t(`social.${provider.key}`)}</span>
          <Badge size="sm">{t("social.soon")}</Badge>
        </button>
      ))}
    </div>
  );
}
