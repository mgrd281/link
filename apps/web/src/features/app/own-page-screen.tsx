"use client";

import { isBlockActive } from "@linkyo/blocks";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Button, cn, Icon } from "@linkyo/ui";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useAppMode } from "@/features/app-mode/use-app-mode";
import { PosterRenderer } from "@/features/directions/poster/renderer";
import { OwnerPreview, usePrivacyNoticeOpen } from "@/features/directions/shared/privacy";
import { externalProviders } from "@/features/directions/shared/providers";
import { Link } from "@/i18n/navigation";
import { pageUrl } from "@/lib/page-url";

import { isReturnPath, LAST_APP_PATH_KEY } from "./routes";
import { useSite } from "./site-context";

/** The dashboard screen the page was opened from (the shell remembers it), else Start. */
function readReturnPath(): string {
  try {
    const path = window.sessionStorage.getItem(LAST_APP_PATH_KEY);
    return isReturnPath(path) ? path : "/app";
  } catch {
    return "/app";
  }
}

/**
 * "View my page": the page exactly as visitors will see it, full screen, with a small floating bar:
 * "Done" (back where you were) or edit. The browser chrome takes the page color, like the public
 * page. While the page's privacy notice is open (it sits at the bottom), the bar waits at the top, so
 * neither covers the other.
 *
 * In the iPhone app the app's own toolbar (Done, Edit, Share) stands over the page instead: the bar is
 * hidden (`data-app-hide`) and the page keeps no room for it. The bar's `data-console` stays in the
 * page: it is what hides the page's "Made with Linkyo" credit inside the dashboard (globals.css).
 */
export function OwnPageScreen() {
  const t = useTranslations("app.ownPage");
  const app = useAppMode();
  const { previewPage, doc, account } = useSite();
  const theme = useMemo(() => resolveCreatorTheme(doc.theme, { rtlScript: previewPage.profile.locale === "ar" }), [doc.theme, previewPage.profile.locale]);
  const noticeOpen = usePrivacyNoticeOpen(externalProviders(previewPage.blocks.filter((block) => isBlockActive(block))).length > 0);
  // Read once: this screen only renders in the browser (behind AppGate's splash).
  const [backTo] = useState(readReturnPath);
  // The page has no addresses of its own here: a project opens in place, its "Back" returns.
  const [opened, setOpened] = useState<string | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [opened]);

  // Match the browser's top bar and overscroll area to the page background.
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ?? document.head.appendChild(Object.assign(document.createElement("meta"), { name: "theme-color" }));
    const previous = meta.content;
    meta.content = theme.palette.bg;
    document.documentElement.style.backgroundColor = theme.palette.bg;
    return () => {
      meta.content = previous;
      document.documentElement.style.backgroundColor = "";
    };
  }, [theme.palette.bg]);

  return (
    <>
      <OwnerPreview bar={!app}>
        {/* The page's share button shares its public address, not this screen's (share-island.tsx). */}
        <div data-share-url={pageUrl(account.username)} className="contents">
          <PosterRenderer page={previewPage} theme={theme} openProject={opened ? { id: opened, onBack: () => setOpened(null) } : undefined} onOpenProject={setOpened} />
        </div>
      </OwnerPreview>
      {/* The bar is dashboard chrome (black and grey); the creator's page under it keeps its own colours (ADR 0062). */}
      <nav
        data-console="local"
        data-app-hide
        aria-label={t("label")}
        className={cn(
          // A full-width strip, so taps beside the bar reach the page under it; only the bar takes them.
          "pointer-events-none layer-sticky fixed inset-x-0 flex justify-center px-4",
          noticeOpen ? "top-0 pt-[max(var(--spacing-4),env(safe-area-inset-top))]" : "bottom-0 pb-[max(var(--spacing-4),env(safe-area-inset-bottom))]",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-surface-elevated p-1 text-fg">
          {/* "Done", as on iOS: back to the dashboard screen the page was opened from. */}
          <Button asChild variant="ghost" className="rounded-full">
            <Link href={backTo}>{t("back")}</Link>
          </Button>
          <Button asChild variant="primary" className="rounded-full">
            <Link href="/app/editor">
              <Icon icon={Pencil} size="sm" />
              {t("edit")}
            </Link>
          </Button>
        </div>
      </nav>
    </>
  );
}
