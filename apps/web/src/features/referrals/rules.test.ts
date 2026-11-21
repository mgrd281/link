import { describe, expect, it } from "vitest";

import { emailIdentity, isReferralCode, newReferralCode, PRO_AVAILABLE, REFERRAL_ALPHABET, REFERRAL_CODE, REFERRAL_RULES, remaining } from "./rules";

describe("invite program rules", () => {
  it("has the agreed thresholds", () => {
    expect(REFERRAL_RULES).toEqual({ verificationAt: 3, proForLifeAt: 10, clusterSize: 3, clusterDays: 7, retryVerificationDays: 7 });
    expect(REFERRAL_RULES.verificationAt).toBeLessThan(REFERRAL_RULES.proForLifeAt);
    expect(PRO_AVAILABLE).toBe(false);
  });

  it("uses 31 unambiguous symbols, the same ones the pattern allows", () => {
    expect(REFERRAL_ALPHABET).toHaveLength(31);
    expect(new Set(REFERRAL_ALPHABET).size).toBe(31);
    for (const symbol of "01ilo") expect(REFERRAL_ALPHABET).not.toContain(symbol);
    for (const symbol of REFERRAL_ALPHABET) expect(REFERRAL_CODE.test(symbol.repeat(8))).toBe(true);
  });

  it("makes 10,000 codes that all match the pattern", () => {
    const seen = new Set<string>();
    const used = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      const code = newReferralCode();
      expect(code).toMatch(REFERRAL_CODE);
      seen.add(code);
      for (const symbol of code) used.add(symbol);
    }
    // 31^8 codes: repeats among 10,000 are vanishingly rare; every symbol shows up.
    expect(seen.size).toBeGreaterThan(9_990);
    expect(used.size).toBe(31);
  });

  it("accepts only 8 symbols from the alphabet", () => {
    expect(isReferralCode("abcdefgh")).toBe(true);
    expect(isReferralCode("23456789")).toBe(true);
    expect(isReferralCode("k7m2q9xz")).toBe(true);
    expect(isReferralCode("abcdefg")).toBe(false);
    expect(isReferralCode("abcdefghj")).toBe(false);
    expect(isReferralCode("ABCDEFGH")).toBe(false);
    expect(isReferralCode("abcdefg0")).toBe(false);
    expect(isReferralCode("abcdefg1")).toBe(false);
    expect(isReferralCode("abcdefgi")).toBe(false);
    expect(isReferralCode("abcdefgl")).toBe(false);
    expect(isReferralCode("abcdefgo")).toBe(false);
    expect(isReferralCode(" abcdefgh")).toBe(false);
    expect(isReferralCode("abcd-fgh")).toBe(false);
    expect(isReferralCode("")).toBe(false);
  });

  it("finds the mailbox behind an address", () => {
    expect(emailIdentity("A.b+x@gmail.com")).toBe("ab@gmail.com");
    expect(emailIdentity("  Mila.Kade+test@GoogleMail.com ")).toBe("milakade@gmail.com");
    expect(emailIdentity("mila.kade@example.com")).toBe("mila.kade@example.com");
    expect(emailIdentity("Mila.Kade+news@Example.com")).toBe("mila.kade@example.com");
    expect(emailIdentity("a+1@example.com")).toBe(emailIdentity("a@example.com"));
    expect(emailIdentity("a.b@outlook.com")).not.toBe(emailIdentity("ab@outlook.com"));
  });

  it("counts what is still missing, never below zero", () => {
    expect(remaining(0, 3)).toBe(3);
    expect(remaining(2, 3)).toBe(1);
    expect(remaining(3, 3)).toBe(0);
    expect(remaining(12, 10)).toBe(0);
  });
});
