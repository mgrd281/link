import { describe, expect, it } from "vitest";

import { linkGlyph } from "./link-icons";

describe("link icons", () => {
  it.each([
    ["mailto:hello@example.com", { kind: "icon", icon: "mail" }],
    ["tel:+49301234567", { kind: "icon", icon: "phone" }],
    ["https://wa.me/4915112345678", { kind: "platform", platform: "whatsapp" }],
    ["https://github.com/leonpark", { kind: "platform", platform: "github" }],
    ["https://www.linkedin.com/in/hanna", { kind: "platform", platform: "linkedin" }],
    ["https://example.com/menu.pdf", { kind: "icon", icon: "file" }],
    ["https://www.google.com/maps/search/?api=1&query=Kiel", { kind: "icon", icon: "map" }],
    ["https://calendly.com/hanna/erstgespraech", { kind: "icon", icon: "calendar" }],
    ["https://www.eventim.de/event/x-123", { kind: "icon", icon: "ticket" }],
    ["https://example.com/anything", { kind: "icon", icon: "link" }],
  ])("%s → %o", (url, expected) => {
    expect(linkGlyph(url)).toEqual(expected);
  });

  it("the creator's choice wins over the address", () => {
    expect(linkGlyph("https://wa.me/4915112345678", "chat")).toEqual({ kind: "icon", icon: "chat" });
  });
});
