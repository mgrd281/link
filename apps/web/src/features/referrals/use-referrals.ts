"use client";

import { useCallback, useEffect, useState } from "react";

import { accountStore } from "@/features/account/store";

import type { ReferralOverview } from "./types";

export interface ReferralsState {
  /** "loading" only until the first answer; a reload keeps the data on screen until the next one. */
  status: "loading" | "ready" | "error";
  /** Null when signed out (or before the first answer). */
  data: ReferralOverview | null;
  /** Loads again, e.g. after a verification request. */
  reload(): void;
}

/**
 * The signed-in creator's invite program. It loads on mount and again whenever the account changes
 * (another sign-in, a change in another tab), and on `reload()`. With `enabled` false it loads
 * nothing and stays "loading" (a caller that needs it only on one screen, like the sidebar panel).
 */
export function useReferrals(enabled = true): ReferralsState {
  const [state, setState] = useState<Pick<ReferralsState, "status" | "data">>({ status: "loading", data: null });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => (enabled ? accountStore.subscribe(reload) : undefined), [enabled, reload]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    accountStore.referrals().then(
      (data) => {
        if (live) setState({ status: "ready", data });
      },
      () => {
        if (live) setState((current) => ({ status: "error", data: current.data }));
      },
    );
    return () => {
      live = false;
    };
  }, [enabled, version]);

  return { ...state, reload };
}
