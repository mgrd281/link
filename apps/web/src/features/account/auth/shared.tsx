"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { INTENT_RETURN } from "@/features/app/install/intents";
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

/**
 * Only in-app destinations are allowed after log-in (no open redirects). Home may carry the Add sheet
 * a shortcut or a share asked for (`INTENT_RETURN`: `/app?add=1`, `/app?shared=<encoded link>`).
 */
export const safeNext = (value: string): string | null =>
  /^\/(?:app|admin)(?:\/[\w/-]*)?$/.test(value) || /^\/checkout\/(?:pro|service\?package=(?:start|premium))$/.test(value) || INTENT_RETURN.test(value) ? value : null;

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
