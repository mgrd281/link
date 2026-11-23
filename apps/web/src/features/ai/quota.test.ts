import { afterEach, describe, expect, it, vi } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

// A build with real accounts, signed in (the demo never asks; that case is below).
const config = vi.hoisted<{ supabaseEnabled: boolean; token: string | null }>(() => ({ supabaseEnabled: true, token: "token" }));
vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return config.supabaseEnabled;
  },
}));
vi.mock("@/lib/supabase/access-token", () => ({ accessToken: () => Promise.resolve(config.token) }));

const { fetchQuota, OFF_MESSAGE, quotaFrom } = await import("./quota");

const answer = (body: unknown, status = 200) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));

afterEach(() => {
  vi.unstubAllGlobals();
  config.supabaseEnabled = true;
  config.token = "token";
});

describe("AI quota", () => {
  it("reads the drafts that are left", async () => {
    vi.stubGlobal("fetch", answer({ enabled: true, plan: "free", allowance: 1, used: 0, left: 1, period: "life", resetsAt: null }));
    expect(await fetchQuota()).toEqual({ status: "ready", quota: { plan: "free", allowance: 1, used: 0, left: 1, period: "life", resetsAt: null } });
  });

  // ux-8: every one of these used to be told "AI drafts need a real account", signed in to a real account.
  it("says why the AI is off: switched off, not set up, or the question failed", async () => {
    vi.stubGlobal("fetch", answer({ enabled: false, plan: "free", allowance: 1, used: 0, left: 1 }));
    expect(await fetchQuota()).toEqual({ status: "off", reason: "disabled" });
    vi.stubGlobal("fetch", answer({ ok: false, error: "notFound" }, 404));
    expect(await fetchQuota()).toEqual({ status: "off", reason: "disabled" });
    vi.stubGlobal("fetch", answer({ ok: false, error: "server" }, 500));
    expect(await fetchQuota()).toEqual({ status: "off", reason: "failed" });
    vi.stubGlobal("fetch", answer({ ok: false, error: "auth" }, 401));
    expect(await fetchQuota()).toEqual({ status: "off", reason: "failed" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    expect(await fetchQuota()).toEqual({ status: "off", reason: "failed" });
    config.token = null;
    expect(await fetchQuota()).toEqual({ status: "off", reason: "failed" });
    expect(quotaFrom(null)).toEqual({ status: "off", reason: "failed" });
    expect(quotaFrom({ plan: "free" })).toEqual({ status: "off", reason: "failed" });
  });

  it("never asks in the demo, where AI drafts need a real account", async () => {
    config.supabaseEnabled = false;
    const fetch = answer({ enabled: true });
    vi.stubGlobal("fetch", fetch);
    expect(await fetchQuota()).toEqual({ status: "off", reason: "demo" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("has a sentence for each reason, in every language; only the demo's speaks of real accounts", () => {
    expect(OFF_MESSAGE).toEqual({ demo: "unavailable", disabled: "errors.disabled", failed: "errors.server" });
    expect(de.app.ai.unavailable).toContain("echten Konten");
    for (const messages of [de, en, ar]) {
      const sentences = [messages.app.ai.errors.disabled, messages.app.ai.errors.server];
      for (const sentence of sentences) expect(sentence.length).toBeGreaterThan(10);
      expect(sentences).not.toContain(messages.app.ai.unavailable);
    }
    expect(de.app.ai.errors.disabled).not.toContain("echten Konten");
    expect(de.app.ai.errors.server).not.toContain("echten Konten");
  });
});
