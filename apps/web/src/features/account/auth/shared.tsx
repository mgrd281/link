"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

import { tokens } from "@linkyo/tokens";

import { useRouter } from "@/i18n/navigation";

import { accountStore, useAccount } from "../store";
import type { UsernameStatus } from "../types";
import { localUsernameStatus, normalizeUsername } from "../username";

const noop = () => () => undefined;
const MARK = tokens.size.iconMd;

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
 * "Continue with Google", in the calm filled style of the other fields, with Google's own mark (as
 * their guidelines ask). Google sign-in is switched on at launch; until then a tap says so and
 * points to the email field, instead of a disabled button that explains nothing.
 */
export function SocialButtons({ emailField }: { emailField: string }) {
  const t = useTranslations("auth");
  const [asked, setAsked] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-2">
      <button
        type="button"
        aria-describedby={asked ? "google-soon" : undefined}
        onClick={() => {
          setAsked(true);
          document.getElementById(emailField)?.focus();
        }}
        className="flex h-control-lg items-center justify-center gap-3 rounded-lg bg-canvas-muted px-4 text-body font-medium text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring active:scale-pressed"
      >
        <Image src="/brands/google.svg" alt="" width={MARK} height={MARK} unoptimized className="size-5" />
        {t("social.google")}
      </button>
      {asked ? (
        <p id="google-soon" role="status" className="text-center text-small text-fg-secondary">
          {t("social.soonNote")}
        </p>
      ) : null}
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
