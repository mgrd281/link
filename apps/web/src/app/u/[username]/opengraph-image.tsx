import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { notFound } from "next/navigation";

import { cardPage, loadPublicPage } from "@/features/creator/public-page";
import { OG_SIZE, ogCard } from "@/features/share/og-card";
import { pageAddress } from "@/lib/page-url";

/**
 * The link preview of a creator's page: their photo, name, line and address in their own template. The
 * owner's search title and description (Settings › Sichtbarkeit) take the name's and the line's place;
 * a paused page shows its name and photo only.
 */
export const size = OG_SIZE;
export const contentType = "image/jpeg";
export const alt = "Linkyo";
export const revalidate = 60;

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const found = await loadPublicPage(username);
  if (!found) notFound();
  const theme = resolveCreatorTheme(found.theme, { rtlScript: found.page.profile.locale === "ar" });
  return ogCard({ page: cardPage(found), theme, address: pageAddress(username) });
}
