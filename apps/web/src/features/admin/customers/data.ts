"use client";

import { useMemo, useSyncExternalStore } from "react";

import { deviceAccounts, STORAGE_KEY } from "@/features/account/local-store";
import { accountStore } from "@/features/account/store";
import type { LoginEvent } from "@/features/account/types";
import { useNow } from "@/features/directions/poster/live";
import { useReferralQueue } from "@/features/referrals/team";
import { supabaseEnabled } from "@/lib/supabase/config";

import { useLiveCustomers } from "../live";
import type { Role } from "../types";

import { figuresWithheld } from "./access";
import { withRewards, type Customer } from "./model";
import { useOverrides, type CustomerPatch } from "./overrides";
import { sampleCustomers } from "./sample";

/** The accounts created in this browser, read whenever they change. */
const readRaw = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

function useDeviceCustomers(): Customer[] {
  const raw = useSyncExternalStore(
    (listener) => accountStore.subscribe(listener),
    readRaw,
    () => "",
  );
  return useMemo(() => {
    if (!raw) return [];
    return deviceAccounts({ getItem: () => raw, setItem: () => undefined, removeItem: () => undefined }).map(
      ({ account, site, logins }) => {
        const latest = logins.find((login) => login.result === "success");
        return {
          id: account.id,
          source: "device" as const,
          name: site.page.profile.displayName,
          email: account.email,
          username: account.username,
          locale: site.page.profile.locale,
          country: latest?.country ?? "",
          city: latest?.city,
          createdAt: account.createdAt,
          lastSeenAt: latest?.at ?? site.updatedAt,
          status: "active" as const,
          verified: site.page.profile.verified,
          subscription: { plan: "free" as const, status: null, invoices: [] },
          usage: {
            kind: site.kind ?? "other",
            template: site.theme.template ?? "",
            blocks: site.page.blocks.length,
            onboarded: site.onboarded,
            views30: 0,
            clicks30: 0,
          },
          logins,
          notes: [],
        };
      },
    );
  }, [raw]);
}

function applyPatch(customer: Customer, patch: CustomerPatch | undefined): Customer {
  if (!patch) return customer;
  const subscription = { ...customer.subscription };
  if (patch.plan) subscription.plan = patch.plan;
  if (patch.subscriptionStatus !== undefined) subscription.status = patch.subscriptionStatus;
  if (patch.startedAt) subscription.startedAt = patch.startedAt;
  if (patch.trialEndsAt) subscription.trialEndsAt = patch.trialEndsAt;
  if (patch.canceledAt !== undefined) subscription.canceledAt = patch.canceledAt ?? undefined;
  if (patch.refunded?.length)
    subscription.invoices = subscription.invoices.map((invoice) =>
      patch.refunded?.includes(invoice.id) ? { ...invoice, status: "refunded" } : invoice,
    );
  return {
    ...customer,
    subscription,
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.verified !== undefined ? { verified: patch.verified } : {}),
  };
}

export interface Session {
  deviceId: string;
  device: LoginEvent["device"];
  ip: string;
  country?: string | undefined;
  city?: string | undefined;
  firstAt: string;
  lastAt: string;
  signIns: number;
  signedOut: boolean;
}

/** Devices a customer signed in with (newest first), from the sign-in log. */
export function sessionsOf(customer: Customer, signedOut: readonly string[] = []): Session[] {
  const byDevice = new Map<string, Session>();
  for (const login of [...customer.logins].reverse()) {
    if (login.result !== "success") continue;
    const known = byDevice.get(login.deviceId);
    byDevice.set(login.deviceId, {
      deviceId: login.deviceId,
      device: login.device,
      ip: login.ip,
      country: login.country,
      city: login.city,
      firstAt: known?.firstAt ?? login.at,
      lastAt: login.at,
      signIns: (known?.signIns ?? 0) + 1,
      signedOut: signedOut.includes(login.deviceId),
    });
  }
  return [...byDevice.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/**
 * Every customer the team can see: the accounts on this device first, then the sample customers,
 * with the team's changes applied and deleted ones left out.
 */
function useDemoCustomers() {
  const minute = useNow();
  // Seeded, so the same customers come back every minute; only their times move along with now.
  const sample = useMemo(() => (minute === null ? [] : sampleCustomers(minute)), [minute]);
  const device = useDeviceCustomers();
  const db = useOverrides();
  const { queue } = useReferralQueue();
  const customers = useMemo(
    () =>
      withRewards(
        [...device, ...sample]
          .filter((customer) => !db.patches[customer.id]?.deleted)
          .map((customer) => ({
            ...applyPatch(customer, db.patches[customer.id]),
            notes: db.notes[customer.id] ?? [],
          })),
        queue.rewards,
      ),
    [device, sample, db, queue.rewards],
  );
  return {
    ready: minute !== null,
    now: minute ?? 0,
    customers,
    blockedIps: db.blockedIps,
    signedOut: (id: string) => db.patches[id]?.signedOut ?? [],
    // The demo has every customer in this browser: nothing is withheld.
    withheld: (_role: Role) => false,
    // The sample customers carry made-up views and clicks (labelled as sample data on every screen).
    viewsMeasured: true,
    pageViews: null,
  };
}

/** Real accounts: the team-only database view; a device counts as signed out once none of its sessions is open. */
function useLiveCustomerData() {
  const live = useLiveCustomers();
  const { queue } = useReferralQueue();
  const customers = useMemo(() => withRewards(live.customers, queue.rewards), [live.customers, queue.rewards]);
  return {
    ...live,
    customers,
    /** Customer figures are not available for this role on this database (customers/access.ts). */
    withheld: (role: Role) => figuresWithheld(live.access, role),
    signedOut: (id: string) => {
      const customer = customers.find((candidate) => candidate.id === id);
      if (!customer) return [];
      const devices = new Set(customer.logins.filter((login) => login.result === "success").map((login) => login.deviceId));
      return [...devices].filter((device) => !customer.logins.some((login) => login.deviceId === device && login.active));
    },
  };
}

/**
 * Every customer the team can see (demo: this device's accounts and sample customers; real: the
 * database). `viewsMeasured` says whether views and clicks are numbers: always in the demo; on real
 * accounts only once the page statistics count (ADR 0081, live.ts), else the screens say "not
 * measured" instead of showing 0.
 */
export const useCustomers = supabaseEnabled ? useLiveCustomerData : useDemoCustomers;
