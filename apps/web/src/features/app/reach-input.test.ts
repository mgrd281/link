import { blockSchema } from "@linkyo/blocks";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { reachFrom, reachIcon, reachPresets, reachUrl, REACH_WAYS } from "./reach-input";

const presetLabel = (messages: typeof de, locale: string, preset: string) =>
  createTranslator({ locale, messages, namespace: "app.portfolio.contact.presets" })(preset as "call");

/** The address must be one a contact block can store. */
const storable = (url: string) =>
  blockSchema.safeParse({ id: "c", type: "contact", visible: true, highlight: false, title: "Hi", primary: { label: "Go", url } }).success;

describe("reachUrl", () => {
  it("keeps a booking link a web address", () => {
    expect(reachUrl("calendar", "cal.example.com/ronja/intro")).toBe("https://cal.example.com/ronja/intro");
    expect(reachUrl("calendar", "https://cal.example.com/x")).toBe("https://cal.example.com/x");
  });

  it("makes an e-mail address a mailto link", () => {
    expect(reachUrl("email", "hallo@ronja.example")).toBe("mailto:hallo@ronja.example");
    expect(reachUrl("email", " mailto:hallo@ronja.example ")).toBe("mailto:hallo@ronja.example");
  });

  it("makes a WhatsApp number a wa.me link with digits only", () => {
    expect(reachUrl("whatsapp", "+49 151 2345-6789")).toBe("https://wa.me/4915123456789");
    expect(reachUrl("whatsapp", "(0151) 234 56 78")).toBe("https://wa.me/01512345678");
    expect(reachUrl("whatsapp", "https://wa.me/4915123456789")).toBe("https://wa.me/4915123456789");
  });

  it("makes a phone number a tel link", () => {
    expect(reachUrl("phone", "+49 30 1234567")).toBe("tel:+49301234567");
    expect(reachUrl("phone", "030 / 123 45 67")).toBe("tel:0301234567");
  });

  it("gives every way an address a contact block can store", () => {
    for (const url of [reachUrl("calendar", "cal.example.com/x"), reachUrl("email", "a@b.de"), reachUrl("whatsapp", "+49 151 23456789"), reachUrl("phone", "+49 30 1234567")]) {
      expect(url).not.toBeNull();
      expect(storable(url ?? "")).toBe(true);
    }
  });

  it.each([
    ["calendar", "not a link"],
    ["calendar", "javascript:alert(1)"],
    ["email", "hallo@"],
    ["email", "ronja.example"],
    ["whatsapp", "call me"],
    ["whatsapp", "123"],
    ["phone", "abc 123 456"],
    ["phone", "12"],
    ["phone", ""],
  ] as const)("an invalid %s address (%j) is an error, not a link", (way, typed) => {
    expect(reachUrl(way, typed)).toBeNull();
  });
});

describe("reachFrom", () => {
  it("reads a stored address back into its way and field", () => {
    expect(reachFrom("mailto:a@b.de")).toEqual({ way: "email", typed: "a@b.de" });
    expect(reachFrom("tel:+49301234567")).toEqual({ way: "phone", typed: "+49301234567" });
    expect(reachFrom("https://wa.me/4915123456789")).toEqual({ way: "whatsapp", typed: "+4915123456789" });
    expect(reachFrom("https://cal.example.com/x")).toEqual({ way: "calendar", typed: "https://cal.example.com/x" });
    expect(reachFrom("")).toEqual({ way: "calendar", typed: "" });
  });
});

describe("labels", () => {
  it("offers presets by way and kind, photographers first for a shoot", () => {
    expect(reachPresets("calendar", "designer")).toEqual(["call", "project"]);
    expect(reachPresets("calendar", "photographer")).toEqual(["shoot", "call"]);
    expect(reachPresets("email", "freelancer")).toEqual(["email", "project"]);
    expect(reachPresets("whatsapp", "photographer")).toEqual(["whatsapp", "shoot"]);
    expect(reachPresets("phone", undefined)).toEqual(["phone", "project"]);
  });

  it("names the preset in the page's language", () => {
    expect(presetLabel(de, "de", reachPresets("calendar", "designer")[0] ?? "")).toBe("Erstgespräch buchen");
    expect(presetLabel(en, "en", reachPresets("email", "designer")[0] ?? "")).toBe("Send a message");
    expect(presetLabel(ar, "ar", reachPresets("whatsapp", "designer")[0] ?? "")).toBe("راسلني على واتساب");
    expect(presetLabel(de, "de", reachPresets("calendar", "photographer")[0] ?? "")).toBe("Shooting anfragen");
  });

  it("gives every way an icon of the link icon set", () => {
    expect(REACH_WAYS.map(reachIcon)).toEqual(["calendar", "mail", "chat", "phone"]);
  });
});
