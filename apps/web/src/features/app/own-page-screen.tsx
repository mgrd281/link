"use client";

import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Button, Icon } from "@linkyo/ui";
import { ArrowLeft, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";

import { PosterRenderer } from "@/features/directions/poster/renderer";
import { Link } from "@/i18n/navigation";

import { useSite } from "./site-context";

/**
 * "View my page": the page exactly as visitors will see it, full screen, with a small floating bar
 * to go back or edit. The browser chrome takes the page color, like the public page.
 */
export function OwnPageScreen() {
  const t = useTranslations("app.ownPage");
  const { previewPage, doc } = useSite();
  const theme = useMemo(() => resolveCreatorTheme(doc.theme, { rtlScript: previewPage.profile.locale === "ar" }), [doc.theme, previewPage.profile.locale]);

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
      <PosterRenderer page={previewPage} theme={theme} />
      <nav aria-label={t("label")} className="layer-sticky fixed inset-x-0 bottom-0 flex justify-center px-4 pb-[max(var(--spacing-4),env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface-elevated p-1 text-fg shadow-e3">
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/app">
              <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
              {t("back")}
            </Link>
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
