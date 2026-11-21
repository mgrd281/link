/*
 * The invite program's rules, in one place. SQL `public.referral_rule(name)` mirrors the numbers and
 * `public.email_identity()` mirrors `emailIdentity`; rules.test.ts compares them. Messages never type
 * a threshold: they take it as a parameter from here.
 */

export const REFERRAL_RULES = {
  /** Counted invites that unlock one free verification review (a person on the team sets the check). */
  verificationAt: 3,
  /** Counted invites that give Pro for life (a reward, never a subscription or revenue). */
  proForLifeAt: 10,
  /** This many sign-ups of one inviter from one network within `clusterDays` are held for the team. */
  clusterSize: 3,
  clusterDays: 7,
  /** After a declined review, the creator may ask again after this many days. */
  retryVerificationDays: 7,
} as const;

/** 31 symbols without 0, 1, i, l and o, so nothing is misread: 31^8 ≈ 8.5 × 10^11 codes. */
export const REFERRAL_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export const REFERRAL_CODE = /^[2-9a-hjkmnp-z]{8}$/;

export const isReferralCode = (value: string): boolean => REFERRAL_CODE.test(value);

const CODE_LENGTH = 8;
/** The largest multiple of the alphabet's size that fits in a byte: bytes at or above it are drawn again, so every symbol is equally likely. */
const UNBIASED = Math.floor(256 / REFERRAL_ALPHABET.length) * REFERRAL_ALPHABET.length;

/** A new random code (cryptographically random, uniform over the alphabet). */
export function newReferralCode(): string {
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2))) {
      if (byte >= UNBIASED) continue;
      code += REFERRAL_ALPHABET.charAt(byte % REFERRAL_ALPHABET.length);
      if (code.length === CODE_LENGTH) break;
    }
  }
  return code;
}

/** Pro has no launch date yet. Until it flips, "Pro for life" reads as reserved, not active. */
export const PRO_AVAILABLE = false;

const GMAIL = new Set(["gmail.com", "googlemail.com"]);

/**
 * The mailbox behind an address, for the self-invite check: lower case, the `+tag` dropped, and for
 * Gmail the dots dropped too (Gmail ignores them). Mirrors SQL `public.email_identity()`.
 */
export function emailIdentity(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  const local = parts[0] ?? "";
  const domain = parts[1] ?? "";
  const mailbox = local.split("+")[0] ?? "";
  return GMAIL.has(domain) ? `${mailbox.replaceAll(".", "")}@gmail.com` : `${mailbox}@${domain}`;
}

/** Invites still needed for a milestone (never below 0). */
export const remaining = (counted: number, at: number): number => Math.max(0, at - counted);
