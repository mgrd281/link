"use client";

import { profileSchema, RESERVED_USERNAMES, type Page } from "@linkyo/blocks";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { Badge, Button, cn, ConfirmDialog, Icon, IconButton, Segmented, Skeleton, TextField, toast } from "@linkyo/ui";
import { ArrowLeft, BadgeCheck, Copy, Download, Languages, Mail, Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState, type ReactNode, type SubmitEvent } from "react";
import { z } from "zod";

import type { Account, Result, Site } from "@/features/account/types";
import { AddSheet } from "@/features/app/add-sheet";
import { DesignScreen } from "@/features/app/design-screen";
import { EditSheet } from "@/features/app/edit-sheet";
import { EditorScreen } from "@/features/app/editor-screen";
import { SelectField, SwitchRow } from "@/features/app/form";
import { PhonePreview } from "@/features/app/preview";
import { Panel, Screen } from "@/features/app/screen";
import { EditorProvider, useSite, type SiteDoc } from "@/features/app/site-context";
import { PosterRenderer } from "@/features/directions/poster/renderer";
import { Link, useRouter } from "@/i18n/navigation";
import { copyText } from "@/lib/clipboard";
import { CREATOR_DOMAIN, pageAddress } from "@/lib/page-url";
import { touchSegmented } from "@/lib/touch";

import { StatusBadge } from "./creators-screen";
import { bdi, isolate } from "./bidi";
import { usePublished, type PublishedPage } from "./data";
import { useOrigin } from "./format";
import { useAdmin } from "./session";
import { adminStore, exportPrepared } from "./store";
import { LOCALES, nameIn, type Locale, type PreparedDraft } from "./types";

const EMPTY_LEGAL = { name: "", address: "", email: "", phone: "" };

/** The prepared page in a phone frame, without an editor (published pages, read-only roles). */
export function StaticPhone({ page, theme, className }: { page: Page; theme: CreatorThemeConfig; className?: string }) {
  const resolved = useMemo(() => resolveCreatorTheme(theme, { rtlScript: page.profile.locale === "ar" }), [theme, page.profile.locale]);
  return (
    <div className={cn("relative mx-auto w-full max-w-preview overflow-hidden rounded-xl border border-line-strong bg-ink p-1", className)}>
      <div className="relative size-full overflow-hidden rounded-lg" style={{ transform: "translateZ(0)" }}>
        <div className="absolute inset-0 overflow-y-auto overscroll-contain" tabIndex={0} role="region" aria-label={page.profile.displayName}>
          <PosterRenderer page={page} theme={resolved} preview />
        </div>
      </div>
    </div>
  );
}

const pickLocale = (pages: Partial<Record<Locale, Page>>, preferred: string): Locale =>
  LOCALES.find((code) => code === preferred && pages[code]) ?? LOCALES.find((code) => pages[code]) ?? "de";

/**
 * One creator's prepared page. Drafts open in the same editor creators use (page, design), plus the
 * team's own controls: invites, verification, languages, status, publishing. Pages that are already
 * live can be looked at and copied into a draft to change them.
 */
export function CreatorScreen({ slug }: { slug: string }) {
  const t = useTranslations("admin.creator");
  const { db } = useAdmin();
  const published = usePublished(db.token);
  const draft = db.drafts[slug];
  const server = published.status === "ready" ? published.pages.find((page) => page.slug === slug) : undefined;

  if (draft) return <DraftEditor key={slug} draft={draft} server={server} />;
  if (server) return <PublishedView page={server} />;
  if (published.status === "loading") {
    return (
      <div className="mx-auto grid max-w-content grid-cols-1 gap-4 px-4 pt-10 md:px-8" aria-busy>
        <Skeleton className="h-control-xl w-1/2 rounded-md" />
        <Skeleton className="h-control-xl rounded-lg" />
      </div>
    );
  }
  return (
    <Screen title={t("notFoundTitle")} lead={t("notFoundLead")}>
      <BackLink />
    </Screen>
  );
}

function BackLink() {
  const t = useTranslations("admin.creator");
  return (
    <Link href="/admin/creators" className="inline-flex min-h-touch-target items-center gap-2 justify-self-start rounded-sm text-small font-semibold text-link focus-visible:focus-ring hover:text-fg transition-colors duration-micro">
      <Icon icon={ArrowLeft} size="sm" />
      {t("back")}
    </Link>
  );
}

/** Copyable link with a label, for the links the team sends to a creator. */
function LinkRow({ label, href, note }: { label: string; href: string; note?: string | undefined }) {
  const t = useTranslations("admin.creator");
  return (
    <div className="grid grid-cols-1 gap-1">
      <p className="text-small font-medium">{label}</p>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-canvas-muted ps-3 pe-1">
        <span dir="ltr" className="min-w-0 flex-1 truncate py-2 text-start text-small text-fg-secondary">
          {href}
        </span>
        <IconButton
          icon={Copy}
          size="sm"
          label={t("copy", { label })}
          onClick={() => void copyText(href).then((ok) => toast({ title: ok ? t("copied") : t("copyFailed"), tone: ok ? "success" : "danger" }))}
        />
      </div>
      {note ? <p className="text-caption text-fg-tertiary">{note}</p> : null}
    </div>
  );
}

function CreatorLinks({ slug, username, locales, live }: { slug: string; username: string; locales: Locale[]; live: boolean }) {
  const t = useTranslations("admin.creator.links");
  const tLocales = useTranslations("admin.locales");
  const origin = useOrigin();
  return (
    <Panel title={t("title")} id="links-title">
      {locales.map((locale) => (
        <div key={locale} className="grid grid-cols-1 gap-3">
          {locales.length > 1 ? <p className="text-caption font-semibold tracking-wide text-fg-tertiary uppercase">{tLocales(locale)}</p> : null}
          <LinkRow label={t("preview")} href={`${origin}/${locale}/p/${slug}`} />
          <LinkRow label={t("invite")} href={`${origin}/${locale}/signup?name=${username}&invite=${slug}`} />
        </div>
      ))}
      <p className={cn("rounded-md px-3 py-2 text-small", live ? "bg-success-subtle text-success-strong" : "bg-canvas-muted text-fg-secondary")}>{live ? t("live") : t("notLive")}</p>
    </Panel>
  );
}

/** A page that is live on the server: look at it, share its links, or copy it into a draft to change it. */
function PublishedView({ page }: { page: PublishedPage }) {
  const t = useTranslations("admin.creator");
  const tLocales = useTranslations("admin.locales");
  const uiLocale = useLocale();
  const { me, can } = useAdmin();
  const locales = LOCALES.filter((code) => page.pages[code]);
  const [locale, setLocale] = useState(pickLocale(page.pages, uiLocale));
  const shown = page.pages[locale];

  const copy = () => {
    adminStore.createDraft(
      me.email,
      { slug: page.slug, name: page.name, username: page.username, pages: page.pages, theme: page.theme, invites: [], publishedInvites: page.invites, verified: page.verified, status: "draft" },
      "page.copy",
    );
    toast({ title: t("copiedToDraft"), tone: "success" });
  };

  return (
    <Screen
      title={nameIn(page.name, uiLocale) || page.username}
      lead={t("publishedLead")}
      wide
      actions={
        can("pages.edit") ? (
          <Button variant="primary" icon={Pencil} onClick={copy}>
            {t("editCopy")}
          </Button>
        ) : null
      }
    >
      <BackLink />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="grid min-w-0 grid-cols-1 content-start gap-4">
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="published" />
              {page.verified ? (
                <Badge size="sm" tone="primary">
                  <Icon icon={BadgeCheck} size="sm" />
                  {t("verified")}
                </Badge>
              ) : null}
              <Badge size="sm">
                <Icon icon={Mail} size="sm" />
                {t("invitesCount", { count: page.invites })}
              </Badge>
              {page.examples ? <Badge size="sm" tone="warning">{t("examples")}</Badge> : null}
            </div>
            <p className="text-small text-fg-secondary">{t("publishedBody")}</p>
          </Panel>
          <CreatorLinks slug={page.slug} username={page.username} locales={locales} live />
        </div>
        <div className="grid grid-cols-1 content-start gap-3">
          {locales.length > 1 ? <Segmented label={t("language")} value={locale} onValueChange={setLocale} options={locales.map((value) => ({ value, label: tLocales(value) }))} className={touchSegmented} /> : null}
          {shown ? <StaticPhone page={shown} theme={page.theme} className="aspect-short" /> : null}
        </div>
      </div>
    </Screen>
  );
}

type Tab = "page" | "design" | "settings";

function DraftEditor({ draft, server }: { draft: PreparedDraft; server: PublishedPage | undefined }) {
  const t = useTranslations("admin.creator");
  const tLocales = useTranslations("admin.locales");
  const uiLocale = useLocale();
  const { me, can } = useAdmin();
  const editable = can("pages.edit");
  const [chosenTab, setTab] = useState<Tab>(editable ? "page" : "settings");
  // Viewing as a role without editing (owners can switch any time): Design falls back to the preview.
  const tab: Tab = !editable && chosenTab === "design" ? "page" : chosenTab;
  const [chosen, setChosen] = useState<Locale>(pickLocale(draft.pages, uiLocale));
  const locale = draft.pages[chosen] ? chosen : pickLocale(draft.pages, uiLocale);
  const locales = LOCALES.filter((code) => draft.pages[code]);
  const page = draft.pages[locale];
  const name = nameIn(draft.name, locale) || draft.username;
  const slug = draft.slug;

  const write = useCallback(
    (doc: SiteDoc): Result =>
      adminStore.updateDraft(
        me.email,
        slug,
        (current) => ({
          ...current,
          theme: doc.theme,
          pages: { ...current.pages, [locale]: { profile: { ...doc.profile, username: current.username, verified: current.verified }, blocks: doc.blocks } },
        }),
        "page.edit",
      )
        ? { ok: true }
        : { ok: false, error: "storageFull" },
    [me.email, slug, locale],
  );

  if (!page) return null;
  // The editor works on a stand-in account: the prepared page's address, no login behind it.
  const account: Account = { id: `prepared:${slug}`, email: draft.invites[0] ?? "", username: draft.username, createdAt: draft.updatedAt };
  const site: Site = { page: { ...page, profile: { ...page.profile, verified: draft.verified } }, theme: draft.theme, legal: EMPTY_LEGAL, onboarded: true, updatedAt: draft.updatedAt };
  const tabs: { value: Tab; label: string }[] = [
    ...(editable
      ? [
          { value: "page" as const, label: t("tabs.page") },
          { value: "design" as const, label: t("tabs.design") },
        ]
      : [{ value: "page" as const, label: t("tabs.preview") }]),
    { value: "settings", label: t("tabs.settings") },
  ];

  return (
    <EditorProvider key={`${slug}:${locale}`} account={account} site={site} write={write} previewHref={`/admin/preview/${slug}?lang=${locale}`}>
      <div className="layer-sticky sticky top-16 border-b border-line bg-canvas lg:top-0">
        {/* Phones: who and what on the first row, the tabs on a row of their own, so nothing covers the status (A-11). */}
        <div data-editor-header className="mx-auto grid max-w-content grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 md:flex md:flex-wrap md:gap-x-4 md:px-8">
          <Link
            href="/admin/creators"
            aria-label={t("back")}
            className="grid size-touch-target shrink-0 place-items-center rounded-md text-fg hover:bg-hover focus-visible:focus-ring"
          >
            <Icon icon={ArrowLeft} size="md" />
          </Link>
          <div className="grid min-w-0 gap-0.5 md:flex-1">
            <p className="flex min-w-0 items-center gap-2">
              <span className="truncate text-body-lg font-semibold">
                <bdi>{name}</bdi>
              </span>
              {draft.verified ? <Icon icon={BadgeCheck} size="sm" label={t("verified")} className="shrink-0 text-link" /> : null}
            </p>
            <p data-editor-status className="flex min-w-0 flex-wrap items-center gap-2 text-caption text-fg-secondary">
              <StatusBadge status={draft.status} />
              {server ? (
                <Badge size="sm" tone="outline">
                  {t("liveVersion")}
                </Badge>
              ) : null}
              <span dir="ltr" className="min-w-0 truncate">
                {pageAddress(draft.username)}
              </span>
            </p>
          </div>
          <div className="col-span-full flex min-w-0 flex-wrap items-center gap-2 md:col-auto">
            <Segmented label={t("tabsLabel")} value={tab} onValueChange={setTab} options={tabs} className={cn("max-md:flex-1 max-md:[&>*]:flex-1", touchSegmented)} />
            {locales.length > 1 ? (
              <Segmented size="sm" label={t("language")} value={locale} onValueChange={setChosen} options={locales.map((value) => ({ value, label: tLocales(value) }))} className={touchSegmented} />
            ) : null}
          </div>
        </div>
      </div>

      {tab === "page" && editable ? <EditorScreen title={t("pageTitle")} lead={t("pageLead", { name })} /> : null}
      {tab === "page" && !editable ? (
        <Screen title={t("tabs.preview")} lead={t("readOnly")}>
          <PhonePreview className="aspect-short" />
        </Screen>
      ) : null}
      {tab === "design" && editable ? <DesignScreen /> : null}
      {tab === "settings" ? <SettingsTab draft={draft} locale={locale} server={server} onLanguage={setChosen} /> : null}
      {editable ? (
        <>
          <AddSheet />
          <EditSheet />
        </>
      ) : null}
    </EditorProvider>
  );
}

function Locked({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-canvas-muted px-3 py-2 text-small text-fg-secondary">
      <Icon icon={ShieldAlert} size="sm" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Everything that is not the page itself: who it is for, who may take it over, and getting it live. */
function SettingsTab({ draft, locale, server, onLanguage }: { draft: PreparedDraft; locale: Locale; server: PublishedPage | undefined; onLanguage: (locale: Locale) => void }) {
  const t = useTranslations("admin.creator");
  const { me, can } = useAdmin();
  const locales = LOCALES.filter((code) => draft.pages[code]);

  return (
    <Screen title={t("settingsTitle")} lead={t("settingsLead")} wide>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          <PublishPanel draft={draft} />
          <InvitesPanel draft={draft} />
          <Panel title={t("verify.title")} id="verify-title">
            <SwitchRow
              label={t("verify.label")}
              description={t("verify.description")}
              checked={draft.verified}
              disabled={!can("creators.verify")}
              onChecked={(verified) => adminStore.updateDraft(me.email, draft.slug, (current) => ({ ...current, verified }), verified ? "page.verify" : "page.unverify")}
            />
            {can("creators.verify") ? null : <Locked>{t("verify.locked")}</Locked>}
          </Panel>
        </div>
        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          <IdentityPanel key={`${draft.slug}:${locale}`} draft={draft} locale={locale} />
          <LanguagesPanel draft={draft} locale={locale} onLanguage={onLanguage} />
          <CreatorLinks slug={draft.slug} username={draft.username} locales={locales} live={Boolean(server)} />
          <DeletePanel draft={draft} live={Boolean(server)} />
        </div>
      </div>
    </Screen>
  );
}

function PublishPanel({ draft }: { draft: PreparedDraft }) {
  const t = useTranslations("admin.creator.publish");
  const tStatus = useTranslations("admin.status");
  const { me, can } = useAdmin();
  const { flush } = useSite();
  const allowed = can("pages.publish");
  const file = `linkyo-${draft.slug}.json`;
  const command = `node apps/web/scripts/prepare-page.mjs --add ${file}`;

  const download = async () => {
    // The last edit may still be waiting for autosave: save it, then export what is stored.
    flush();
    const data = await exportPrepared(adminStore.draft(draft.slug) ?? draft);
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" }));
    const anchor = Object.assign(document.createElement("a"), { href: url, download: file });
    anchor.click();
    URL.revokeObjectURL(url);
    adminStore.record(me.email, "page.export", draft.slug);
  };

  return (
    <Panel title={t("title")} id="publish-title">
      {allowed ? (
        <Segmented
          label={t("status")}
          value={draft.status}
          onValueChange={(status) => adminStore.updateDraft(me.email, draft.slug, (current) => ({ ...current, status }), status === "ready" ? "page.ready" : "page.draft")}
          options={(["draft", "ready"] as const).map((value) => ({ value, label: tStatus(value) }))}
          className={touchSegmented}
        />
      ) : (
        <div className="flex items-center gap-2">
          <StatusBadge status={draft.status} />
        </div>
      )}
      <p className="text-small text-fg-secondary">{draft.status === "ready" ? t("readyBody") : t("draftBody")}</p>
      {allowed ? (
        <ol className="grid grid-cols-1 gap-3">
          <li className="grid grid-cols-1 gap-2">
            <p className="text-small font-medium">{t.rich("step1", { bdi })}</p>
            <Button icon={Download} disabled={draft.status !== "ready"} onClick={() => void download()} className="justify-self-start">
              {t("download")}
            </Button>
            {draft.status === "ready" ? null : <p className="text-caption text-fg-tertiary">{t("readyFirst")}</p>}
          </li>
          <li className="grid grid-cols-1 gap-2">
            <p className="text-small font-medium">{t.rich("step2", { bdi })}</p>
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-canvas-muted ps-3 pe-1">
              <code dir="ltr" className="min-w-0 flex-1 py-2 text-start text-caption break-all">
                {command}
              </code>
              <IconButton
                icon={Copy}
                size="sm"
                label={t("copyCommand")}
                onClick={() => void copyText(command).then((ok) => toast({ title: ok ? t("copied") : t("copyFailed"), tone: ok ? "success" : "danger" }))}
              />
            </div>
          </li>
          <li className="text-small font-medium">{t.rich("step3", { bdi })}</li>
        </ol>
      ) : (
        <Locked>{t("locked")}</Locked>
      )}
      <p className="text-caption text-fg-tertiary">{t("phase1")}</p>
    </Panel>
  );
}

function InvitesPanel({ draft }: { draft: PreparedDraft }) {
  const t = useTranslations("admin.creator.invites");
  const { me, can } = useAdmin();
  const allowed = can("invites.manage");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<"invalid" | "duplicate" | null>(null);

  const add = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!z.email().safeParse(value).success || draft.invites.includes(value)) {
      setError(draft.invites.includes(value) ? "duplicate" : "invalid");
      return;
    }
    adminStore.updateDraft(me.email, draft.slug, (current) => ({ ...current, invites: [...current.invites, value] }), "invite.add");
    setEmail("");
    setError(null);
  };

  return (
    <Panel title={t("title")} id="invites-title">
      <p className="text-small text-fg-secondary">{t("body")}</p>
      {draft.invites.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2">
          {draft.invites.map((invite) => (
            <li key={invite} className="flex min-w-0 items-center gap-2 rounded-md border border-line ps-3 pe-1">
              <Icon icon={Mail} size="sm" className="shrink-0 text-fg-tertiary" />
              <span dir="ltr" className="min-w-0 flex-1 truncate py-2 text-start text-small">
                {invite}
              </span>
              {allowed ? (
                <IconButton
                  icon={X}
                  size="sm"
                  label={t("remove", { email: invite })}
                  onClick={() => adminStore.updateDraft(me.email, draft.slug, (current) => ({ ...current, invites: current.invites.filter((item) => item !== invite) }), "invite.remove")}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md bg-warning-subtle px-3 py-2 text-small text-warning-strong">{draft.publishedInvites ? t("noneNew") : t("none")}</p>
      )}
      {draft.publishedInvites ? <p className="text-small text-fg-secondary">{t("published", { count: draft.publishedInvites })}</p> : null}
      {allowed ? (
        <form noValidate onSubmit={add} className="grid grid-cols-1 gap-2">
          <TextField
            id="invite-email"
            label={t("add")}
            type="email"
            ltr
            icon={Mail}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            autoComplete="off"
            inputMode="email"
            error={error ? t(`errors.${error}`) : undefined}
          />
          <Button type="submit" icon={Plus} className="justify-self-start">
            {t("addButton")}
          </Button>
        </form>
      ) : (
        <Locked>{t("locked")}</Locked>
      )}
      <p className="text-caption text-fg-tertiary">{t.rich("privacy", { bdi })}</p>
    </Panel>
  );
}

/** The name in the preview label and the address the creator gets. */
function IdentityPanel({ draft, locale }: { draft: PreparedDraft; locale: Locale }) {
  const t = useTranslations("admin.creator.identity");
  const tCreate = useTranslations("admin.creators.create");
  const tLocales = useTranslations("admin.locales");
  const { me, can, db } = useAdmin();
  const [name, setName] = useState(draft.name[locale] ?? "");
  const [username, setUsername] = useState(draft.username);
  const [tried, setTried] = useState(false);
  const allowed = can("pages.edit");
  const usernameError = !profileSchema.shape.username.safeParse(username).success
    ? "invalid"
    : RESERVED_USERNAMES.has(username)
      ? "reserved"
      : Object.values(db.drafts).some((other) => other.slug !== draft.slug && other.username === username)
        ? "taken"
        : null;
  const changed = name.trim() !== (draft.name[locale] ?? "") || username !== draft.username;

  const save = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTried(true);
    if (!name.trim() || usernameError) return;
    adminStore.updateDraft(me.email, draft.slug, (current) => ({ ...current, name: { ...current.name, [locale]: name.trim() }, username }), "page.edit");
    toast({ title: t("saved"), tone: "success" });
  };

  return (
    <Panel title={t("title")} id="identity-title">
      <form noValidate onSubmit={save} className="grid grid-cols-1 gap-4">
        <TextField
          id="identity-name"
          label={t("name", { language: tLocales(locale) })}
          hint={t("nameHint")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          disabled={!allowed}
          error={tried && !name.trim() ? tCreate("nameMissing") : undefined}
        />
        <TextField
          id="identity-username"
          label={tCreate("username")}
          ltr
          leading={`${CREATOR_DOMAIN}/`}
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          disabled={!allowed}
          hint={t("usernameHint")}
          error={usernameError && (tried || username !== draft.username) ? tCreate.markup(`usernameErrors.${usernameError}`, { bdi: isolate }) : undefined}
        />
        {allowed ? (
          <Button type="submit" variant="primary" disabled={!changed} className="justify-self-start">
            {t("save")}
          </Button>
        ) : null}
      </form>
    </Panel>
  );
}

function LanguagesPanel({ draft, locale, onLanguage }: { draft: PreparedDraft; locale: Locale; onLanguage: (locale: Locale) => void }) {
  const t = useTranslations("admin.creator.languages");
  const tLocales = useTranslations("admin.locales");
  const { me, can } = useAdmin();
  const allowed = can("pages.edit");
  const present = LOCALES.filter((code) => draft.pages[code]);
  const missing = LOCALES.filter((code) => !draft.pages[code]);
  const [next, setNext] = useState<Locale | undefined>(missing[0]);
  const target = next && missing.includes(next) ? next : missing[0];

  const add = () => {
    const source = draft.pages[locale];
    if (!target || !source) return;
    adminStore.updateDraft(
      me.email,
      draft.slug,
      (current) => ({
        ...current,
        name: { ...current.name, [target]: current.name[locale] ?? "" },
        pages: { ...current.pages, [target]: { ...source, profile: { ...source.profile, locale: target } } },
      }),
      "page.language",
    );
    onLanguage(target);
    toast({ title: t("added", { language: tLocales(target) }), tone: "success" });
  };

  const remove = (code: Locale) => {
    adminStore.updateDraft(
      me.email,
      draft.slug,
      (current) => ({
        ...current,
        name: Object.fromEntries(Object.entries(current.name).filter(([key]) => key !== code)),
        pages: Object.fromEntries(Object.entries(current.pages).filter(([key]) => key !== code)),
      }),
      "page.language",
    );
  };

  return (
    <Panel title={t("title")} id="languages-title">
      <p className="text-small text-fg-secondary">{t("body")}</p>
      <ul className="flex flex-wrap gap-2">
        {present.map((code) => (
          <li key={code} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface ps-3 pe-1 text-small">
            <Icon icon={Languages} size="sm" className="text-fg-tertiary" />
            <span className="px-1 py-1">{tLocales(code)}</span>
            {allowed && present.length > 1 ? <IconButton icon={X} size="sm" label={t("remove", { language: tLocales(code) })} onClick={() => remove(code)} /> : null}
          </li>
        ))}
      </ul>
      {allowed && target ? (
        <div className="flex flex-wrap items-end gap-2">
          <SelectField label={t("add")} value={target} onValue={setNext} options={missing.map((value) => ({ value, label: tLocales(value) }))} className="min-w-0 flex-1" />
          <Button icon={Plus} onClick={add}>
            {t("addButton")}
          </Button>
        </div>
      ) : null}
      {allowed && target ? <p className="text-caption text-fg-tertiary">{t("copyHint", { language: tLocales(locale) })}</p> : null}
    </Panel>
  );
}

function DeletePanel({ draft, live }: { draft: PreparedDraft; live: boolean }) {
  const t = useTranslations("admin.creator.delete");
  const { me, can } = useAdmin();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!can("pages.delete")) return null;
  return (
    <Panel title={t("title")} id="delete-title">
      <p className="text-small text-fg-secondary">{live ? t("bodyLive") : t("body")}</p>
      <Button variant="destructive" icon={Trash2} onClick={() => setOpen(true)} className="justify-self-start">
        {live ? t("buttonLive") : t("button")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle")}
        description={t.rich("confirmBody", { name: draft.username, bdi })}
        confirmLabel={live ? t("buttonLive") : t("button")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          router.replace("/admin/creators");
          adminStore.deleteDraft(me.email, draft.slug);
        }}
      />
    </Panel>
  );
}

