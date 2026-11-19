"use client";

import { Badge, PlatformIcon } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { siGoogle } from "simple-icons";

import { useRouter } from "@/i18n/navigation";

import { accountStore, useAccount } from "../store";
import type { UsernameStatus } from "../types";
import { localUsernameStatus, normalizeUsername } from "../username";

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
 * Google sign-in arrives with real accounts (Supabase Auth). Until then the button is shown,
 * clearly marked, so the final layout can be judged; it does nothing. (Apple follows with the app.)
 */
export function SocialButtons() {
  const t = useTranslations("auth");
  return (
    <div className="grid grid-cols-1 gap-2">
      {[{ key: "google", icon: siGoogle }].map((provider) => (
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

/**
 * Live check of a username while it is typed: format and reserved names at once, "taken" a moment
 * later (real accounts ask the server). `checking` until the answer for this exact name is in.
 */
export function useUsernameStatus(input: string, current?: string): UsernameStatus | "checking" | null {
  const name = normalizeUsername(input);
  const skip = !name || name === current;
  const local = skip ? null : localUsernameStatus(name);
  const [answer, setAnswer] = useState<{ name: string; status: UsernameStatus } | null>(null);
  useEffect(() => {
    if (local !== "ok") return;
    let live = true;
    const timer = window.setTimeout(
      () => {
        void accountStore.usernameStatus(name).then((status) => {
          if (live) setAnswer({ name, status });
        });
      },
      accountStore.demo ? 0 : 250,
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [name, local]);
  if (skip) return null;
  if (local !== "ok") return local;
  return answer?.name === name ? answer.status : "checking";
}
