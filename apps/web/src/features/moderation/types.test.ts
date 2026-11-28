import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DECISIONS, dueAt, GROUNDS, LIMITS, overdue, PURGE_DAYS, REPORT_CATEGORIES, REPORT_SLA_HOURS } from "./types";

const migration = readFileSync(join(process.cwd(), "../../supabase/migrations/20261128100000_reports.sql"), "utf8");
const quoted = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

describe("the contract matches the migration (20261128100000_reports.sql)", () => {
  it("names the same categories, decisions and grounds", () => {
    expect(migration).toContain(`category in (\n    ${quoted(REPORT_CATEGORIES)}\n  )`);
    expect(migration).toContain(`coalesce(submit_report.category, '') not in (${quoted(REPORT_CATEGORIES)})`);
    expect(migration).toContain(`action in (${quoted(DECISIONS)})`);
    expect(migration).toContain(`ground in (${quoted(GROUNDS)})`);
  });

  it("checks the same lengths and keeps reporters' details the same number of days", () => {
    expect(migration).toContain(`char_length(explanation) between ${String(LIMITS.explanation.min)} and ${String(LIMITS.explanation.max)}`);
    expect(migration).toContain(`char_length(reporter_name) between ${String(LIMITS.name.min)} and ${String(LIMITS.name.max)}`);
    expect(migration).toContain(`char_length(reason) between ${String(LIMITS.reason.min)} and ${String(LIMITS.reason.max)}`);
    expect(migration).toContain(`char_length(url) <= ${String(LIMITS.url.max)}`);
    expect(migration).toContain(`char_length(reporter_email) <= ${String(LIMITS.email.max)}`);
    expect(migration).toContain(`[a-z0-9-]{0,${String(LIMITS.page.max - 1)}}`);
    expect(migration).toContain(`now() - interval '${String(PURGE_DAYS)} days'`);
  });

  it("lets only the server file a report and only the moderation team read one", () => {
    expect(migration).toContain("grant execute on function public.submit_report(text, text, text, boolean, text, text, text, text) to service_role;");
    expect(migration).toContain("revoke execute on function public.submit_report(text, text, text, boolean, text, text, text, text) from public, anon, authenticated;");
    expect(migration).toContain("revoke all on public.reports from anon;");
    expect(migration).toContain("using (public.has_permission('reports.manage'))");
  });
});

describe("the team's target for a decision", () => {
  it("is a day for what can hurt people at once, three days for the rest", () => {
    expect(REPORT_CATEGORIES.filter((category) => REPORT_SLA_HOURS[category] === 24)).toEqual(["hate", "violence", "minors", "sexual"]);
    expect(REPORT_CATEGORIES.filter((category) => REPORT_SLA_HOURS[category] === 72)).toEqual(["fraud", "rights", "privacy", "impersonation", "other"]);
  });

  it("is due that many hours after the report arrived, and overdue from then on", () => {
    const report = { category: "hate" as const, receivedAt: "2026-11-28T10:00:00.000Z" };
    expect(new Date(dueAt(report)).toISOString()).toBe("2026-11-29T10:00:00.000Z");
    expect(overdue(report, Date.parse("2026-11-29T09:59:00Z"))).toBe(false);
    expect(overdue(report, Date.parse("2026-11-29T10:00:00Z"))).toBe(true);
  });
});
