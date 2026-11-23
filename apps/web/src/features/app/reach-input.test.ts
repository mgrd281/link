import { blockSchema } from "@linkyo/blocks";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { isPresetLabel, presetLabel, ReachInput, reachesBy, reachFrom, reachIcon, reachPresets, reachUrl, REACH_WAYS, shapeWay, type ReachPreset } from "./reach-input";

const messageLabel = (messages: typeof de, locale: string, preset: string) =>
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

  it("makes a WhatsApp number a wa.me link with digits only, from its international form", () => {
    expect(reachUrl("whatsapp", "+49 151 2345-6789")).toBe("https://wa.me/4915123456789");
    expect(reachUrl("whatsapp", "0049 151 2345678")).toBe("https://wa.me/491512345678");
    expect(reachUrl("whatsapp", "+49 (0)151 2345678")).toBe("https://wa.me/491512345678");
    expect(reachUrl("whatsapp", "https://wa.me/4915123456789")).toBe("https://wa.me/4915123456789");
    // A national number has no country code: wa.me opens no chat for it.
    expect(reachUrl("whatsapp", "(0151) 234 56 78")).toBeNull();
    expect(reachUrl("whatsapp", "https://wa.me/01512345678")).toBeNull();
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
    ["whatsapp", "0151 2345678"],
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

describe("contact ways of another kind", () => {
  it("are shaped by their kind: a number under WhatsApp opens a chat, not the dialler", () => {
    expect(shapeWay({ kind: "whatsapp", url: "+49 151 23456789" })).toEqual({ kind: "whatsapp", url: "https://wa.me/4915123456789" });
    expect(shapeWay({ kind: "whatsapp", url: "tel:+4915123456789" })).toEqual({ kind: "whatsapp", url: "https://wa.me/4915123456789" });
    expect(shapeWay({ kind: "phone", url: "https://wa.me/4915123456789" })).toEqual({ kind: "phone", url: "tel:+4915123456789" });
    expect(shapeWay({ kind: "email", url: "hallo@ronja.example" })).toEqual({ kind: "email", url: "mailto:hallo@ronja.example" });
    expect(shapeWay({ kind: "calendar", url: "cal.example.com/ronja" })).toEqual({ kind: "calendar", url: "https://cal.example.com/ronja" });
    // A CV and another link stay as they are; what cannot be read is left for the editor to point out.
    expect(shapeWay({ kind: "cv", url: "https://example.com/cv.pdf" })).toEqual({ kind: "cv", url: "https://example.com/cv.pdf" });
    expect(shapeWay({ kind: "phone", url: "hallo@ronja.example" })).toEqual({ kind: "phone", url: "hallo@ronja.example" });
    expect(reachesBy("phone", "hallo@ronja.example")).toBe(false);
    expect(reachesBy("whatsapp", "https://wa.me/4915123456789")).toBe(true);
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

  it("has every preset's words in every page language, the same as the message files", () => {
    const files = { de, en, ar } as const;
    const presets: ReachPreset[] = ["call", "email", "whatsapp", "phone", "project", "shoot"];
    for (const locale of ["de", "en", "ar"] as const) {
      for (const preset of presets) {
        expect(presetLabel(preset, locale), `${locale} ${preset}`).toBe(messageLabel(files[locale], locale, preset));
        expect(isPresetLabel(presetLabel(preset, locale))).toBe(true);
      }
    }
    expect(Object.keys(de.app.portfolio.contact.presets).sort()).toEqual([...presets].sort());
    expect(isPresetLabel("Mein eigener Knopf")).toBe(false);
  });

  it("names the preset in the page's language, not the dashboard's", () => {
    // Dashboard in German, page in English: the button and its presets speak English.
    const markup = (locale?: "de" | "en" | "ar") =>
      renderToStaticMarkup(
        createElement(NextIntlClientProvider, {
          locale: "de",
          messages: de,
          timeZone: "Europe/Berlin",
          children: createElement(ReachInput, { value: { label: "", url: "" }, onValue: () => undefined, kind: "designer", locale }),
        }),
      );
    expect(markup("en")).toContain("Book an intro call");
    expect(markup("en")).not.toContain("Erstgespräch buchen");
    expect(markup("ar")).toContain("احجز جلسة تعريفية");
    // Without a page language the dashboard's words are used (the welcome flow's page speaks it).
    expect(markup()).toContain("Erstgespräch buchen");
    expect(presetLabel(reachPresets("calendar", "photographer")[0] ?? "call", "de")).toBe("Shooting anfragen");
  });

  it("gives every way an icon of the link icon set", () => {
    expect(REACH_WAYS.map(reachIcon)).toEqual(["calendar", "mail", "chat", "phone"]);
  });
});
