import { describe, expect, it } from "vitest";

import { mayBeAnonymous, pageFromInput, reportInputSchema, reportProblems, urlFromInput } from "./form";

const filled = { page: "linkyo.app/mila", category: "fraud" as const, explanation: "The ticket link sells tickets that do not exist.", name: "Kai Example", email: "kai@example.com", goodFaith: true };

describe("the page a visitor means", () => {
  it("reads a name, an @name, an address, a project address and the internal path", () => {
    expect(pageFromInput("mila")).toBe("mila");
    expect(pageFromInput("  @Mila ")).toBe("mila");
    expect(pageFromInput("linkyo.app/mila")).toBe("mila");
    expect(pageFromInput("https://linkyo.app/mila/hafenlicht?src=qr")).toBe("mila");
    expect(pageFromInput("http://localhost:3201/mila-berg")).toBe("mila-berg");
    expect(pageFromInput("https://linkyo.app/u/mila")).toBe("mila");
  });

  it("finds no page in an example address, a path without one or text that is no address", () => {
    expect(pageFromInput("https://linkyo.app/de/p/elena-novak")).toBeNull();
    expect(pageFromInput("https://linkyo.app/")).toBeNull();
    expect(pageFromInput("")).toBeNull();
    expect(pageFromInput("not a page")).toBeNull();
    expect(pageFromInput("../admin")).toBeNull();
  });

  it("keeps the exact address only when one was given", () => {
    expect(urlFromInput("https://linkyo.app/mila/hafenlicht")).toBe("https://linkyo.app/mila/hafenlicht");
    expect(urlFromInput("mila")).toBeNull();
    expect(urlFromInput("javascript:alert(1)")).toBeNull();
    expect(urlFromInput(`https://linkyo.app/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("the form's checks (as submit_report checks)", () => {
  it("accepts a complete report", () => {
    expect(reportProblems(filled)).toEqual([]);
  });

  it("names each field to correct, in the form's order", () => {
    expect(reportProblems({ page: "", category: "", explanation: "short", name: "", email: "x", goodFaith: false })).toEqual(["page", "category", "explanation", "name", "email", "goodFaith"]);
    expect(reportProblems({ ...filled, explanation: "x".repeat(4001) })).toEqual(["explanation"]);
    expect(reportProblems({ ...filled, name: "K" })).toEqual(["name"]);
  });

  it("lets a report about the abuse of minors come without a name and an address (Art. 16(2)(c) DSA)", () => {
    expect(mayBeAnonymous("minors")).toBe(true);
    expect(mayBeAnonymous("fraud")).toBe(false);
    expect(reportProblems({ ...filled, category: "minors", name: "", email: "" })).toEqual([]);
    expect(reportProblems({ ...filled, category: "minors", name: "", email: "not-an-address" })).toEqual(["email"]);
    expect(reportProblems({ ...filled, name: "", email: "" })).toEqual(["name", "email"]);
  });

  it("parses exactly the fields the form sends", () => {
    expect(reportInputSchema.safeParse({ ...filled, locale: "ar" }).success).toBe(true);
    expect(reportInputSchema.safeParse({ ...filled, ip: "192.0.2.1" }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...filled, category: "spam" }).success).toBe(false);
  });
});
