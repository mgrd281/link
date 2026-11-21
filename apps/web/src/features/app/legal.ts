import type { Legal } from "@/features/account/types";

/**
 * The legal notice (Impressum): how complete it is, and which entries have a format that cannot be
 * right. An empty entry is never an error (an incomplete notice may be saved); completeness is a status.
 */

export type LegalStatus = "missing" | "incomplete" | "complete";
export type LegalField = "name" | "address" | "email" | "phone";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Digits, spaces and the usual separators ("+49 (0) 30 123-45/67"), with at least one digit. */
const PHONE = /^\+?[\d\s()./-]+$/;

export const isEmail = (value: string): boolean => EMAIL.test(value.trim());

const filled = (value: string) => value.trim() !== "";
const nameOk = (value: string) => value.trim().length >= 2;

/** Entries whose format is wrong (formats only: empty entries are not errors). */
export function legalErrors(legal: Legal): Partial<Record<LegalField, "name" | "email" | "phone">> {
  const errors: Partial<Record<LegalField, "name" | "email" | "phone">> = {};
  if (filled(legal.name) && !nameOk(legal.name)) errors.name = "name";
  if (filled(legal.email) && !isEmail(legal.email)) errors.email = "email";
  const phone = legal.phone.trim();
  if (phone && !(PHONE.test(phone) && /\d/.test(phone))) errors.phone = "phone";
  return errors;
}

/** What a complete notice still needs, in form order: a name, an address and a valid email. */
export function missingLegalFields(legal: Legal): ("name" | "address" | "email")[] {
  const missing: ("name" | "address" | "email")[] = [];
  if (!nameOk(legal.name)) missing.push("name");
  if (!filled(legal.address)) missing.push("address");
  if (!isEmail(legal.email)) missing.push("email");
  return missing;
}

export function legalStatus(legal: Legal): LegalStatus {
  if (![legal.name, legal.address, legal.email, legal.phone].some(filled)) return "missing";
  return missingLegalFields(legal).length === 0 ? "complete" : "incomplete";
}
