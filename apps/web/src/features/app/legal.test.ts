import { describe, expect, it } from "vitest";

import type { Legal } from "@/features/account/types";

import { isEmail, legalErrors, legalStatus, missingLegalFields } from "./legal";

const empty: Legal = { name: "", address: "", email: "", phone: "" };
const complete: Legal = { name: "Mila Aurel", address: "Musterstraße 1\n10115 Berlin", email: "hallo@mila.de", phone: "+49 (0) 30 123-45/67" };

describe("legal notice", () => {
  it("is missing when nothing is filled in, with no errors", () => {
    expect(legalStatus(empty)).toBe("missing");
    expect(legalErrors(empty)).toEqual({});
    expect(missingLegalFields(empty)).toEqual(["name", "address", "email"]);
  });

  it("treats blank entries as empty", () => {
    expect(legalStatus({ name: "  ", address: "\n", email: " ", phone: " " })).toBe("missing");
  });

  it("is incomplete with a name only, and a name alone is not an error", () => {
    const legal = { ...empty, name: "Mila Aurel" };
    expect(legalStatus(legal)).toBe("incomplete");
    expect(legalErrors(legal)).toEqual({});
    expect(missingLegalFields(legal)).toEqual(["address", "email"]);
  });

  it("rejects a one-letter name", () => {
    const legal = { ...empty, name: "M" };
    expect(legalErrors(legal)).toEqual({ name: "name" });
    expect(legalStatus(legal)).toBe("incomplete");
    expect(missingLegalFields(legal)).toContain("name");
  });

  it("rejects an email that cannot be right", () => {
    for (const email of ["mila", "mila@", "mila@aurel", "mila@aurel.d", "mi la@aurel.de"]) {
      expect(isEmail(email)).toBe(false);
      expect(legalErrors({ ...complete, email })).toEqual({ email: "email" });
      expect(legalStatus({ ...complete, email })).toBe("incomplete");
    }
    expect(isEmail(" hallo@mila.de ")).toBe(true);
  });

  it("rejects a phone number with letters, and one without a digit", () => {
    expect(legalErrors({ ...complete, phone: "abc" })).toEqual({ phone: "phone" });
    expect(legalErrors({ ...complete, phone: "+" })).toEqual({ phone: "phone" });
    expect(legalErrors({ ...complete, phone: "030 1234567" })).toEqual({});
  });

  it("is complete with a name, an address and a valid email (the phone is optional)", () => {
    expect(legalStatus(complete)).toBe("complete");
    expect(legalErrors(complete)).toEqual({});
    expect(missingLegalFields(complete)).toEqual([]);
    expect(legalStatus({ ...complete, phone: "" })).toBe("complete");
  });

  it("lists only the email once name and address are saved", () => {
    expect(missingLegalFields({ ...empty, name: "Mila Aurel", address: "Musterstraße 1" })).toEqual(["email"]);
  });
});
