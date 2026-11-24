"use client";

import { ErrorScreen } from "@/features/errors/error-screen";

/**
 * A page under a language failed to render (the dashboard's own screens have theirs in (shell)):
 * Linkyo's error page in that language, with "try again" and the way back.
 */
export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
