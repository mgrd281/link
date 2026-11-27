import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseTrueType, type TrueTypeFont } from "../font/ttf";
import { faceMetrics, type Metrics } from "../layout/measure";
import type { Face } from "../layout/types";

/**
 * The documents' faces: Geist Regular, SemiBold and Bold (SIL Open Font License, OFL.txt beside
 * them), copied from the geist package into this folder and read at run time, kept for the life of
 * the server. The whole font files are embedded (subsetting is a later step). They live in the app,
 * not under node_modules: a serverless function's trace keeps pnpm's real files but not the
 * node_modules/geist link, so a read through that link failed with ENOENT on Vercel.
 *
 * Each path is written out whole in its `readFile` call: the build's file tracer follows only literal
 * paths, and a font missing from a serverless function's files would fail every PDF and every
 * Laufbahn page there (scripts/check-route-budgets.mjs checks the traces after the build).
 */

export interface FontSet {
  fonts: Record<Face, TrueTypeFont>;
  metrics: Metrics;
}

const parse = (bytes: Buffer): TrueTypeFont => parseTrueType(new Uint8Array(bytes));

let loading: Promise<FontSet> | null = null;

export function loadFonts(): Promise<FontSet> {
  loading ??= Promise.all([
    readFile(join(process.cwd(), "src/features/documents/pdf/fonts/Geist-Regular.ttf")).then(parse),
    readFile(join(process.cwd(), "src/features/documents/pdf/fonts/Geist-SemiBold.ttf")).then(parse),
    readFile(join(process.cwd(), "src/features/documents/pdf/fonts/Geist-Bold.ttf")).then(parse),
  ])
    .then(([regular, semibold, bold]) => ({
      fonts: { regular, semibold, bold },
      metrics: { regular: faceMetrics(regular), semibold: faceMetrics(semibold), bold: faceMetrics(bold) },
    }))
    .catch((error: unknown) => {
      // A failed read is tried again on the next request.
      loading = null;
      throw error;
    });
  return loading;
}
