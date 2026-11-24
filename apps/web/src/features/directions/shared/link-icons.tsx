import type { LinkIcon, Platform } from "@linkyo/blocks";
import { detectLink } from "@linkyo/blocks/detect";
import { Icon } from "@linkyo/ui";
import {
  BadgePercent,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  ChartLine,
  Clock,
  CodeXml,
  Download,
  FileText,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Music,
  Newspaper,
  Palette,
  Phone,
  Play,
  Rocket,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SimpleIcon } from "simple-icons";

export const LINK_ICON_GLYPHS: Record<LinkIcon, LucideIcon> = {
  link: Link2,
  globe: Globe,
  shop: ShoppingBag,
  cart: ShoppingCart,
  tag: Tag,
  percent: BadgePercent,
  gift: Gift,
  truck: Truck,
  calendar: CalendarCheck,
  clock: Clock,
  phone: Phone,
  mail: Mail,
  chat: MessageCircle,
  map: MapPin,
  file: FileText,
  download: Download,
  play: Play,
  mic: Mic,
  music: Music,
  book: BookOpen,
  newspaper: Newspaper,
  briefcase: BriefcaseBusiness,
  code: CodeXml,
  palette: Palette,
  chart: ChartLine,
  users: Users,
  star: Star,
  heart: Heart,
  sparkles: Sparkles,
  graduation: GraduationCap,
  ticket: Ticket,
  rocket: Rocket,
};

/**
 * LinkedIn's "in" mark for profile links (Simple Icons no longer ships it). Drawn for Linkyo on the
 * 24 × 24 grid: a dotted i and an n, monochrome like every other platform glyph.
 */
export const LINKEDIN_GLYPH: SimpleIcon = {
  title: "LinkedIn",
  slug: "linkedin",
  hex: "0A66C2",
  source: "https://brand.linkedin.com/",
  svg: "",
  path: "M5 2.7a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM3.2 8.6h3.6V21H3.2zM9.2 8.6h3.45v1.7h.05c.48-.9 1.66-1.85 3.42-1.85 3.65 0 4.68 2.4 4.68 5.53V21h-3.6v-6.3c0-1.5-.03-3.43-2.09-3.43-2.09 0-2.31 1.63-2.31 3.32V21H9.2z",
};

/**
 * A website in a row of social profiles: a solid globe drawn for Linkyo on the same 24 × 24 grid as
 * the brand glyphs, so the row stays uniformly solid (an outline globe beside filled logos looked
 * unfinished). Six filled pieces of a disc; the gaps between them are the equator and a meridian
 * that meet at the poles.
 */
export const GLOBE_GLYPH: SimpleIcon = {
  title: "Website",
  slug: "website",
  hex: "000000",
  source: "https://linkyo.app",
  svg: "",
  path: "M12 2A3.8 10 0 0 0 8.212 11.2H15.788A3.8 10 0 0 0 12 2zM12 22A3.8 10 0 0 1 8.212 12.8H15.788A3.8 10 0 0 1 12 22zM12 2A10 10 0 0 0 2.032 11.2H6.617A5.4 10 0 0 1 12 2zM12 2A10 10 0 0 1 21.968 11.2H17.383A5.4 10 0 0 0 12 2zM12 22A10 10 0 0 1 2.032 12.8H6.617A5.4 10 0 0 0 12 22zM12 22A10 10 0 0 0 21.968 12.8H17.383A5.4 10 0 0 1 12 22z",
};

/** An email address in a row of social profiles: a solid envelope (flap and body), drawn like the globe. */
export const MAIL_GLYPH: SimpleIcon = {
  title: "Email",
  slug: "email",
  hex: "000000",
  source: "https://linkyo.app",
  svg: "",
  path: "M4 4.5h16a2 2 0 0 1 2 2v.5l-10 5.6L2 7v-.5a2 2 0 0 1 2-2zM2 8.834l10 5.6 10-5.6V17.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z",
};

/** Platforms that have their own glyph; everything else gets a semantic icon. */
const GLYPH_PLATFORMS = new Set<Platform>([
  "youtube",
  "youtubemusic",
  "spotify",
  "applemusic",
  "soundcloud",
  "deezer",
  "tidal",
  "bandcamp",
  "tiktok",
  "instagram",
  "twitch",
  "kick",
  "x",
  "threads",
  "bluesky",
  "discord",
  "whatsapp",
  "telegram",
  "facebook",
  "linkedin",
  "github",
]);

export type LinkGlyphChoice = { kind: "platform"; platform: Platform } | { kind: "icon"; icon: LinkIcon };

/**
 * The icon in front of a link: the creator's choice, else what the address says (a phone number,
 * an email, WhatsApp, a PDF, a map, a booking tool, a known platform), else a plain link.
 */
export function linkGlyph(url: string, chosen?: LinkIcon): LinkGlyphChoice {
  if (chosen) return { kind: "icon", icon: chosen };
  const detection = detectLink(url);
  const platform = detection?.platform;
  if (platform === "email") return { kind: "icon", icon: "mail" };
  if (platform === "phone") return { kind: "icon", icon: "phone" };
  if (platform === "pdf") return { kind: "icon", icon: "file" };
  if (platform === "eventbrite" || platform === "eventim" || platform === "ticketmaster") return { kind: "icon", icon: "ticket" };
  if (platform === "shopify") return { kind: "icon", icon: "shop" };
  if (platform && GLYPH_PLATFORMS.has(platform as Platform)) return { kind: "platform", platform: platform as Platform };
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    if (host === "maps.app.goo.gl" || host === "maps.apple.com" || (host.startsWith("google.") && pathname.startsWith("/maps"))) return { kind: "icon", icon: "map" };
    if (host === "calendly.com" || host === "cal.com") return { kind: "icon", icon: "calendar" };
  } catch {
    // Not a web address (validated elsewhere): a plain link icon.
  }
  return { kind: "icon", icon: "link" };
}

/** A semantic icon by name (platform glyphs are drawn by PlatformGlyph). */
export function LinkIconGlyph({ icon, size = "md", className }: { icon: LinkIcon; size?: "sm" | "md" | "lg"; className?: string | undefined }) {
  return <Icon icon={LINK_ICON_GLYPHS[icon]} size={size} className={className} />;
}
