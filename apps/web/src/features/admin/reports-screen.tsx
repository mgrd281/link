"use client";

import { Badge, Button, cn, ConfirmDialog, Icon, icons, Segmented, Select, Spinner, toast } from "@linkyo/ui";
import { ArrowRight, Clock, EyeOff, Flag, Gavel, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { TextArea } from "@/features/app/form";
import { Sheet } from "@/features/app/sheet";
import { Panel, Screen } from "@/features/app/screen";
import { useNow } from "@/features/directions/poster/live";
import { moderationTeam, useModerationTarget, useReports, useYearCounts } from "@/features/moderation/team";
import { DECISIONS, dueAt, GROUNDS, LIMITS, overdue, PURGE_DAYS, REPORT_SLA_HOURS, type DecideError, type Decision, type Ground, type Report } from "@/features/moderation/types";
import { Link } from "@/i18n/navigation";
import { pageAddress, pageUrl } from "@/lib/page-url";
import { supabaseEnabled } from "@/lib/supabase/config";
import { touchSegmented } from "@/lib/touch";

import { bdi, isolate } from "./bidi";
import { count, dateTime, timeAgo } from "./format";
import { useAdmin } from "./session";

/*
 * The team's queue for reports from the public form (DSA Art. 16 and 17; features/moderation): what was
 * reported, by when the team means to decide, and the decision with its reasons. Every restriction and
 * every dismissal needs written reasons; the server sends them to the creator (the statement of reasons)
 * and the decision to the reporter. The screen says plainly when those e-mails did not go out.
 */

const DECISION_ICONS: Record<Decision, typeof Flag> = { hide_block: EyeOff, unpublish: icons.page, suspend: UserX, dismiss: icons.success };

/** A calm, honest "nothing here" box, as elsewhere in the console. */
function Empty({ text }: { text: string }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-line-strong p-8 text-center">
      <Icon icon={Flag} size="lg" className="text-fg-tertiary" />
      <p className="text-body text-fg-secondary">{text}</p>
    </div>
  );
}

/** One radio choice drawn as a row: its name and one line on what it does. The chosen one carries a border and a fill, never colour alone. */
function Choice({ name, value, checked, onChange, label, hint, disabled = false }: { name: string; value: string; checked: boolean; onChange: () => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label
      className={cn(
        "flex min-h-touch-target cursor-pointer items-start gap-3 rounded-md border px-3 py-3 transition-colors duration-micro motion-reduce:transition-none",
        checked ? "border-line-input bg-selected font-semibold" : "border-line hover:bg-hover",
        disabled && "cursor-not-allowed opacity-secondary",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="mt-1 size-icon-sm shrink-0 focus-visible:focus-ring" />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-small">{label}</span>
        {hint ? <span className="text-caption font-regular text-fg-secondary">{hint}</span> : null}
      </span>
    </label>
  );
}

/** The decision on one report, in a dialog: what happens, which block, the ground and the reasons. */
function DecisionDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  const t = useTranslations("admin.reports");
  const { can, me } = useAdmin();
  const account = report.account;
  const options = DECISIONS.filter((decision) => {
    if (decision === "dismiss") return true;
    if (!account) return false;
    if (decision === "suspend") return can("customers.manage") && account.status !== "suspended";
    if (decision === "unpublish") return !account.offline;
    return true;
  });
  const [decision, setDecision] = useState<Decision | "">(options.length === 1 ? (options[0] ?? "") : "");
  const [block, setBlock] = useState("");
  const [ground, setGround] = useState<Ground>("illegal");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const name = useId();
  const blockName = useId();
  const target = useModerationTarget(decision === "hide_block" && account ? account.id : null);
  const blocks = target.target?.blocks ?? [];
  const valid = (decision as string) !== "" && reason.trim().length >= LIMITS.reason.min && (decision !== "hide_block" || block !== "");
  const page = pageAddress(report.page);

  const submit = async () => {
    if (!valid || decision === "") return;
    setBusy(true);
    const answer = await moderationTeam.decide({
      decision,
      report,
      customer: account?.id ?? null,
      reason: reason.trim(),
      ground: decision === "dismiss" ? null : ground,
      block: decision === "hide_block" ? block : null,
      actor: me.email,
    });
    setBusy(false);
    if (!answer.ok) {
      const known: DecideError[] = ["alreadyDecided", "alreadyDone", "blockNotFound", "mismatch", "notYourself", "forbidden", "unavailable"];
      toast({ title: known.includes(answer.error) ? t(`toast.${answer.error}`) : t("toast.failed"), tone: "danger" });
      return;
    }
    toast({ title: t("toast.done"), tone: "success" });
    // The e-mails go out only where a transport delivers (F1); the demo sends nothing and says so in its note.
    if (supabaseEnabled && !answer.creatorMailed && !answer.reporterMailed) toast({ title: t("toast.notMailed"), tone: "neutral" });
    onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.markup("dialog.title", { page, bdi: isolate })}
      description={t("dialog.statement")}
      closeLabel={t("dialog.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("dialog.cancel")}
          </Button>
          <Button variant="primary" icon={Gavel} loading={busy} disabled={!valid} onClick={() => void submit()}>
            {t("dialog.confirm")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <fieldset className="grid grid-cols-1 gap-2">
          <legend className="pb-2 text-small font-semibold text-fg">{t("dialog.action")}</legend>
          {options.map((option) => (
            <Choice
              key={option}
              name={name}
              value={option}
              checked={decision === option}
              onChange={() => setDecision(option)}
              label={t(`decisions.${option}`)}
              hint={t(`decisionHints.${option}`)}
            />
          ))}
        </fieldset>
        {decision === "hide_block" ? (
          <fieldset className="grid grid-cols-1 gap-2">
            <legend className="pb-2 text-small font-semibold text-fg">{t("dialog.block")}</legend>
            {target.status === "loading" ? (
              <p className="flex items-center gap-2 text-small text-fg-secondary">
                <Spinner />
                {t("dialog.loading")}
              </p>
            ) : blocks.length === 0 ? (
              <p className="text-small text-fg-secondary">{t("dialog.blockNone")}</p>
            ) : (
              blocks.map((item) => (
                <Choice
                  key={item.id}
                  name={blockName}
                  value={item.id}
                  checked={block === item.id}
                  onChange={() => setBlock(item.id)}
                  disabled={item.hidden}
                  label={item.hidden ? t("dialog.blockHidden", { label: item.label }) : item.visible ? item.label : t("dialog.blockOff", { label: item.label })}
                />
              ))
            )}
          </fieldset>
        ) : null}
        {decision !== "" && decision !== "dismiss" ? (
          <Select label={t("dialog.ground")} size="auto" value={ground} onValueChange={setGround} options={GROUNDS.map((value) => ({ value, label: t(`grounds.${value}`) }))} />
        ) : null}
        {decision !== "" ? (
          <TextArea
            label={decision === "dismiss" ? t("dialog.reasonDismiss") : t("dialog.reason")}
            hint={decision === "dismiss" ? t("dialog.reasonDismissHint") : t("dialog.reasonHint")}
            value={reason}
            onValue={setReason}
            max={LIMITS.reason.max}
            rows={4}
            required
          />
        ) : null}
      </div>
    </Sheet>
  );
}

/** Lifting a restriction after the creator objected (or a mistake): a reason, then the page is back. */
function LiftDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  const t = useTranslations("admin.reports");
  const { me } = useAdmin();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const decision = report.decision;
  if (!decision || decision.action === "dismiss" || !report.account) return null;
  const account = report.account;
  const action = decision.action;
  const what = action === "hide_block" ? t("outcome.hide_block", { block: decision.blockLabel ?? "" }) : t(`outcome.${action}`);
  const submit = async () => {
    setBusy(true);
    const lifted = await moderationTeam.lift({ customer: account.id, decision: decision.id, action, reason: reason.trim(), actor: me.email, username: account.username });
    setBusy(false);
    toast(lifted ? { title: t("toast.lifted"), tone: "success" } : { title: t("toast.failed"), tone: "danger" });
    if (lifted) onClose();
  };
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.markup("inForce.liftTitle", { what, bdi: isolate })}
      description={t("inForce.liftBody")}
      confirmLabel={t("inForce.liftConfirm")}
      cancelLabel={t("dialog.cancel")}
      destructive={false}
      confirmDisabled={reason.trim().length < LIMITS.reason.min}
      loading={busy}
      initialFocus="first-field"
      onConfirm={() => void submit()}
    >
      <TextArea label={t("inForce.liftReason")} value={reason} onValue={setReason} max={LIMITS.reason.max} rows={3} required />
    </ConfirmDialog>
  );
}

function ReportCard({ report, now, onDecide, onLift }: { report: Report; now: number | null; onDecide: () => void; onLift: () => void }) {
  const t = useTranslations("admin.reports");
  const locale = useLocale();
  const { can } = useAdmin();
  const headingId = useId();
  const late = report.state === "open" && now !== null && overdue(report, now);
  const due = new Date(dueAt(report)).toISOString();
  const decision = report.decision;
  const restricted = decision !== null && decision.action !== "dismiss" && decision.liftedAt === null && report.account !== null;
  return (
    <article aria-labelledby={headingId} data-report={report.id} className="grid min-w-0 grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 id={headingId} className="text-title min-w-0 break-all rtl:tracking-normal">
            <bdi dir="ltr">{pageAddress(report.page)}</bdi>
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-fg-secondary">
            <Badge size="sm" tone="outline">
              {t(`categories.${report.category}`)}
            </Badge>
            <span>{t.rich("received", { when: now === null ? dateTime(report.receivedAt, locale) : timeAgo(report.receivedAt, now, locale), bdi })}</span>
          </p>
        </div>
        {late ? (
          <Badge tone="danger" dot>
            {t("overdueBadge")}
          </Badge>
        ) : null}
      </div>

      {report.state === "open" ? (
        <p className={cn("flex items-center gap-2 text-small", late ? "font-semibold text-danger-strong" : "text-fg-secondary")}>
          <Icon icon={Clock} size="sm" className="shrink-0" />
          <span>
            {late ? t.rich("overdue", { when: dateTime(due, locale), bdi }) : t.rich("due", { when: dateTime(due, locale), bdi })}
            {" · "}
            {t.rich("sla", { hours: REPORT_SLA_HOURS[report.category], bdi })}
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {report.account === null ? <Badge tone="neutral">{t("noAccount")}</Badge> : null}
        {report.account?.status === "suspended" ? <Badge tone="danger">{t("suspended")}</Badge> : null}
        {report.account?.offline ? <Badge tone="warning">{t("offline")}</Badge> : null}
      </div>

      {report.purged ? (
        <p className="text-small text-fg-secondary">{t.rich("purged", { days: PURGE_DAYS, bdi })}</p>
      ) : (
        <dl className="grid grid-cols-1 gap-3">
          <div className="grid gap-1">
            <dt className="text-caption text-fg-tertiary">{t("explanation")}</dt>
            {/* The reporter's own words, in their language and direction. */}
            <dd lang={report.locale} dir="auto" className="whitespace-pre-line break-words rounded-md bg-canvas-muted p-3 text-body">
              {report.explanation}
            </dd>
          </div>
          {report.url ? (
            <div className="grid gap-1">
              <dt className="text-caption text-fg-tertiary">{t("link")}</dt>
              <dd dir="ltr" className="break-all text-start text-small">
                {report.url}
              </dd>
            </div>
          ) : null}
          <div className="grid gap-1">
            <dt className="text-caption text-fg-tertiary">{t("reporter")}</dt>
            <dd className="text-small">
              {report.reporterName || report.reporterEmail ? (
                <>
                  {report.reporterName ? <bdi>{report.reporterName}</bdi> : null}
                  {report.reporterName && report.reporterEmail ? " · " : null}
                  {report.reporterEmail ? (
                    <bdi dir="ltr" className="break-all">
                      {report.reporterEmail}
                    </bdi>
                  ) : null}
                </>
              ) : (
                <span className="text-fg-secondary">{t("anonymous")}</span>
              )}
            </dd>
          </div>
        </dl>
      )}

      {decision ? (
        <div className="grid gap-2 rounded-md border border-line p-3">
          <p className="flex flex-wrap items-center gap-2 text-small font-semibold">
            <Icon icon={DECISION_ICONS[decision.action]} size="sm" className="shrink-0" />
            {decision.action === "hide_block" ? t.rich("outcome.hide_block", { block: decision.blockLabel ?? "", bdi }) : t(`outcome.${decision.action}`)}
            {decision.ground ? (
              <Badge size="sm" tone="outline">
                {t(`grounds.${decision.ground}`)}
              </Badge>
            ) : null}
          </p>
          <p className="whitespace-pre-line break-words text-small">{decision.reason}</p>
          <p className="text-caption text-fg-secondary">
            {t.rich("decidedBy", { who: decision.by || "–", when: dateTime(decision.at, locale), bdi })}
            {decision.liftedAt ? (
              <>
                {" · "}
                {t.rich("liftedAt", { when: dateTime(decision.liftedAt, locale), bdi })}
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {report.state === "open" ? (
          <Button variant="primary" icon={Gavel} onClick={onDecide}>
            {t("decide")}
          </Button>
        ) : null}
        {restricted ? (
          <Button variant="secondary" onClick={onLift}>
            {t("inForce.lift")}
          </Button>
        ) : null}
        {/* Real pages only: the demo's sample pages are made up and live nowhere. */}
        {supabaseEnabled && report.account && !report.account.offline && report.account.status === "active" ? (
          <a
            href={pageUrl(report.account.username)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-touch-target items-center gap-1 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
          >
            {t("openPage")}
            <Icon icon={icons.external} size="sm" />
          </a>
        ) : null}
        {/* Real accounts only: the demo's sample pages are not among the sample customers. */}
        {supabaseEnabled && report.account && can("customers.view") ? (
          <Link
            href={`/admin/customers/${report.account.id}`}
            className="inline-flex min-h-touch-target items-center gap-1 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
          >
            {t("openCustomer")}
            <Icon icon={ArrowRight} size="sm" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** This year's figures, for the transparency report. */
function YearPanel() {
  const t = useTranslations("admin.reports");
  const locale = useLocale();
  const { counts, status } = useYearCounts();
  if (status !== "ready" || !counts) return null;
  const decided = Object.values(counts.byAction).reduce((sum, value) => sum + value, 0);
  const restricted = (counts.byAction.hide_block ?? 0) + (counts.byAction.unpublish ?? 0) + (counts.byAction.suspend ?? 0);
  const figures: [string, string][] = [
    [t("year.received"), count(counts.received, locale)],
    [t("year.decided"), count(decided, locale)],
    [t("year.restricted"), count(restricted, locale)],
    [t("year.lifted"), count(counts.lifted, locale)],
    [t("year.median"), counts.medianHours === null ? t("year.none") : t.markup("year.hours", { hours: new Intl.NumberFormat(locale).format(counts.medianHours), bdi: isolate })],
  ];
  return (
    <Panel title={t.markup("year.title", { year: String(counts.year), bdi: isolate })} id="reports-year">
      <p className="text-small text-fg-secondary">{t("year.note")}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {figures.map(([term, value]) => (
          <div key={term} className="grid min-w-0 content-start gap-0.5">
            <dt className="text-caption text-fg-tertiary">{term}</dt>
            <dd className="text-title tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function ReportsScreen() {
  const t = useTranslations("admin.reports");
  const tc = useTranslations("admin.customers");
  const locale = useLocale();
  const { can } = useAdmin();
  const now = useNow();
  const allowed = can("reports.manage");
  const [tab, setTab] = useState<"open" | "decided">("open");
  const open = useReports("open", allowed);
  const decided = useReports("decided", allowed && tab === "decided");
  const [deciding, setDeciding] = useState<Report | null>(null);
  const [lifting, setLifting] = useState<Report | null>(null);

  if (!allowed) {
    return (
      <Screen title={t("title")} lead={t("hidden")}>
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-line-strong p-8 text-center">
          <Icon icon={EyeOff} size="lg" className="text-fg-tertiary" />
          <Button asChild icon={icons.back}>
            <Link href="/admin">{tc("toOverview")}</Link>
          </Button>
        </div>
      </Screen>
    );
  }
  if (open.status === "unavailable") {
    return (
      <Screen title={t("title")}>
        <Empty text={t("notAvailable")} />
      </Screen>
    );
  }
  const shown = tab === "open" ? open : decided;
  return (
    <Screen title={t("title")} lead={t.rich("lead", { bdi })} grow>
      <Segmented
        label={t("title")}
        value={tab}
        onValueChange={setTab}
        className={cn("justify-self-start", touchSegmented)}
        formatCount={(value) => count(value, locale)}
        options={[
          { value: "open", label: t("tabs.open"), ...(open.status === "ready" ? { count: open.reports.length } : {}) },
          { value: "decided", label: t("tabs.decided") },
        ]}
      />
      {shown.status === "loading" ? (
        <div className="grid justify-items-center p-8">
          <Spinner />
        </div>
      ) : shown.status === "error" ? (
        <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-line-strong p-8 text-center">
          <p className="text-body text-fg-secondary">{t("loadFailed")}</p>
          <Button variant="secondary" icon={icons.refresh} onClick={() => shown.reload()}>
            {t("retry")}
          </Button>
        </div>
      ) : shown.reports.length === 0 ? (
        <Empty text={t(`empty.${tab}`)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {shown.reports.map((report) => (
            <ReportCard key={report.id} report={report} now={now} onDecide={() => setDeciding(report)} onLift={() => setLifting(report)} />
          ))}
        </div>
      )}
      <YearPanel />
      {supabaseEnabled ? null : (
        <p className="flex items-start gap-2 rounded-md bg-canvas-muted px-3 py-2 text-small text-fg-secondary">
          <Icon icon={icons.info} size="sm" className="mt-0.5 shrink-0" />
          <span>{t("demo")}</span>
        </p>
      )}
      {deciding ? <DecisionDialog report={deciding} onClose={() => setDeciding(null)} /> : null}
      {lifting ? <LiftDialog report={lifting} onClose={() => setLifting(null)} /> : null}
    </Screen>
  );
}
