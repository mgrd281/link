"use client";

import { hasAiContent, isKind, type Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { Button, cn, Icon, IconButton, Skeleton, toast } from "@linkyo/ui";
import { Copy, Download, PenTool, Sparkles, X } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { accountStore } from "@/features/account/store";
import { DraftChip } from "@/features/ai/draft-phone";
import { DraftReview, type ReviewDraft } from "@/features/ai/review";
import { clockTime, longDate, type EmailLocale } from "@/features/email/templates/render";
import { COMPANY } from "@/features/legal/company";
import { useRouter } from "@/i18n/navigation";
import { copyText } from "@/lib/clipboard";
import { accessToken } from "@/lib/supabase/access-token";
import { browserSupabase } from "@/lib/supabase/browser";
import { isStale, useSignedUrls } from "@/lib/supabase/signed";

import { TextArea } from "../form";
import { Sheet } from "../sheet";
import { useSite, type SiteDoc } from "../site-context";
import { useScrolled } from "../use-scrolled";

import { isFinalRefusal, proposalView } from "./proposal-state";

interface Kit {
  bioInstagram: string;
  bioTiktok: string;
  postingPlan: { week: number; idea: string }[];
}

interface Proposal {
  id: string;
  orderId: string;
  status: string;
  page: Page;
  theme: CreatorThemeConfig;
  kind: string | null;
  message: string | null;
  kit: Kit | null;
  stories: string[];
}

interface OrderFacts {
  package: "start" | "premium";
  status: string;
  /** A withdrawal is being checked: the order rests. */
  withdrawalPending: boolean;
  revisionsLeft: number;
  reviseUntil: Date | null;
  /** When requested changes arrive (while the order is "revision_requested"). */
  revisionDueAt: Date | null;
  voluntaryRefundAvailable: boolean;
  aiAssisted: boolean | null;
}

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const str = (value: unknown) => (typeof value === "string" ? value : "");

function readKit(value: unknown): Kit | null {
  const row = obj(value);
  if (!row.bioInstagram && !row.bioTiktok && !Array.isArray(row.postingPlan)) return null;
  const plan = Array.isArray(row.postingPlan) ? row.postingPlan.map(obj) : [];
  return {
    bioInstagram: str(row.bioInstagram),
    bioTiktok: str(row.bioTiktok),
    postingPlan: plan.map((entry) => ({ week: typeof entry.week === "number" ? entry.week : 0, idea: str(entry.idea) })).sort((a, b) => a.week - b.week),
  };
}

/** The proposal (row-level security: only the owner's delivered ones) and the order's facts. */
async function loadProposal(id: string): Promise<{ proposal: Proposal; order: OrderFacts } | null> {
  const db = browserSupabase();
  const { data } = await db.from("site_proposals").select("id, order_id, status, page, theme, kind, message, extras, story_paths").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: orderData } = await db.rpc("my_order", { target: data.order_id });
  const order = obj(orderData);
  const allowed = typeof order.revisionsAllowed === "number" ? order.revisionsAllowed : 0;
  const used = typeof order.revisionsUsed === "number" ? order.revisionsUsed : 0;
  const listed = (Array.isArray(order.proposals) ? order.proposals : []).map(obj).find((entry) => entry.id === id);
  return {
    proposal: {
      id: data.id,
      orderId: data.order_id,
      status: data.status,
      page: data.page as unknown as Page,
      theme: data.theme as unknown as CreatorThemeConfig,
      kind: data.kind,
      message: data.message,
      kit: readKit(data.extras),
      stories: data.story_paths,
    },
    order: {
      package: order.package === "premium" ? "premium" : "start",
      status: str(order.status),
      withdrawalPending: order.withdrawalPending === true,
      revisionsLeft: Math.max(allowed - used, 0),
      reviseUntil: typeof order.reviseUntil === "string" ? new Date(order.reviseUntil) : null,
      revisionDueAt: typeof order.revisionDueAt === "string" ? new Date(order.revisionDueAt) : null,
      voluntaryRefundAvailable: order.voluntaryRefundAvailable === true,
      aiAssisted: listed ? listed.aiAssisted === true : null,
    },
  };
}

/** Premium's marketing kit beside the review: two bios to copy, the four weeks, three pictures to download. */
function KitAside({ kit, stories }: { kit: Kit | null; stories: string[] }) {
  const t = useTranslations("app.proposals.kit");
  // Signed for ten minutes, signed again while the review stays open (people compare and copy first).
  const links = useSignedUrls("deliverables", stories, { download: true });
  const copy = async (text: string) => {
    if (await copyText(text)) toast({ title: t("copied"), tone: "success" });
  };
  /** Signs now and starts the download: no address yet (signing failed), or one that may have run out. */
  const downloadFresh = async (path: string) => {
    const url = (await links.sign()).get(path);
    if (url) window.location.assign(url);
    else toast({ title: t("downloadFailed"), tone: "danger" });
  };
  const storyLink = "inline-flex min-h-touch-target items-center gap-2 rounded-sm text-start text-small font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring";
  const bios = kit
    ? [
        { label: t("bioInstagram"), text: kit.bioInstagram },
        { label: t("bioTiktok"), text: kit.bioTiktok },
      ]
    : [];
  return (
    <section data-kit className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-4">
      <div className="grid gap-1">
        <h3 className="text-title rtl:tracking-normal">{t("title")}</h3>
        <p className="text-small text-fg-secondary">{t("lead")}</p>
      </div>
      {bios.map((bio) => (
        <div key={bio.label} className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-small font-semibold">{bio.label}</h4>
            <IconButton icon={Copy} size="sm" variant="ghost" label={t("copy", { label: bio.label })} onClick={() => void copy(bio.text)} />
          </div>
          <p dir="auto" className="rounded-md bg-canvas-muted px-3 py-2 text-small break-words whitespace-pre-line">
            {bio.text}
          </p>
        </div>
      ))}
      {kit && kit.postingPlan.length > 0 ? (
        <div className="grid gap-2">
          <h4 className="text-small font-semibold">{t("plan")}</h4>
          <ol className="grid gap-2">
            {kit.postingPlan.map((entry) => (
              <li key={entry.week} className="grid gap-0.5 text-small">
                <span className="font-medium">{t("week", { week: entry.week })}</span>
                <span dir="auto" className="break-words text-fg-secondary">
                  {entry.idea}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {stories.length > 0 ? (
        <div className="grid gap-2">
          <h4 className="text-small font-semibold">{t("stories")}</h4>
          <ul className="grid gap-1">
            {stories.map((path, index) => (
              <li key={path}>
                {links.fresh.get(path) ? (
                  <a
                    href={links.fresh.get(path)}
                    download
                    className={storyLink}
                    onClick={(event) => {
                      // The tab slept past its timer: this address may have run out. Sign again instead of
                      // sending the customer to Storage's error page.
                      if (!isStale(links.signedAt, Date.now())) return;
                      event.preventDefault();
                      void downloadFresh(path);
                    }}
                  >
                    <Icon icon={Download} size="sm" />
                    {t("download", { n: index + 1 })}
                  </a>
                ) : (
                  // No address yet: a button that asks for one (never a link to "#", which would save this page).
                  <button type="button" className={storyLink} onClick={() => void downloadFresh(path)}>
                    <Icon icon={Download} size="sm" />
                    {t("download", { n: index + 1 })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The customer's review of a proposal (`/app/proposals/<id>`, a full-screen task of the dashboard,
 * black and grey). Before | Draft in the phone, who made it by its provenance (§0.3 #16), the team's
 * message, and three ways on: use it (replaces the page in one undoable step), ask for changes (one
 * message, within the rounds and the 14 days), or look later. The voluntary money-back line shows only
 * while it is available; Premium adds the marketing kit.
 */
export function ProposalScreen({ proposalId }: { proposalId: string }) {
  const t = useTranslations("app.proposals");
  const tApp = useTranslations("app");
  const tAi = useTranslations("app.ai.review");
  const tLegal = useTranslations("legal.errors");
  const format = useFormatter();
  const locale = useLocale() as EmailLocale;
  const router = useRouter();
  const scrolled = useScrolled();
  const { account, doc, dispatch, latest } = useSite();
  const [loaded, setLoaded] = useState<{ proposal: Proposal; order: OrderFacts } | null | undefined>(undefined);
  const [edited, setEdited] = useState<{ page: Page; theme: CreatorThemeConfig } | null>(null);
  const [applying, setApplying] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Date | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    void loadProposal(proposalId)
      .then(setLoaded)
      .catch(() => setLoaded(null));
  }, [proposalId]);

  const header = (
    <header className={cn("sticky top-0 layer-sticky h-16 bg-canvas", scrolled && "border-b border-line")}>
      <div className="mx-auto flex h-full max-w-content items-center gap-2 pr-[max(var(--spacing-2),env(safe-area-inset-right))] pl-[max(var(--spacing-2),env(safe-area-inset-left))] md:px-6">
        <IconButton icon={X} label={t("later")} onClick={() => router.push("/app")} />
        <h1 className="min-w-0 flex-1 truncate text-body-lg font-semibold">{t("title")}</h1>
      </div>
    </header>
  );

  if (!loaded) {
    return (
      <div data-console="frame" className="flex min-h-dvh flex-col bg-canvas text-fg">
        {header}
        <main id="main" className="mx-auto grid w-full max-w-content gap-4 px-4 pt-6 md:px-8">
          {loaded === undefined ? (
            <>
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </>
          ) : (
            <p className="text-body text-fg-secondary">{tApp("crash.title")}</p>
          )}
        </main>
      </div>
    );
  }

  const { proposal, order } = loaded;
  const aiAssisted = order.aiAssisted ?? hasAiContent(proposal.page);
  const draft: ReviewDraft = { page: { ...proposal.page, profile: { ...proposal.page.profile, username: account.username } }, theme: proposal.theme, kind: proposal.kind };
  const expired = order.reviseUntil !== null && now > order.reviseUntil.getTime();
  const view = proposalView(
    { orderStatus: order.status, withdrawalPending: order.withdrawalPending, proposalStatus: proposal.status, revisionsLeft: order.revisionsLeft, reviseUntil: order.reviseUntil },
    now,
  );
  const reviseOpenNow = view.revise === "open" && sent === null;

  const apply = () => {
    if (applying) return;
    setApplying(true);
    const use = edited ?? { page: draft.page, theme: draft.theme };
    const before = latest();
    // The proposal's profile replaces the page's, including which texts came from an AI draft.
    const applied: SiteDoc = { profile: { ...use.page.profile, username: account.username }, blocks: use.page.blocks, sizes: {}, theme: use.theme };
    dispatch({ type: "replace", doc: applied });
    if (proposal.kind && isKind(proposal.kind)) {
      const kind = proposal.kind;
      accountStore.updateSite((current) => ({ ...current, kind }));
    }
    // A Supabase query runs only once it is awaited (or `then` is called): `void` alone sends nothing.
    void browserSupabase()
      .rpc("mark_proposal_applied", { proposal: proposal.id })
      .then(() => undefined);
    toast({
      title: t("applied"),
      tone: "success",
      action: { label: tApp("undo"), onAction: () => dispatch(latest() === applied ? { type: "undo" } : { type: "replace", doc: before }) },
    });
    router.push("/app/editor");
  };

  const sendRevision = async () => {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const token = await accessToken();
      const response = await fetch(`/api/proposals/${proposal.id}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: text }),
      });
      const data = obj(await response.json().catch(() => ({})));
      if (!response.ok || typeof data.dueAt !== "string") {
        const code = str(data.error) || "server";
        if (!isFinalRefusal(code)) throw new Error(code);
        // Refused for good (a withdrawal came in, the rounds or the 14 days ran out, changes are already
        // being made): "try again" would be wrong. Read the facts again; the screen then says which.
        toast({ title: t("reviseRefused"), tone: "danger" });
        setReviseOpen(false);
        const fresh = await loadProposal(proposal.id).catch(() => null);
        if (fresh) setLoaded(fresh);
        return;
      }
      const due = new Date(data.dueAt);
      setSent(due);
      setReviseOpen(false);
      // One round less; the next one opens when the changed proposal arrives.
      setLoaded((current) =>
        current ? { ...current, order: { ...current.order, revisionsLeft: Math.max(current.order.revisionsLeft - 1, 0), status: "revision_requested", revisionDueAt: due } } : current,
      );
    } catch {
      toast({ title: tLegal("server"), tone: "danger" });
    } finally {
      setSending(false);
    }
  };

  const roundsLine = (marked = true) => (
    <p data-revise-left={marked ? "" : undefined} className="text-small text-fg-secondary">
      {t("reviseLeft", { count: order.revisionsLeft })}
      {order.revisionsLeft > 0 && order.reviseUntil && !expired ? ` ${t("reviseUntil", { date: format.dateTime(order.reviseUntil, { day: "numeric", month: "long" }) })}` : null}
    </p>
  );

  return (
    // data-console="frame": part of the dashboard, black and grey from the first paint (ADR 0062).
    <div data-console="frame" data-proposal-screen className="flex min-h-dvh flex-col bg-canvas text-fg">
      {header}
      <main id="main" className="flex flex-1 flex-col">
        <DraftReview
          kind="proposal"
          draft={draft}
          before={{ page: { profile: doc.profile, blocks: doc.blocks }, theme: doc.theme }}
          onChange={setEdited}
          aiLook={aiAssisted}
          chip={
            <DraftChip>
              <Icon icon={aiAssisted ? Sparkles : PenTool} size="sm" />
              <span data-proposal-chip>{aiAssisted ? t("chipAi") : t("chipTeam")}</span>
            </DraftChip>
          }
          summary={
            <>
              {aiAssisted ? (
                <p className="flex items-center gap-2 font-medium text-fg">
                  <Icon icon={Sparkles} size="sm" className="shrink-0" />
                  {tAi("disclosure")}
                </p>
              ) : null}
              {proposal.message ? (
                <div className="mt-2 grid gap-1 rounded-lg border border-line bg-surface p-4 text-body text-fg">
                  <span className="text-small font-semibold">{t("message")}</span>
                  <p dir="auto" className="break-words whitespace-pre-line">
                    {proposal.message}
                  </p>
                </div>
              ) : null}
            </>
          }
          aside={order.package === "premium" ? <KitAside kit={proposal.kit} stories={proposal.stories} /> : undefined}
          above={view.canApply ? <p className="text-small text-fg-secondary">{t("applyHint")}</p> : undefined}
          actions={
            <div className="mx-auto grid max-w-prose grid-cols-1 gap-2 lg:mx-0">
              {view.canApply ? (
                <Button variant="primary" size="cta" className="w-full" loading={applying} onClick={apply}>
                  {t("apply")}
                </Button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="tinted" size="lg" className="min-w-0 px-3 text-small" disabled={!reviseOpenNow} onClick={() => setReviseOpen(true)}>
                  {t("revise")}
                </Button>
                <Button variant="ghost" size="lg" className="min-w-0 px-3 text-small" onClick={() => router.push("/app")}>
                  {t("later")}
                </Button>
              </div>
              {sent ? (
                <>
                  <p role="status" data-revise-sent className="text-small text-fg">
                    {t("reviseSent", { date: longDate(sent, locale), time: clockTime(sent, locale) })}
                  </p>
                  {roundsLine()}
                </>
              ) : view.revise === "open" ? (
                roundsLine()
              ) : (
                // Why the button is off, in words: never a dead button next to "1 round left".
                <>
                  <p data-revise-state={view.revise} className="text-small text-fg-secondary">
                    {view.revise === "none"
                      ? t("reviseNone")
                      : view.revise === "expired"
                        ? t("reviseExpired")
                        : view.revise === "busy"
                          ? order.revisionDueAt
                            ? t("reviseBusyUntil", { date: longDate(order.revisionDueAt, locale), time: clockTime(order.revisionDueAt, locale) })
                            : t("reviseBusy")
                          : view.revise === "paused"
                            ? t("revisePaused")
                            : view.revise === "superseded"
                              ? t("reviseSuperseded")
                              : t("ended")}
                  </p>
                  {view.roundsLine ? roundsLine() : null}
                </>
              )}
            </div>
          }
          below={
            order.voluntaryRefundAvailable ? (
              <p data-refund-line className="text-small text-fg-secondary">
                {t("refund", { email: COMPANY.email })}
              </p>
            ) : undefined
          }
        />
      </main>
      <Sheet
        open={reviseOpen}
        onOpenChange={setReviseOpen}
        title={t("revise")}
        description={t("reviseHint")}
        closeLabel={tApp("edit.close")}
        footer={
          <Button variant="primary" size="lg" className="w-full" loading={sending} disabled={message.trim() === ""} onClick={() => void sendRevision()}>
            {t("reviseSend")}
          </Button>
        }
      >
        <div className="grid gap-3">
          {roundsLine(false)}
          <TextArea label={t("reviseLabel")} value={message} onValue={setMessage} max={2000} rows={6} />
        </div>
      </Sheet>
    </div>
  );
}
