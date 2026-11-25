"use client";

import { lazy, Suspense } from "react";

// The error page loads when a page has failed, not with every page (ADR 0008): Next.js sends a
// segment's error file with every route below it. Should it not load, the root's error page takes over.
const ErrorScreen = lazy(() => import("@/features/errors/error-screen").then((module) => ({ default: module.ErrorScreen })));

/**
 * A page under a language failed to render (the dashboard's own screens have theirs in (shell)):
 * Linkyo's error page in that language, with "try again" and the way back.
 */
export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Suspense fallback={null}>
      <ErrorScreen error={error} retry={retry} />
    </Suspense>
  );
}
