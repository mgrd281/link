import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseTrueType, type TrueTypeFont } from "../font/ttf";
import { faceMetrics, type Metrics } from "../layout/measure";
import type { Face } from "../layout/types";

/**
 * The documents' faces: Geist Regular, SemiBold and Bold (SIL Open Font License), read from the
 * geist package at run time exactly as the link preview cards read theirs (features/share/og-card.tsx)
 * and kept for the life of the server. The whole font files are embedded (subsetting is a later step).
 */

export interface FontSet {
  fonts: Record<Face, TrueTypeFont>;
  metrics: Metrics;
}

const fontFile = async (path: string): Promise<TrueTypeFont> => parseTrueType(new Uint8Array(await readFile(join(process.cwd(), "node_modules", path))));

let loading: Promise<FontSet> | null = null;

export function loadFonts(): Promise<FontSet> {
  loading ??= Promise.all([
    fontFile("geist/dist/fonts/geist-sans/Geist-Regular.ttf"),
    fontFile("geist/dist/fonts/geist-sans/Geist-SemiBold.ttf"),
    fontFile("geist/dist/fonts/geist-sans/Geist-Bold.ttf"),
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
