import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import Anthropic from "@anthropic-ai/sdk";
import { PAGE_PLAN_JSON_SCHEMA, pagePlanSchema } from "@linkyo/blocks/ai-plan";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { handle, requests } from "../../../../e2e/mocks/anthropic.handler.mjs";

import { ClaudeCallError, createClaudeClient, createPlanCaller, FALLBACK_BETA, MODEL, planRequest } from "./claude";
import { CATALOGUE_AND_EXAMPLE_V1, SYSTEM_CORE_V1, type PromptText } from "./prompts";

// The real SDK against the local mock Messages API (never the real API): its 400 guard proves the
// request carries exactly the fields the builder must send.

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const useMock = () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-local-test");
  vi.stubEnv("ANTHROPIC_BASE_URL", baseUrl);
  vi.stubEnv("VERCEL", "");
};

const turn = (fixture: string, tag: string): PromptText[] => [
  { type: "text", text: "<task>page language: de; owner language: de; photo colours: none; newsletter: no; kind chosen by owner: none</task>" },
  { type: "text", text: `<owner>{"text":"Ich mache Musik. [[fixture:${fixture}#${tag}]]"}</owner>` },
  { type: "text", text: '<sources>{"links":[],"profile":{}}</sources>' },
];

const callsFor = async (tag: string) => ((await (await fetch(`${baseUrl}/__calls?tag=${tag}`)).json()) as { count: number }).count;

const request = (tag: string) => requests.find((entry: { tag: string }) => entry.tag === tag) as { headers: Record<string, string>; body: Record<string, unknown> } | undefined;

describe("Claude client", { timeout: 20_000 }, () => {
  it("streams a plan with the exact request: model, cap, fallback, effort, schema, two system blocks (the second cached), one user turn", async () => {
    useMock();
    const deltas: string[] = [];
    const result = await createPlanCaller().call({ effort: "medium", maxTokens: 16_000, content: turn("de-music", "exact"), signal: new AbortController().signal, onText: (delta) => deltas.push(delta) });
    expect(result.stopReason).toBe("end_turn");
    expect(result.model).toBe(MODEL);
    expect(result.fallback).toBe(false);
    expect(deltas.length).toBeGreaterThan(20);
    expect(deltas.join("")).toBe(result.text);
    expect(pagePlanSchema.safeParse(JSON.parse(result.text)).success).toBe(true);
    expect(result.usage).toEqual({ input: 812, cacheRead: 3605, cacheWrite: 0, output: 2911 });
    expect(result.costMicros).toBe(812 * 4 + 3605 * 0.2 + 2911 * 20);
    expect(result.requestId).toMatch(/^req_mock_/);

    const sent = request("exact");
    expect(sent).toBeDefined();
    const body = sent?.body ?? {};
    expect(Object.keys(body).sort()).toEqual(["fallbacks", "max_tokens", "messages", "model", "output_config", "stream", "system"]);
    expect(body).toMatchObject({ model: "claude-opus-5-5", max_tokens: 16_000, stream: true, fallbacks: "default", output_config: { effort: "medium", format: { type: "json_schema", schema: PAGE_PLAN_JSON_SCHEMA } } });
    expect(body.system).toEqual([
      { type: "text", text: SYSTEM_CORE_V1 },
      { type: "text", text: CATALOGUE_AND_EXAMPLE_V1, cache_control: { type: "ephemeral" } },
    ]);
    expect(body.messages).toEqual([{ role: "user", content: turn("de-music", "exact") }]);
    for (const field of ["thinking", "temperature", "top_p", "top_k", "tools", "tool_choice", "betas"]) expect(body).not.toHaveProperty(field);
    expect(sent?.headers["anthropic-beta"]).toContain(FALLBACK_BETA);
    expect(await callsFor("exact")).toBe(1);
  });

  it("builds the same request object it sends", () => {
    const content = turn("de-music", "shape");
    expect(planRequest({ effort: "high", maxTokens: 32_000, content })).toEqual({
      model: MODEL,
      max_tokens: 32_000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: PAGE_PLAN_JSON_SCHEMA } },
      system: [
        { type: "text", text: SYSTEM_CORE_V1 },
        { type: "text", text: CATALOGUE_AND_EXAMPLE_V1, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content }],
    });
  });

  it("the mock refuses a request without the fallback (its guard checks every field)", async () => {
    useMock();
    const client = createClaudeClient();
    const { fallbacks: _dropped, ...withoutFallback } = planRequest({ effort: "medium", maxTokens: 1_000, content: turn("de-music", "guard") });
    await expect(client.beta.messages.stream(withoutFallback).finalMessage()).rejects.toBeInstanceOf(Anthropic.BadRequestError);
    await expect(client.beta.messages.stream({ ...planRequest({ effort: "medium", maxTokens: 1_000, content: turn("de-music", "guard2") }), temperature: 1 }).finalMessage()).rejects.toBeInstanceOf(Anthropic.BadRequestError);
  });

  it("joins the text around a fallback block and prices both attempts, each by its own model", async () => {
    useMock();
    const result = await createPlanCaller().call({ effort: "medium", maxTokens: 16_000, content: turn("fallback", "fallback"), signal: new AbortController().signal });
    expect(result.fallback).toBe(true);
    expect(result.model).toBe("claude-opus-5");
    expect(pagePlanSchema.safeParse(JSON.parse(result.text)).success).toBe(true);
    // The declined attempt (812 in, 3,605 cached, 900 out) and the fallback's (812 in, 2,011 out).
    expect(result.costMicros).toBe(Math.ceil(812 * 4 + 3605 * 0.2 + 900 * 20 + (812 * 5 + 2011 * 25)));
    expect(result.usage).toEqual({ input: 1624, cacheRead: 3605, cacheWrite: 0, output: 2911 });
  });

  it("reports a refusal as its stop reason", async () => {
    useMock();
    const result = await createPlanCaller().call({ effort: "medium", maxTokens: 16_000, content: turn("refusal", "refusal"), signal: new AbortController().signal });
    expect(result.stopReason).toBe("refusal");
  });

  it.each([
    ["status-429", "busy", false, 2],
    ["status-529", "busy", false, 2],
    ["status-500", "busy", false, 2],
    ["status-spend", "budget", true, 1],
  ] as const)("maps %s to %s (typed SDK errors; one retry where it helps)", async (fixture, code, spendLimit, calls) => {
    useMock();
    const tag = `err-${fixture}`;
    const failure = await createPlanCaller()
      .call({ effort: "medium", maxTokens: 16_000, content: turn(fixture, tag), signal: new AbortController().signal })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(failure).toBeInstanceOf(ClaudeCallError);
    expect(failure).toMatchObject({ code, spendLimit });
    expect(await callsFor(tag)).toBe(calls);
  });

  it("maps an abort (deadline or stop) to 'aborted'", async () => {
    useMock();
    const controller = new AbortController();
    setTimeout(() => {
      controller.abort();
    }, 200);
    // The stream had begun: what its first event said about the input comes with the error.
    await expect(createPlanCaller().call({ effort: "medium", maxTokens: 16_000, content: turn("slow", "abort"), signal: controller.signal })).rejects.toMatchObject({
      code: "aborted",
      cutOff: { input: 812, cacheRead: 3605, cacheWrite: 0, attempts: 1 },
    });
  });

  it("an abort before the answer begins carries no usage", async () => {
    useMock();
    const controller = new AbortController();
    controller.abort();
    await expect(createPlanCaller().call({ effort: "medium", maxTokens: 16_000, content: turn("slow", "abort-first"), signal: controller.signal })).rejects.toMatchObject({ code: "aborted", cutOff: null });
  });

  it("counts the attempts of a cut-off stream: one more after a fallback block", async () => {
    useMock();
    const controller = new AbortController();
    let text = "";
    const cut = createPlanCaller()
      .call({
        effort: "medium",
        maxTokens: 16_000,
        content: turn("fallback", "abort-fallback"),
        signal: controller.signal,
        onText: (delta) => {
          // The notes come after the fixture's fallback block, in the second model's half of the plan.
          text += delta;
          if (text.includes('"notes"')) controller.abort();
        },
      })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(await cut).toMatchObject({ code: "aborted", cutOff: { input: 812, cacheRead: 3605, attempts: 2 } });
  });

  it("refuses to create a client for a base URL that is not Anthropic's (a local mock only off Vercel)", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-local-test");
    vi.stubEnv("ANTHROPIC_BASE_URL", baseUrl);
    vi.stubEnv("VERCEL", "1");
    expect(() => createClaudeClient()).toThrow(/ANTHROPIC_BASE_URL/);
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://api.anthropic.com");
    expect(() => createClaudeClient()).not.toThrow();
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://proxy.example.com");
    vi.stubEnv("VERCEL", "");
    expect(() => createClaudeClient()).toThrow(/ANTHROPIC_BASE_URL/);
  });
});
