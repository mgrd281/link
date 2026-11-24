"use client";

import { ErrorScreen } from "@/features/errors/error-screen";

/** Building with AI failed to render: the dashboard's error page (black and grey), with "try again". */
export default function BuildError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
