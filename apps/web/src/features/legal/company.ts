import { paymentsMode } from "../../lib/flags";

/**
 * The single place for the company data of the Impressum, the legal texts and contract e-mails.
 * Every value in square brackets is a placeholder the founder still has to supply; while one is
 * left, the legal pages are drafts, footers keep plain names (outside test builds) and a live
 * payments build fails (live-guard.ts).
 */
export const COMPANY = {
  name: "Karina Khrystych",
  representative: "Karina Khrystych (Inhaberin)",
  address: "Havighorster Redder 51, 22115 Hamburg, Deutschland",
  email: "mgrdegh@gmx.de",
  phone: "+49 163 7072446",
  register: "Kein Eintrag im Handelsregister; angemeldetes Gewerbe in Hamburg.",
  vatId: "DE452578048",
};

/** True once no placeholder is left. */
export const legalReady = !Object.values(COMPANY).some((value) => value.includes("["));

/** Footers and Settings link the legal pages once the data is real, or in a payments test build. */
export const legalLinksVisible: boolean = legalReady || paymentsMode === "test";
