import { describe, expect, it, vi } from "vitest";

import { emailTranslator } from "@/features/email/templates/render";
import type { EmailMessage } from "@/features/email/types";
import de from "@/messages/de.json";

import { submitReport, type CleanReport, type SubmitDeps } from "./submit";

vi.mock("server-only", () => ({}));

const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const input = {
  page: "https://linkyo.app/Mila/hafenlicht",
  category: "privacy" as const,
  explanation: "  The text block shows my home address without my consent.  ",
  name: " Kai Example ",
  email: "Kai@Example.com",
  goodFaith: true,
  locale: "de" as const,
};

function deps(answer: Awaited<ReturnType<SubmitDeps["file"]>> | Error = { data: { id: ID, receivedAt: "2026-11-28T09:15:00Z", duplicate: false }, error: null }) {
  const filed: CleanReport[] = [];
  const sent: EmailMessage[] = [];
  const lines: Record<string, unknown>[] = [];
  const value: SubmitDeps = {
    file: (report) => {
      filed.push(report);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
    deliver: async (message) => {
      const built = await message();
      if (built) sent.push(built);
      return built !== null;
    },
    translator: () => Promise.resolve(emailTranslator("de", de)),
    log: (line) => lines.push(line),
  };
  return { value, filed, sent, lines };
}

describe("filing a report", () => {
  it("stores the page, the exact address and the trimmed words, then sends the receipt (Art. 16(4) DSA)", async () => {
    const { value, filed, sent } = deps();
    const answer = await submitReport(input, value);
    expect(answer).toEqual({ status: 201, body: { ok: true, id: ID, reference: "7C9E6679", receivedAt: "2026-11-28T09:15:00Z", duplicate: false, mailed: true } });
    expect(filed).toEqual([
      {
        page: "mila",
        url: "https://linkyo.app/Mila/hafenlicht",
        category: "privacy",
        explanation: "The text block shows my home address without my consent.",
        name: "Kai Example",
        email: "kai@example.com",
        locale: "de",
      },
    ]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("kai@example.com");
    expect(sent[0]?.tag).toBe("report-receipt");
    expect(sent[0]?.text).toContain("Wir haben deine Meldung zur Seite mila am 28.11.2026 um 10:15 Uhr erhalten. Ihre Nummer: 7C9E6679.");
  });

  it("sends no second receipt for a duplicate, and none to an anonymous report", async () => {
    const duplicate = deps({ data: { id: ID, receivedAt: "2026-11-28T09:15:00Z", duplicate: true }, error: null });
    expect((await submitReport(input, duplicate.value)).body).toMatchObject({ ok: true, duplicate: true, mailed: false });
    expect(duplicate.sent).toEqual([]);
    const anonymous = deps();
    expect((await submitReport({ ...input, category: "minors", name: "", email: "" }, anonymous.value)).body).toMatchObject({ ok: true, mailed: false });
    expect(anonymous.filed[0]).toMatchObject({ name: null, email: null });
    expect(anonymous.sent).toEqual([]);
  });

  it("refuses what the database would refuse, before asking it", async () => {
    const { value, filed } = deps();
    expect(await submitReport({ ...input, page: "https://linkyo.app/de/p/elena-novak" }, value)).toEqual({ status: 400, body: { ok: false, error: "invalid", fields: ["page"] } });
    expect(await submitReport({ ...input, explanation: "short", goodFaith: false }, value)).toEqual({ status: 400, body: { ok: false, error: "invalid", fields: ["explanation", "goodFaith"] } });
    expect(filed).toEqual([]);
  });

  it("names the field the database refused", async () => {
    const { value } = deps({ data: null, error: { code: "P0001", message: "linkyo:invalid", hint: "email" } });
    expect(await submitReport(input, value)).toEqual({ status: 400, body: { ok: false, error: "invalid", fields: ["email"] } });
  });

  it("says reports cannot be taken where the database has no function or the server no key: 409, never a 500", async () => {
    expect((await submitReport(input, deps({ data: null, error: { code: "PGRST202", message: "Could not find the function public.submit_report" } }).value)).status).toBe(409);
    expect((await submitReport(input, deps(new Error("SUPABASE_SECRET_KEY is not set")).value)).body).toEqual({ ok: false, error: "unavailable" });
  });

  it("logs any other failure without the reporter's name, address or words", async () => {
    const { value, lines } = deps({ data: null, error: { code: "XX000", message: "boom kai@example.com" } });
    expect(await submitReport(input, value)).toEqual({ status: 500, body: { ok: false, error: "server" } });
    expect(lines).toEqual([{ evt: "report_failed", code: "XX000" }]);
    expect(JSON.stringify(lines)).not.toMatch(/kai|example|address/i);
  });
});
