import type { Metadata } from "next";

import { ProjectNotFound } from "@/features/creator/not-found-lazy";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Linkyo", robots: NOINDEX };

/**
 * A project address a creator's page does not have (never had, hidden, or not yet published):
 * Linkyo's calm page, in the language of the page around it, with the way back to that page.
 * Answered with status 404. Its code loads with this page only (ADR 0008).
 */
export default function ProjectNotFoundPage() {
  return <ProjectNotFound />;
}
