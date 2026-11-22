import { describe, expect, it } from "vitest";

import { aiConfigured, assertAnthropicBaseUrl } from "./config";

describe("AI configuration", () => {
  it("runs only with real accounts, AI_ENABLED=1 and a key", () => {
    expect(aiConfigured({ AI_ENABLED: "1", ANTHROPIC_API_KEY: "sk-ant-local-test" }, true)).toBe(true);
    expect(aiConfigured({ AI_ENABLED: "1", ANTHROPIC_API_KEY: "sk-ant-local-test" }, false)).toBe(false);
    expect(aiConfigured({ ANTHROPIC_API_KEY: "sk-ant-local-test" }, true)).toBe(false);
    expect(aiConfigured({ AI_ENABLED: "true", ANTHROPIC_API_KEY: "sk-ant-local-test" }, true)).toBe(false);
    expect(aiConfigured({ AI_ENABLED: "1" }, true)).toBe(false);
  });

  it("lets the SDK talk only to Anthropic, or to a local mock off Vercel", () => {
    expect(() => {
      assertAnthropicBaseUrl({});
    }).not.toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "https://api.anthropic.com" });
    }).not.toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "https://api.anthropic.com", VERCEL: "1" });
    }).not.toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "http://127.0.0.1:55103" });
    }).not.toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "http://localhost:55103" });
    }).not.toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "http://127.0.0.1:55103", VERCEL: "1" });
    }).toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "https://proxy.example.com" });
    }).toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "http://api.anthropic.com" });
    }).toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "https://api.anthropic.com.evil.example" });
    }).toThrow();
    expect(() => {
      assertAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "not a url" });
    }).toThrow();
  });
});
