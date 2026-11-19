"use client";

import { hasImage, profileSchema, RESERVED_USERNAMES } from "@linkyo/blocks";
import { Avatar, Badge, Button, Icon, Segmented, Skeleton, TextField } from "@linkyo/ui";
import { BadgeCheck, ChevronRight, Mail, Plus, Search, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";
import { z } from "zod";

import { SelectField } from "@/features/app/form";
import { Screen } from "@/features/app/screen";
import { Sheet } from "@/features/app/sheet";
import { useNow } from "@/features/directions/poster/live";
import { resolveMedia } from "@/features/directions/shared/media";
import { Link, useRouter } from "@/i18n/navigation";

import { useCreatorRows, usePublished, type CreatorRow } from "./data";
import { timeAgo } from "./format";
import { useAdmin } from "./session";
import { adminStore, blankPreparedPage } from "./store";
import { LOCALES, nameIn, type Locale } from "./types";

type Filter = "all" | "draft" | "ready" | "published";

export function StatusBadge({ status }: { status: CreatorRow["status"] }) {
  const t = useTranslations("admin.status");
  return (
    <Badge size="sm" tone={status === "published" ? "success" : status === "ready" ? "primary" : "neutral"} dot>
      {t(status)}
    </Badge>
  );
}

function CreatorAvatar({ row }: { row: CreatorRow }) {
  const locale = useLocale();
  const avatar = row.page?.profile.avatar;
  const src = hasImage(avatar) ? resolveMedia(avatar.src) : undefined;
  return <Avatar name={nameIn(row.name, locale) || row.username} src={typeof src === "string" ? src : src?.src} size="md" />;
}

function Row({ row, now }: { row: CreatorRow; now: number | null }) {
  const t = useTranslations("admin.creators");
  const locale = useLocale();
  const name = nameIn(row.name, locale) || row.username;
  return (
    <li>
      <Link
        href={`/admin/creators/${row.slug}`}
        className="group flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-colors duration-micro hover:border-line-input focus-visible:focus-ring"
      >
        <CreatorAvatar row={row} />
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-body font-semibold">{name}</span>
            {row.verified ? <Icon icon={BadgeCheck} size="sm" label={t("verified")} className="shrink-0 text-link" /> : null}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-small text-fg-secondary">
            <span dir="ltr" className="truncate">
              linkyo.app/{row.username}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon icon={Mail} size="sm" />
              {t("invites", { count: row.invites })}
            </span>
            {row.updatedAt && now !== null ? <span>{timeAgo(row.updatedAt, now, locale)}</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={row.status} />
          {row.draft && row.published ? (
            <Badge size="sm" tone="outline">
              {t("live")}
            </Badge>
          ) : null}
        </span>
        <Icon icon={ChevronRight} size="md" className="shrink-0 text-fg-tertiary rtl:-scale-x-100" />
      </Link>
    </li>
  );
}

/**
 * Every prepared page in one list: drafts in progress, pages ready for publishing, and pages already
 * live for a creator to claim. Search and filter keep it quick with many creators.
 */
export function CreatorsScreen() {
  const t = useTranslations("admin.creators");
  const tStatus = useTranslations("admin.status");
  const locale = useLocale();
  const { db, can } = useAdmin();
  const published = usePublished(db.token);
  const rows = useCreatorRows(db, published);
  const now = useNow();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

  const needle = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (filter === "all" || row.status === filter) &&
      (!needle || [row.slug, row.username, ...Object.values(row.name)].some((text) => text.toLowerCase().includes(needle))),
  );
  const counts = (status: Filter) => (status === "all" ? rows.length : rows.filter((row) => row.status === status).length);

  return (
    <Screen
      title={t("title")}
      lead={t("lead")}
      wide
      actions={
        can("pages.create") ? (
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            {t("new")}
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <TextField id="creators-search" label={t("search")} icon={Search} value={query} onChange={(event) => setQuery(event.target.value)} type="search" autoComplete="off" />
        <Segmented
          label={t("filter")}
          value={filter}
          onValueChange={setFilter}
          className="overflow-x-auto"
          options={(["all", "draft", "ready", "published"] as const).map((value) => ({
            value,
            label: `${value === "all" ? t("all") : tStatus(value)} · ${counts(value)}`,
          }))}
        />
      </div>

      {published.status === "error" ? <p className="rounded-md bg-warning-subtle px-3 py-2 text-small text-warning-strong">{t("publishedError")}</p> : null}

      {published.status === "loading" && rows.length === 0 ? (
        <div className="grid grid-cols-1 gap-2" aria-busy>
          <Skeleton className="h-control-xl rounded-lg" />
          <Skeleton className="h-control-xl rounded-lg" />
        </div>
      ) : visible.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-line-strong p-8 text-center">
          <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
            <Icon icon={Sparkles} size="lg" />
          </span>
          <div className="grid grid-cols-1 gap-1">
            <p className="text-body-lg font-semibold">{rows.length === 0 ? t("emptyTitle") : t("noMatch")}</p>
            {rows.length === 0 ? <p className="max-w-prose text-small text-fg-secondary">{t("emptyBody")}</p> : null}
          </div>
          {rows.length === 0 && can("pages.create") ? (
            <Button variant="primary" size="lg" icon={Plus} onClick={() => setCreating(true)}>
              {t("new")}
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2" aria-label={t("listLabel")}>
          {visible.map((row) => (
            <Row key={row.slug} row={row} now={now} />
          ))}
        </ul>
      )}

      <NewPageSheet open={creating} onOpenChange={setCreating} taken={rows} defaultLocale={LOCALES.find((code) => code === locale) ?? "de"} />
    </Screen>
  );
}

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/;
const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);

/** Name, address, language and (optionally) the creator's email: everything else happens in the editor. */
function NewPageSheet({ open, onOpenChange, taken, defaultLocale }: { open: boolean; onOpenChange: (open: boolean) => void; taken: CreatorRow[]; defaultLocale: Locale }) {
  const t = useTranslations("admin.creators.create");
  const tLocales = useTranslations("admin.locales");
  const { me } = useAdmin();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);

  const address = slug ?? username;
  const usernameError = !profileSchema.shape.username.safeParse(username).success
    ? "invalid"
    : RESERVED_USERNAMES.has(username)
      ? "reserved"
      : taken.some((row) => row.username === username)
        ? "taken"
        : null;
  const slugError = !slugPattern.test(address) ? "invalid" : taken.some((row) => row.slug === address) ? "taken" : null;
  const emailError = email.trim() && !z.email().safeParse(email.trim()).success ? "invalid" : null;
  const nameError = name.trim() ? null : "missing";

  const reset = () => {
    setName("");
    setUsername("");
    setSlug(null);
    setEmail("");
    setTried(false);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTried(true);
    const first = nameError ? "new-name" : usernameError ? "new-username" : slugError ? "new-slug" : emailError ? "new-email" : null;
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    const displayName = name.trim();
    adminStore.createDraft(me.email, {
      slug: address,
      name: { [locale]: displayName },
      username,
      pages: { [locale]: blankPreparedPage(displayName, username, locale) },
      theme: { template: "nocturne" },
      invites: email.trim() ? [email.trim().toLowerCase()] : [],
      verified: false,
      status: "draft",
    });
    onOpenChange(false);
    reset();
    router.push(`/admin/creators/${address}`);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title={t("title")}
      description={t("lead")}
      closeLabel={t("close")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="primary" type="submit" form="new-page-form">
            {t("submit")}
          </Button>
        </>
      }
    >
      <form id="new-page-form" noValidate onSubmit={submit} className="grid grid-cols-1 gap-5">
        <TextField id="new-name" label={t("name")} value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required error={tried && nameError ? t("nameMissing") : undefined} />
        <TextField
          id="new-username"
          label={t("username")}
          ltr
          leading="linkyo.app/"
          value={username}
          onChange={(event) => setUsername(clean(event.target.value).slice(0, 30))}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          required
          hint={t("usernameHint")}
          error={(tried || username.length >= 3) && usernameError ? t(`usernameErrors.${usernameError}`) : undefined}
        />
        <TextField
          id="new-slug"
          label={t("slug")}
          ltr
          leading="/p/"
          value={address}
          onChange={(event) => setSlug(clean(event.target.value))}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          hint={t("slugHint")}
          error={tried && slugError ? t(`slugErrors.${slugError}`) : undefined}
        />
        <SelectField label={t("locale")} value={locale} onValue={setLocale} options={LOCALES.map((value) => ({ value, label: tLocales(value) }))} />
        <TextField
          id="new-email"
          label={t("email")}
          type="email"
          ltr
          icon={Mail}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
          inputMode="email"
          hint={t("emailHint")}
          error={tried && emailError ? t("emailInvalid") : undefined}
        />
      </form>
    </Sheet>
  );
}
