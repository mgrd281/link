"use client";

import type { CreatorKind } from "@linkyo/blocks";
import { Icon } from "@linkyo/ui";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ImageInput, TextArea, TextInput } from "./form";
import { workImageKind } from "./images";
import { PROOF_SUMMARY_MAX, PROOF_TITLE_MAX, type ProofRow } from "./kinds";

/**
 * The welcome flow's portfolio parts (plan §1.7, WP7): the "work" step, three pieces of work a
 * designer, photographer, developer, engineer or freelancer is proud of, and what the done step says
 * was made of them. The "contact" step is the reach field (`reach-input.tsx`) in welcome-screen.tsx.
 */

/** Kinds that work in pictures get a cover per piece of work: their first page should not be one without pictures. */
const VISUAL_KINDS: ReadonlySet<CreatorKind> = new Set<CreatorKind>(["designer", "photographer"]);
export const asksForCovers = (kind: CreatorKind): boolean => VISUAL_KINDS.has(kind);

/** Three empty pieces of work: every one is optional, a started one needs a title and a sentence. */
export const emptyProof = (): ProofRow[] => [0, 1, 2].map(() => ({ title: "", summary: "" }));

/** The field a piece of work's problem points to, for focus ("Continue" leads to the first one). */
export const proofField = (index: number, problem: "title" | "summary"): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-proof="${String(index)}"] ${problem === "title" ? "input" : "textarea"}`);

export function ProofStep({
  kind,
  rows,
  onRows,
  problems,
  real,
}: {
  kind: CreatorKind;
  rows: readonly ProofRow[];
  onRows: (rows: ProofRow[]) => void;
  /** Shown after "Continue": a started piece of work without its title or its sentence. */
  problems: readonly ("title" | "summary" | null)[];
  /** Real accounts keep work pictures in Storage at full size; the demo keeps smaller ones in the browser. */
  real: boolean;
}) {
  const t = useTranslations("app.welcome.portfolio");
  const tErrors = useTranslations("app.errors");
  const covers = asksForCovers(kind);
  return (
    <ol className="grid grid-cols-1 gap-4">
      {rows.map((row, index) => {
        const n = index + 1;
        const change = (patch: Partial<ProofRow>) => onRows(rows.map((current, i) => (i === index ? { ...current, ...patch } : current)));
        const problem = problems[index] ?? null;
        return (
          // A card per piece of work: a hairline on the canvas, no shadow (ADR 0037).
          <li key={n} data-proof={index} className="grid min-w-0 grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-4 sm:p-5">
            <TextInput
              label={t("proofTitleN", { n })}
              value={row.title}
              onValue={(title) => change({ title })}
              maxLength={PROOF_TITLE_MAX}
              error={problem === "title" ? tErrors("required") : undefined}
            />
            <TextArea
              label={t("proofSentenceN", { n })}
              value={row.summary}
              onValue={(summary) => change({ summary })}
              max={PROOF_SUMMARY_MAX}
              rows={2}
              error={problem === "summary" ? tErrors("required") : undefined}
            />
            {covers ? (
              <ImageInput label={t("proofCoverN", { n })} image={row.cover} onImage={(cover) => change({ cover })} kind={workImageKind(real)} shape="wide" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** What the flow put on the page, counted from the blocks it made (never more than was made). */
export interface Made {
  projects: number;
  contact: string | null;
}

/** The done step's list for a portfolio: the projects and the contact button that are on the page now. */
export function PortfolioMade({ made }: { made: Made }) {
  const t = useTranslations("app.welcome.portfolio");
  if (made.projects === 0 && made.contact === null) return null;
  const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
  return (
    <ul aria-label={t("made")} className="grid gap-2 text-body">
      {made.projects > 0 ? (
        <li className="flex items-start gap-2">
          <Icon icon={Check} size="md" className="mt-0.5 shrink-0 text-success-strong" />
          {t("madeProjects", { count: made.projects })}
        </li>
      ) : null}
      {made.contact !== null ? (
        <li className="flex min-w-0 items-start gap-2">
          <Icon icon={Check} size="md" className="mt-0.5 shrink-0 text-success-strong" />
          <span className="min-w-0 break-words">{t.rich("madeContact", { label: made.contact, bdi })}</span>
        </li>
      ) : null}
    </ul>
  );
}
