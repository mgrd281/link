import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { notFound } from "next/navigation";

import { loadPublicPage } from "@/features/creator/public-page";
import { findProject } from "@/features/directions/poster/project-page";
import { OG_SIZE, ogProjectCard } from "@/features/share/og-card";
import { pageAddress } from "@/lib/page-url";

/** The link preview of a project: its cover (or its result, or its title) in the page's own template. */
export const size = OG_SIZE;
export const contentType = "image/jpeg";
export const alt = "Linkyo";
export const revalidate = 60;

export default async function Image({ params }: { params: Promise<{ username: string; project: string }> }) {
  const { username, project: slug } = await params;
  const found = await loadPublicPage(username);
  const lookup = found ? findProject(found.page, slug) : null;
  if (!found || lookup?.kind !== "found") notFound();
  const theme = resolveCreatorTheme(found.theme, { rtlScript: found.page.profile.locale === "ar" });
  return ogProjectCard({ page: found.page, project: lookup.project, theme, address: `${pageAddress(username)}/${lookup.project.slug}` });
}
