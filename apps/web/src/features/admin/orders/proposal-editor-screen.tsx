"use client";

import type { Page } from "@linkyo/blocks";
import { Button, Icon, IconButton, Skeleton, TextField, toast } from "@linkyo/ui";
import { ArrowLeft, ImagePlus, Lock, Send, ShieldAlert, X } from "lucide-react";
import { NextIntlClientProvider, useLocale, useMessages, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import type { Account, Result, Site } from "@/features/account/types";
import { AddSheet } from "@/features/app/add-sheet";
import { EditSheet } from "@/features/app/edit-sheet";
import { EditorScreen } from "@/features/app/editor-screen";
import { TextArea } from "@/features/app/form";
import { pickFiles } from "@/features/app/images";
import { uploadToBucket } from "@/features/app/media-upload";
import { PhonePreview } from "@/features/app/preview";
import { Panel, Screen } from "@/features/app/screen";
import { EditorProvider, useSite, type SiteDoc } from "@/features/app/site-context";
import { Link, useRouter } from "@/i18n/navigation";

import { useAdmin } from "../session";

import { currentDraft } from "./order-detail-screen";
import { ApiError, deliverProposal, kitComplete, loadOrder, saveProposal, signedUrls, type Kit, type TeamOrder } from "./orders-data";
import { teamEditorMessages } from "./team-words";

const EMPTY_LEGAL = { name: "", address: "", email: "", phone: "" };
const STORY_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };
const MAX_STORY_BYTES = 10 * 1024 * 1024;
const emptyKit = (): Kit => ({ bioInstagram: "", bioTiktok: "", postingPlan: [1, 2, 3, 4].map((week) => ({ week, idea: "" })) });
const consoleLink = "inline-flex min-h-touch-target items-center gap-2 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring";

/** What the editor starts from: the round's newest proposal, else the customer's current page. */
function startingPoint(order: TeamOrder): { page: Page; theme: Site["theme"]; kind: string | null; message: string; kit: Kit | null; stories: string[] } | null {
  const latest = [...order.proposals].sort((a, b) => b.round - a.round)[0];
  const username = order.customer.username ?? "";
  if (latest) {
    const own = latest.round === order.revisionsUsed;
    return {
      page: { ...latest.page, profile: { ...latest.page.profile, username } },
      theme: latest.theme,
      kind: latest.kind,
      message: own ? (latest.message ?? "") : "",
      kit: latest.extras,
      stories: latest.storyPaths,
    };
  }
  if (!order.site) return null;
  return { page: { ...order.site.page, profile: { ...order.site.page.profile, username } }, theme: order.site.theme, kind: order.site.kind, message: "", kit: null, stories: [] };
}

/** The kit's fields: two bios, the four weeks and the three story pictures (Premium only). */
function KitFields({
  order,
  kit,
  stories,
  onKit,
  onStories,
}: {
  order: TeamOrder;
  kit: Kit;
  stories: string[];
  onKit: (kit: Kit) => void;
  onStories: (stories: string[]) => void;
}) {
  const t = useTranslations("admin.orders.kit");
  const tErrors = useTranslations("legal.errors");
  const storiesId = useId();
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(false);
  const key = stories.join("|");
  useEffect(() => {
    if (!key) return;
    void signedUrls("deliverables", key.split("|")).then(setPreviews);
  }, [key]);

  const add = async () => {
    const [file] = (await pickFiles({ accept: Object.keys(STORY_TYPES).join(",") })).filter((candidate) => candidate.type in STORY_TYPES && candidate.size <= MAX_STORY_BYTES);
    if (!file || stories.length >= 3 || !order.customer.id) return;
    setUploading(true);
    try {
      const path = `${order.customer.id}/${order.id}/${crypto.randomUUID()}.${STORY_TYPES[file.type] ?? "jpg"}`;
      await uploadToBucket("deliverables", path, file, file.type);
      onStories([...stories, path]);
    } catch {
      toast({ title: tErrors("server"), tone: "danger" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Panel title={t("title")}>
      <TextField label={t("bioInstagram")} value={kit.bioInstagram} maxLength={150} onChange={(event) => onKit({ ...kit, bioInstagram: event.target.value })} />
      <TextField label={t("bioTiktok")} value={kit.bioTiktok} maxLength={80} onChange={(event) => onKit({ ...kit, bioTiktok: event.target.value })} />
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-small font-semibold">{t("plan")}</legend>
        {kit.postingPlan.map((entry) => (
          <TextArea
            key={entry.week}
            label={t("week", { week: entry.week })}
            value={entry.idea}
            max={280}
            rows={2}
            live={false}
            onValue={(idea) => onKit({ ...kit, postingPlan: kit.postingPlan.map((item) => (item.week === entry.week ? { ...item, idea } : item)) })}
          />
        ))}
      </fieldset>
      <div className="grid gap-3">
        <p id={storiesId} className="text-small font-semibold">
          {t("stories")}
        </p>
        {stories.length > 0 ? (
          <ul aria-labelledby={storiesId} className="grid grid-cols-3 gap-2">
            {stories.map((path, index) => (
              <li key={path} className="relative aspect-portrait overflow-hidden rounded-md border border-line bg-canvas-muted">
                {previews.get(path) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed address of a private picture (10 minutes)
                  <img src={previews.get(path)} alt="" className="size-full object-cover" />
                ) : null}
                <IconButton
                  icon={X}
                  size="sm"
                  variant="secondary"
                  label={t("removeStory", { n: index + 1 })}
                  className="absolute end-1 top-1"
                  onClick={() => onStories(stories.filter((item) => item !== path))}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {stories.length < 3 ? (
          <Button variant="secondary" loading={uploading} onClick={() => void add()} className="justify-self-start">
            <Icon icon={ImagePlus} size="sm" />
            {t("addStory")}
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

/**
 * Inside the editor: the banner, the message to the account, the kit (Premium) and Deliver. Changes
 * to the message and the kit are saved like page edits (a moment later, in order); Deliver first
 * writes what is still waiting, waits for every save, and only then hands the proposal over, so the
 * delivered proposal is the one on screen.
 */
function ProposalTools({
  order,
  readOnly,
  meta,
  onMeta,
  persist,
  settled,
}: {
  order: TeamOrder;
  readOnly: boolean;
  meta: { message: string; kit: Kit; stories: string[] };
  onMeta: (meta: { message: string; kit: Kit; stories: string[] }) => void;
  persist: (doc: SiteDoc) => void;
  settled: () => Promise<string | null>;
}) {
  const t = useTranslations("admin.orders");
  const tErrors = useTranslations("legal.errors");
  const router = useRouter();
  const { flush, latest } = useSite();
  const [busy, setBusy] = useState(false);
  const premium = order.package === "premium";
  const complete = !premium || kitComplete(meta.kit, meta.stories);

  // The message and the kit save a moment after the last keystroke, with the page as it is now.
  const timer = useRef<number | null>(null);
  const change = (next: { message: string; kit: Kit; stories: string[] }) => {
    onMeta(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      persist(latest());
    }, 400);
  };

  const deliver = async () => {
    setBusy(true);
    try {
      flush();
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      // One last save with the page and the fields as they are on screen (also when nothing changed).
      persist(latest());
      const proposalId = await settled();
      if (!proposalId) throw new Error("not saved");
      await deliverProposal(order.id, proposalId);
      toast({ title: t("delivered"), tone: "success" });
      router.push(`/admin/orders/${order.id}`);
    } catch (error) {
      toast({ title: error instanceof ApiError && error.code === "incomplete" ? t("kit.incomplete") : tErrors("server"), tone: "danger" });
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-prose gap-6 px-4 pb-10 md:px-8">
      {readOnly ? null : (
        <>
          <Panel>
            <TextArea label={t("editor.message")} value={meta.message} max={2000} rows={4} onValue={(message) => change({ ...meta, message })} />
          </Panel>
          {premium ? <KitFields order={order} kit={meta.kit} stories={meta.stories} onKit={(kit) => change({ ...meta, kit })} onStories={(stories) => change({ ...meta, stories })} /> : null}
          <div data-proposal-deliver className="grid gap-2">
            <Button variant="primary" size="cta" disabled={!complete} loading={busy} onClick={() => void deliver()} aria-describedby={complete ? undefined : "kit-incomplete"}>
              <Icon icon={Send} size="sm" />
              {t("actions.deliver")}
            </Button>
            {complete ? null : (
              <p id="kit-incomplete" className="text-small text-fg-secondary">
                {t("kit.incomplete")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The editor inside reads its words from here: the page's messages with the team's empty state
 * (`teamEditorMessages`). The customer's editor would say "Deine Seite wartet" to a team member.
 */
function TeamEditorWords({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const messages = useMessages();
  const team = useMemo(() => teamEditorMessages(messages), [messages]);
  return (
    <NextIntlClientProvider locale={locale} messages={team}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * The proposal of an order in the page editor (`/admin/orders/<id>/proposal`, team area, teal). It
 * edits a copy: `write` saves the round's draft with `admin_save_proposal` and never touches the
 * customer's page. Once the round's proposal is delivered (and no change was requested), it opens
 * read-only.
 */
export function ProposalEditorScreen({ orderId }: { orderId: string }) {
  const t = useTranslations("admin.orders");
  const tErrors = useTranslations("legal.errors");
  const { can } = useAdmin();
  const [order, setOrder] = useState<TeamOrder | null | undefined>(undefined);
  const [meta, setMeta] = useState<{ message: string; kit: Kit; stories: string[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadOrder(orderId)
      .catch(() => null)
      .then((next) => {
        if (cancelled) return;
        const from = next ? startingPoint(next) : null;
        if (from) setMeta({ message: from.message, kit: from.kit ?? emptyKit(), stories: from.stories });
        setOrder(next);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const start = useMemo(() => (order ? startingPoint(order) : null), [order]);

  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);
  // Saves run one after another; the last one's answer is the proposal's id.
  const pending = useRef<Promise<string | null>>(Promise.resolve(null));
  const save = useCallback(
    (doc: SiteDoc) => {
      if (!order) return;
      const current = metaRef.current;
      const premium = order.package === "premium";
      pending.current = pending.current.then(async () => {
        try {
          return await saveProposal({
            orderId: order.id,
            page: { profile: doc.profile, blocks: doc.blocks },
            theme: doc.theme,
            kind: start?.kind,
            message: current?.message ?? "",
            ...(premium && current ? { extras: current.kit, stories: current.stories } : {}),
          });
        } catch {
          toast({ title: tErrors("server"), tone: "danger" });
          return null;
        }
      });
    },
    [order, start, tErrors],
  );
  const write = useCallback(
    (doc: SiteDoc): Result => {
      save(doc);
      return { ok: true };
    },
    [save],
  );

  if (order === undefined || (order && start && !meta)) {
    return (
      <div className="mx-auto grid max-w-content gap-4 px-4 pt-6 md:px-8" aria-hidden>
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }
  if (!order || !start || !meta) {
    return (
      <div className="mx-auto grid max-w-content gap-4 px-4 pt-6 md:px-8">
        <Link href="/admin/orders" className={consoleLink}>
          <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
          {t("title")}
        </Link>
        <p className="text-small text-fg-secondary">{t("empty")}</p>
      </div>
    );
  }

  const roundTaken = order.proposals.some((proposal) => proposal.round === order.revisionsUsed);
  const delivered = roundTaken && currentDraft(order) === null;
  const readOnly = delivered || order.withdrawalPending || order.status === "refunded" || order.status === "withdrawn" || !can("pages.edit");
  const customer = order.customer.username ?? order.customer.email;
  const account: Account = { id: `proposal:${order.id}`, email: order.customer.email, username: order.customer.username ?? "", createdAt: order.orderedAt };
  const site: Site = { page: start.page, theme: start.theme, legal: EMPTY_LEGAL, onboarded: true, ...(start.kind ? { kind: start.kind } : {}), updatedAt: order.orderedAt };

  return (
    <EditorProvider account={account} site={site} write={write} previewHref={`/admin/orders/${order.id}`}>
      <div className="layer-sticky sticky top-16 border-b border-line bg-canvas lg:top-0">
        <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
          <Link href={`/admin/orders/${order.id}`} aria-label={t("title")} className="grid size-touch-target shrink-0 place-items-center rounded-md text-fg hover:bg-hover focus-visible:focus-ring">
            <Icon icon={ArrowLeft} size="md" className="rtl:-scale-x-100" />
          </Link>
          <p className="grid min-w-0 flex-1 gap-0.5">
            <span className="truncate text-body-lg font-semibold">{t("editor.title", { customer: `@${customer}` })}</span>
            <bdi className="text-caption text-fg-secondary tabular-nums">{order.number}</bdi>
          </p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-content px-4 pt-4 md:px-8">
        <p role="note" className="flex items-start gap-2 rounded-md bg-canvas-muted px-3 py-2 text-small text-fg-secondary">
          <Icon icon={readOnly ? Lock : ShieldAlert} size="sm" className="mt-0.5 shrink-0" />
          <span data-proposal-banner>{delivered ? t("editor.locked") : order.withdrawalPending ? t("detail.withdrawalLock") : t("editor.note")}</span>
        </p>
      </div>
      {readOnly ? (
        <Screen title={t("actions.edit")}>
          <PhonePreview className="aspect-short" />
        </Screen>
      ) : (
        <>
          <TeamEditorWords>
            <EditorScreen title={t("actions.edit")} />
          </TeamEditorWords>
          <AddSheet />
          <EditSheet />
        </>
      )}
      <ProposalTools order={order} readOnly={readOnly} meta={meta} onMeta={setMeta} persist={save} settled={() => pending.current} />
    </EditorProvider>
  );
}
