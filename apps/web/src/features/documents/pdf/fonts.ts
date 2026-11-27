import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseTrueType, type TrueTypeFont } from "../font/ttf";
import { faceMetrics, type Metrics } from "../layout/measure";
import type { Face } from "../layout/types";

/**
 * The documents' faces: Geist Regular, SemiBold and Bold (SIL Open Font License), read from the
 * geist package at run time as the link preview cards read theirs (features/share/page-card.tsx) and
 * kept for the life of the server. The whole font files are embedded (subsetting is a later step).
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
    readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf")).then(parse),
    readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf")).then(parse),
    readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf")).then(parse),
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
