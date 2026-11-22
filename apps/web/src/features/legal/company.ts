import { paymentsMode } from "../../lib/flags";

/**
 * The single place for the company data of the Impressum, the legal texts and contract e-mails.
 * Every value in square brackets is a placeholder the founder still has to supply; while one is
 * left, the legal pages are drafts, footers keep plain names (outside test builds) and a live
 * payments build fails (live-guard.ts).
 */
export const COMPANY = {
  name: "[Name oder Firma]",
  representative: "[Vertretungsberechtigte Person]",
  address: "[Straße Nr., PLZ Ort]",
  email: "[E-Mail-Adresse]",
  phone: "[Telefonnummer]",
  register: "[Registergericht und Nummer, falls vorhanden]",
  vatId: "[USt-IdNr., falls vorhanden]",
};

/** True once no placeholder is left. */
export const legalReady = !Object.values(COMPANY).some((value) => value.includes("["));

/** Footers and Settings link the legal pages once the data is real, or in a payments test build. */
export const legalLinksVisible: boolean = legalReady || paymentsMode === "test";
