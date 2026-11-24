import { BriefcaseBusiness, Clapperboard, CodeXml, FolderKanban, GraduationCap, Landmark, Music, ShoppingBag, Sparkles, Star, Store, Trophy, type LucideIcon } from "lucide-react";

import type { Category } from "./looks";

/** One icon per category, used on the filter chips, the cards and the preview. */
export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  creators: Sparkles,
  // The project block's icon: a portfolio is a page of projects.
  portfolio: FolderKanban,
  online: ShoppingBag,
  tech: CodeXml,
  music: Music,
  sport: Trophy,
  film: Clapperboard,
  business: BriefcaseBusiness,
  public: Landmark,
  local: Store,
  careers: GraduationCap,
  people: Star,
};
