"use client";

import { ErrorScreen } from "@/features/errors/error-screen";

/** The welcome flow failed to render: the dashboard's error page (black and grey), with "try again". */
export default function WelcomeError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
