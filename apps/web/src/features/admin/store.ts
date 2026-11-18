"use client";

import { NO_IMAGE, type Page } from "@linkyo/blocks";
import { useSyncExternalStore } from "react";

import type { ActivityEvent, AdminDb, Locale, Member, PreparedDraft, Role } from "./types";

/**
 * Team-area data in demo mode: kept in this browser (like demo accounts), behind the same shape a
 * Supabase-backed store will have (members, prepared_pages, activity with row-level security).
 */
const KEY = "linkyo.admin.v1";
const EMPTY: AdminDb = { version: 1, members: [], drafts: {}, activity: [] };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: AdminDb = EMPTY;

const read = (): string | null => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

function snapshot(): AdminDb {
  const raw = read();
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const data = raw ? (JSON.parse(raw) as Partial<AdminDb>) : null;
    cached = data?.version === 1 ? { ...EMPTY, ...data } : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(update: (db: AdminDb) => AdminDb): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(update(snapshot())));
  } catch {
    return false;
  }
  for (const listener of listeners) listener();
  return true;
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

export function useAdminDb(): AdminDb | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

const now = () => new Date().toISOString();
const EDIT_WINDOW = 15 * 60 * 1000;
const log = (db: AdminDb, actor: string, action: ActivityEvent["action"], target: string): AdminDb => {
  // Autosave writes often: one "edited" entry per person and page every 15 minutes is enough.
  const last = db.activity[0];
  if (action === "page.edit" && last?.action === action && last.actor === actor && last.target === target && Date.now() - Date.parse(last.at) < EDIT_WINDOW) return db;
  return { ...db, activity: [{ id: crypto.randomUUID(), at: now(), actor, action, target }, ...db.activity].slice(0, 500) };
};

/** A blank prepared page: the creator's name, a monogram until a photo is added, the address reserved. */
export function blankPreparedPage(name: string, username: string, locale: Locale): Page {
  return { profile: { username, displayName: name, bio: "", avatar: { src: NO_IMAGE, alt: "" }, verified: false, locale }, blocks: [] };
}

export const adminStore = {
  /** The latest saved version of a draft (after an editor flush, fresher than a rendered prop). */
  draft(slug: string): PreparedDraft | undefined {
    return snapshot().drafts[slug];
  },
  setupOwner(member: { email: string; name: string }, token: string) {
    return write((db) => log({ ...db, token, members: [{ ...member, role: "owner", addedAt: now() }] }, member.email, "team.setup", member.email));
  },
  addMember(actor: string, member: Omit<Member, "addedAt">) {
    return write((db) =>
      db.members.some((existing) => existing.email === member.email) ? db : log({ ...db, members: [...db.members, { ...member, addedAt: now() }] }, actor, "member.add", member.email),
    );
  },
  setRole(actor: string, email: string, role: Role) {
    return write((db) => log({ ...db, members: db.members.map((member) => (member.email === email ? { ...member, role } : member)) }, actor, "member.role", email));
  },
  removeMember(actor: string, email: string) {
    return write((db) => log({ ...db, members: db.members.filter((member) => member.email !== email) }, actor, "member.remove", email));
  },
  createDraft(actor: string, draft: Omit<PreparedDraft, "updatedAt" | "createdBy">, action: "page.create" | "page.copy" = "page.create") {
    return write((db) => log({ ...db, drafts: { ...db.drafts, [draft.slug]: { ...draft, createdBy: actor, updatedAt: now() } } }, actor, action, draft.slug));
  },
  updateDraft(actor: string, slug: string, update: (draft: PreparedDraft) => PreparedDraft, action?: ActivityEvent["action"]) {
    return write((db) => {
      const draft = db.drafts[slug];
      if (!draft) return db;
      const next = { ...db, drafts: { ...db.drafts, [slug]: { ...update(draft), updatedAt: now() } } };
      return action ? log(next, actor, action, slug) : next;
    });
  },
  deleteDraft(actor: string, slug: string) {
    return write((db) => log({ ...db, drafts: Object.fromEntries(Object.entries(db.drafts).filter(([key]) => key !== slug)) }, actor, "page.delete", slug));
  },
  record(actor: string, action: ActivityEvent["action"], target: string) {
    return write((db) => log(db, actor, action, target));
  },
};

/** SHA-256 in the browser: invites leave the team area only as hashes. */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim().toLowerCase()));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The file `scripts/prepare-page.mjs --add` publishes (same shape as the server's prepared pages). */
export async function exportPrepared(draft: PreparedDraft) {
  const pages = Object.fromEntries(
    Object.entries(draft.pages).map(([locale, page]) => [locale, { ...page, profile: { ...page.profile, username: draft.username, verified: draft.verified } }]),
  );
  return {
    slug: draft.slug,
    name: draft.name,
    username: draft.username,
    theme: draft.theme,
    pages,
    verified: draft.verified,
    invite: { emailSha256: await Promise.all(draft.invites.map(sha256)) },
  };
}
