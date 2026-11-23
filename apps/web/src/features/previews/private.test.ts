import { pageSchema } from "@linkyo/blocks";
import { afterEach, describe, expect, it, vi } from "vitest";

import { emailHash, privatePreviewDetails } from "./private";
import { SEVAG_SLUG, sevagContact, sevagDe } from "./sevag";

// Made-up details: real ones live only in the server's environment, never in this repository.
const PHONE = "+4915100000000";
const EMAIL = "bewerber@example.com";

describe("private preview details", () => {
  it("reads phone, e-mail and invites per page from the environment value", () => {
    const value = JSON.stringify({ [SEVAG_SLUG]: { phone: PHONE, email: EMAIL, invite: [EMAIL] } });
    expect(privatePreviewDetails(value)).toEqual({ [SEVAG_SLUG]: { phone: PHONE, email: EMAIL, invite: [EMAIL] } });
  });

  it("ignores a missing, malformed or invalid value instead of failing the page", () => {
    expect(privatePreviewDetails(undefined)).toEqual({});
    expect(privatePreviewDetails("{not json")).toEqual({});
    expect(privatePreviewDetails(JSON.stringify({ [SEVAG_SLUG]: { phone: "0176 1234" } }))).toEqual({});
    expect(privatePreviewDetails(JSON.stringify({ "Bad Slug": { email: EMAIL } }))).toEqual({});
  });

  it("hashes e-mails the way the claim compares them", () => {
    expect(emailHash(" Bewerber@Example.com ")).toBe(emailHash(EMAIL));
  });
});

describe("Sevag's contact band", () => {
  it("leads with Kontakt (e-mail) and offers the number; the page with it is valid", () => {
    const band = sevagContact({ phone: PHONE, email: EMAIL });
    expect(band?.primary).toEqual({ label: "Kontakt", url: `mailto:${EMAIL}`, icon: "mail" });
    expect(band?.links).toEqual([{ kind: "phone", url: `tel:${PHONE}` }]);
    expect(pageSchema.safeParse({ ...sevagDe, blocks: [...sevagDe.blocks, band] }).success).toBe(true);
  });

  it("calls when there is only a number, and is absent without both", () => {
    expect(sevagContact({ phone: PHONE })?.primary).toEqual({ label: "Anrufen", url: `tel:${PHONE}`, icon: "phone" });
    expect(sevagContact({})).toBeNull();
  });
});

describe("the registry with private details", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("adds the contact band and lets only the invited e-mail take the page over, verified", async () => {
    vi.stubEnv("LINKYO_PREVIEW_PRIVATE", JSON.stringify({ [SEVAG_SLUG]: { phone: PHONE, email: EMAIL, invite: [EMAIL] } }));
    vi.resetModules();
    const { previewPage } = await import("./registry");
    const { findPrepared } = await import("./claim");
    const found = previewPage(SEVAG_SLUG, "de");
    expect(found?.page.blocks.at(-1)?.type).toBe("contact");
    expect(found?.preview.invite?.emailSha256).toEqual([emailHash(EMAIL)]);
    const claim = findPrepared({ email: EMAIL.toUpperCase(), username: "anything", locale: "de" });
    expect(claim.kind).toBe("match");
    if (claim.kind === "match") {
      expect(claim.username).toBe("sevag-ghazarian");
      expect(claim.page.profile.verified).toBe(true);
    }
    // Someone else cannot take his address.
    expect(findPrepared({ email: "someone@example.com", username: "sevag-ghazarian", locale: "de" }).kind).toBe("reserved");
  });
});
