"use client";

import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { useEffect, useMemo, useState } from "react";

import type { AdminDb, Locale, PreparedDraft } from "./types";

/** A prepared page that is live on the server (from /api/admin/prepared; invites only as a count). */
export interface PublishedPage {
  slug: string;
  username: string;
  name: Partial<Record<Locale, string>>;
  theme: CreatorThemeConfig;
  pages: Partial<Record<Locale, Page>>;
  invites: number;
  verified: boolean;
  examples: boolean;
}

export type Published = { status: "loading" } | { status: "ready"; pages: PublishedPage[] } | { status: "error" };

export function usePublished(token: string | undefined): Published {
  const [state, setState] = useState<{ token: string | undefined; value: Published }>({ token, value: { status: "loading" } });
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/prepared", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as { pages: PublishedPage[] }) : Promise.reject(new Error(String(response.status)))))
      .then(
        (data) => alive && setState({ token, value: { status: "ready", pages: data.pages } }),
        () => alive && setState({ token, value: { status: "error" } }),
      );
    return () => {
      alive = false;
    };
  }, [token]);
  return state.token === token ? state.value : { status: "loading" };
}

/** One row per creator: a local draft, a published page, or both (a draft that updates a published page). */
export interface CreatorRow {
  slug: string;
  name: Partial<Record<Locale, string>>;
  username: string;
  page: Page | undefined;
  draft: PreparedDraft | undefined;
  published: PublishedPage | undefined;
  status: "draft" | "ready" | "published";
  verified: boolean;
  invites: number;
  updatedAt: string | undefined;
}

export function useCreatorRows(db: AdminDb, published: Published): CreatorRow[] {
  return useMemo(() => {
    const live = published.status === "ready" ? published.pages : [];
    const slugs = [...new Set([...Object.keys(db.drafts), ...live.map((page) => page.slug)])];
    return slugs
      .map((slug): CreatorRow => {
        const draft = db.drafts[slug];
        const server = live.find((page) => page.slug === slug);
        const source = draft ?? server;
        const pages = source?.pages ?? {};
        return {
          slug,
          name: source?.name ?? {},
          username: source?.username ?? slug,
          page: Object.values(pages)[0],
          draft,
          published: server,
          status: draft ? draft.status : "published",
          verified: draft ? draft.verified : (server?.verified ?? false),
          invites: draft ? draft.invites.length + (draft.publishedInvites ?? 0) : (server?.invites ?? 0),
          updatedAt: draft?.updatedAt,
        };
      })
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.slug.localeCompare(b.slug));
  }, [db.drafts, published]);
}
