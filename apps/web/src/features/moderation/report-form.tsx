"use client";

import { Button, cn, Icon, icons, TextField } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type SyntheticEvent } from "react";

import { TextArea } from "@/features/app/form";
import { clockTime, shortDate, type EmailLocale } from "@/features/email/templates/render";

import { mayBeAnonymous, reportProblems, type ReportField } from "./form";
import { LIMITS, PURGE_DAYS, REPORT_CATEGORIES, type ReportCategory } from "./types";

const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

/** The legal promise's marker, as the website's other pages show it (features/marketing/pages/review.ts). */
function Marker({ text }: { text: string }) {
  return (
    <bdi lang="de" data-review-marker className="font-semibold text-fg">
      {text}
    </bdi>
  );
}

interface Done {
  reference: string;
  receivedAt: string;
  mailed: boolean;
  duplicate: boolean;
  email: string;
}

const noop = () => () => undefined;
/** The address the footer's link carried (`?url=`, or `?page=`), read in the browser; "" on the server. */
const linked = () => {
  const query = new URLSearchParams(window.location.search);
  return (query.get("url") ?? query.get("page") ?? "").slice(0, LIMITS.url.max);
};

const FIELD_ORDER: readonly ReportField[] = ["page", "category", "explanation", "name", "email", "goodFaith"];

/** Focuses a field by its wrapper's or its own id: the first input, textarea or radio inside it. */
function focusField(id: string): void {
  const element = document.getElementById(id);
  const field = element?.matches("input, textarea") ? element : element?.querySelector<HTMLElement>("input, textarea");
  field?.focus();
}

/**
 * The report form (/melden, DSA Art. 16): where the content is, what it is about, why, who reports and
 * the good-faith statement; then the receipt with its number, date and time. No cookie, nothing kept in
 * the browser, nothing loaded from another host. The page's address comes from the footer's link
 * (`?page=` and `?url=`), read once in the browser so the page itself stays static.
 */
export function ReportForm({ contact, markers }: { contact: string; markers: { privacy: string | null; process: string | null } }) {
  const t = useTranslations("report");
  const locale = useLocale() as EmailLocale;
  // Untouched (null), the field shows the address the footer's link carried.
  const [pageInput, setPage] = useState<string | null>(null);
  const prefill = useSyncExternalStore(noop, linked, () => "");
  const page = pageInput ?? prefill;
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [explanation, setExplanation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [problems, setProblems] = useState<ReportField[]>([]);
  const [failure, setFailure] = useState<"server" | "tooMany" | "unavailable" | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const ids = useId();
  const anonymous = mayBeAnonymous(category);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const error = (field: ReportField) => (problems.includes(field) ? t.markup(`errors.${field}`, { min: LIMITS.explanation.min, bdi: (chunks) => chunks }) : undefined);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = reportProblems({ page, category, explanation, name, email, goodFaith });
    setProblems(found);
    setFailure(null);
    if (found.length > 0) {
      // The first field to correct takes focus; the summary above the button says how many.
      const first = FIELD_ORDER.find((field) => found.includes(field));
      focusField(`${ids}-${first ?? "page"}`);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, category, explanation, name, email, goodFaith, locale }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: unknown; reference?: unknown; receivedAt?: unknown; mailed?: unknown; duplicate?: unknown; fields?: unknown } | null;
      if (response.status === 201 && data?.ok === true && typeof data.reference === "string" && typeof data.receivedAt === "string") {
        setDone({ reference: data.reference, receivedAt: data.receivedAt, mailed: data.mailed === true, duplicate: data.duplicate === true, email: email.trim() });
        return;
      }
      if (response.status === 400 && Array.isArray(data?.fields)) {
        const fields = (data.fields as unknown[]).filter((field): field is ReportField => FIELD_ORDER.includes(field as ReportField));
        setProblems(fields.length > 0 ? fields : ["explanation"]);
        focusField(`${ids}-${fields[0] ?? "explanation"}`);
        return;
      }
      setFailure(response.status === 429 ? "tooMany" : response.status === 409 ? "unavailable" : "server");
    } catch {
      setFailure("server");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setDone(null);
    setCategory("");
    setExplanation("");
    setGoodFaith(false);
    setProblems([]);
  };

  if (done) {
    const at = new Date(done.receivedAt);
    return (
      <div className="grid gap-4" data-report-done>
        <h2 ref={doneRef} tabIndex={-1} className="text-h3 text-balance outline-none">
          {t("done.title")}
        </h2>
        <p className="text-body text-pretty">{t.rich("done.body", { date: shortDate(at, locale), time: clockTime(at, locale), reference: done.reference, bdi })}</p>
        {done.duplicate ? <p className="text-body text-pretty text-fg-secondary">{t("done.duplicate")}</p> : null}
        <p className="text-body text-pretty text-fg-secondary">
          {done.email === "" ? t("done.anonymous") : done.mailed ? t.rich("done.mailed", { email: done.email, bdi }) : t("done.held")}
        </p>
        <Button type="button" variant="secondary" size="lg" icon={icons.add} className="justify-self-start" onClick={restart}>
          {t("done.another")}
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-6" aria-describedby={`${ids}-process`}>
      <TextField
        id={`${ids}-page`}
        label={t("form.page")}
        hint={t.rich("form.pageHint", { bdi })}
        value={page}
        onChange={(event) => setPage(event.target.value)}
        maxLength={LIMITS.url.max}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="url"
        ltr
        size="auto"
        error={error("page")}
        required
        live
      />

      <fieldset
        id={`${ids}-category`}
        aria-describedby={problems.includes("category") ? `${ids}-category-error` : undefined}
        className="grid grid-cols-1 gap-2"
      >
        <legend className="pb-2 text-small text-fg">{t("form.category")}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {REPORT_CATEGORIES.map((value) => (
            <label
              key={value}
              className={cn(
                "flex min-h-touch-target cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-small transition-colors duration-micro motion-reduce:transition-none",
                category === value ? "border-line-input bg-selected font-semibold" : "border-line hover:bg-hover",
              )}
            >
              <input
                type="radio"
                name={`${ids}-category-choice`}
                value={value}
                checked={category === value}
                onChange={() => setCategory(value)}
                required
                className="size-icon-sm shrink-0 focus-visible:focus-ring"
              />
              {t(`form.categories.${value}`)}
            </label>
          ))}
        </div>
        {problems.includes("category") ? (
          <p id={`${ids}-category-error`} className="flex items-start gap-2 text-small text-danger-strong">
            <Icon icon={icons.error} size="sm" className="mt-0.5 shrink-0" />
            {t("errors.category")}
          </p>
        ) : null}
      </fieldset>

      <div id={`${ids}-explanation`} className="grid">
      <TextArea
        label={t("form.explanation")}
        hint={t.markup("form.explanationHint", { min: LIMITS.explanation.min, bdi: (chunks) => chunks })}
        value={explanation}
        onValue={setExplanation}
        max={LIMITS.explanation.max}
        rows={5}
        error={error("explanation")}
        required
      />
      </div>

      {anonymous ? <p className="rounded-md bg-canvas-muted p-3 text-small text-pretty text-fg-secondary">{t("form.anonymous")}</p> : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TextField
          id={`${ids}-name`}
          label={anonymous ? `${t("form.name")} (${t("form.optional")})` : t("form.name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={LIMITS.name.max}
          autoComplete="name"
          size="auto"
          error={error("name")}
          required={!anonymous}
          live
        />
        <TextField
          id={`${ids}-email`}
          type="email"
          label={anonymous ? `${t("form.email")} (${t("form.optional")})` : t("form.email")}
          hint={t("form.emailHint")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={LIMITS.email.max}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          ltr
          size="auto"
          error={error("email")}
          required={!anonymous}
          live
        />
      </div>

      <div className="grid gap-2">
        <label className="flex min-h-touch-target cursor-pointer items-start gap-3 text-body text-pretty">
          <input
            id={`${ids}-goodFaith`}
            type="checkbox"
            checked={goodFaith}
            onChange={(event) => setGoodFaith(event.target.checked)}
            aria-invalid={problems.includes("goodFaith") ? true : undefined}
            aria-describedby={problems.includes("goodFaith") ? `${ids}-goodFaith-error` : undefined}
            required
            className="mt-1 size-icon-sm shrink-0 focus-visible:focus-ring"
          />
          {t("form.goodFaith")}
        </label>
        {problems.includes("goodFaith") ? (
          <p id={`${ids}-goodFaith-error`} className="flex items-start gap-2 text-small text-danger-strong">
            <Icon icon={icons.error} size="sm" className="mt-0.5 shrink-0" />
            {t("errors.goodFaith")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-md bg-canvas-muted p-4 text-small text-pretty text-fg-secondary">
        <p id={`${ids}-process`}>
          {t("form.process")}
          {markers.process ? (
            <>
              {" "}
              <Marker text={markers.process} />
            </>
          ) : null}
        </p>
        <p>
          {t.rich("form.privacy", { days: PURGE_DAYS, bdi })}
          {markers.privacy ? (
            <>
              {" "}
              <Marker text={markers.privacy} />
            </>
          ) : null}
        </p>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {problems.length > 0 ? (
          <p className="flex items-start gap-2 text-body text-danger-strong">
            <Icon icon={icons.error} size="md" className="mt-0.5 shrink-0" />
            {t("errors.summary", { count: problems.length })}
          </p>
        ) : null}
        {failure ? (
          <p role="alert" className="flex items-start gap-2 text-body text-danger-strong">
            <Icon icon={icons.error} size="md" className="mt-0.5 shrink-0" />
            <span>{failure === "unavailable" ? t.rich("errors.unavailable", { email: contact, bdi }) : t(`errors.${failure}`)}</span>
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="primary" size="cta" icon={icons.send} loading={busy} className="justify-self-stretch sm:justify-self-start">
        {t("form.submit")}
      </Button>
    </form>
  );
}
