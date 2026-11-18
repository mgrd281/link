import { detectLink, type LinkIcon, type Platform } from "@linkyo/blocks";
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
