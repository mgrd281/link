import type { BlockOf, Page } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { themeStyle } from "@/features/creator/theme";

import type { CreatorFooterLinks } from "../shared/creator-kit";
import { displayStyle, pageSide, pressable } from "./styles";

/**
 * A project's own page: what the card has no room for (the result, the story, the pictures, the code).
 *
 * Contract with a working core: this version shows the title as the page's `h1` and, in a preview
 * (`onBack`), the button back to the portfolio. The dashboard's preview and the AI draft can open a
 * project in place with that; the page itself is written with the project routes. The props stay as
 * they are, and the back control of a preview stays a `<button>` with this name.
 */
export function ProjectPage({
  page,
  theme,
  project,
  onBack,
  preview = false,
}: {
  page: Page;
  theme: ResolvedCreatorTheme;
  project: BlockOf<"project">;
  /** Where project pages live ("/<username>"); absent in previews. */
  base?: string | undefined;
  /** Appended to every project address. */
  suffix?: string | undefined;
  /** The portfolio this project belongs to (the bar's way back on a routed page). */
  backHref?: string | undefined;
  /** Previews without a router: the way back is a button. */
  onBack?: (() => void) | undefined;
  /** Previews without a router: "next project" opens in place. */
  onOpenProject?: ((id: string) => void) | undefined;
  footerLinks?: CreatorFooterLinks | undefined;
  preview?: boolean | undefined;
  /** Linkyo's own chrome on example and sample pages: the "Example" badge and the dock. */
  overlay?: ReactNode;
  dock?: ReactNode;
}): ReactNode {
  const t = useTranslations("creator");
  const { profile } = page;
  // A preview sits inside the dashboard, which already has the page's one <main>.
  const Main = preview ? "div" : "main";
  return (
    <div
      lang={profile.locale}
      dir={profile.locale === "ar" ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      className={cn("poster-scope @container relative isolate overflow-clip bg-creator-bg font-creator-body text-creator-fg", preview ? "min-h-full" : "min-h-dvh")}
    >
      <Main className="mx-auto grid max-w-creator grid-cols-1 justify-items-start gap-6 px-creator-gutter py-10">
        {onBack ? (
          <button type="button" onClick={onBack} className={cn("inline-flex min-h-touch-target items-center gap-2 rounded-creator-button text-small font-semibold text-creator-fg", pressable)}>
            <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
            <span>{t("portfolio.backTo", { name: profile.displayName })}</span>
          </button>
        ) : null}
        <h1 dir="auto" className={cn(pageSide, "font-creator-display text-h1 leading-tight text-balance break-words")} style={displayStyle}>
          {project.title}
        </h1>
      </Main>
    </div>
  );
}
