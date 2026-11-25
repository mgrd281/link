import type { Metadata } from "next";

import { ProjectNotFound } from "@/features/creator/not-found-lazy";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Linkyo", robots: NOINDEX };

/**
 * A project address an example page does not have: Linkyo's calm page with the way back to the example.
 * Status 404. Its code loads with this page only (ADR 0008).
 */
export default function ExampleProjectNotFound() {
  return <ProjectNotFound />;
}
