"use client";

import type { Page } from "@linkyo/blocks";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cn, Icon, IconButton } from "@linkyo/ui";
import { Check, ExternalLink, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DirectionRenderer } from "../direction-renderer";
import type { TileSize } from "../mosaic/renderer";
import type { DirectionId } from "../registry";

/**
 * Live phone preview: the real renderer at 390 px inside a scroll container. Container queries make
 * it render exactly like a phone, and React state makes updates instant (no network, < 50 ms).
 */
export function PreviewPane({
  direction,
  page,
  theme,
  sizes,
  pageHref,
  open,
  onClose,
  tone = "light",
}: {
  direction: DirectionId;
  page: Page;
  theme: CreatorThemeConfig;
  sizes?: Record<string, TileSize> | undefined;
  pageHref: string;
  open: boolean;
  onClose: () => void;
  tone?: "light" | "dark";
}) {
  const t = useTranslations("dashboard");
  const resolved = useMemo(() => resolveCreatorTheme(theme, { rtlScript: page.profile.locale === "ar" }), [theme, page.profile.locale]);
  return (
    <aside
      aria-label={t("preview")}
      className={cn(
        "flex-col gap-3 border-s border-line bg-canvas-muted p-4",
        "xl:sticky xl:top-0 xl:flex xl:h-dvh xl:w-preview xl:shrink-0 xl:box-content",
        open ? "layer-modal fixed inset-0 flex" : "hidden",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-small font-medium">
          {t("preview")}
          <span className="inline-flex items-center gap-1 text-caption text-success-strong">
            <Icon icon={Check} size="sm" />
            {t("synced")}
          </span>
        </p>
        <div className="flex items-center gap-1">
          <a
            href={pageHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-control-sm items-center gap-2 rounded-sm px-2 text-small font-medium text-link hover:bg-hover focus-visible:focus-ring"
          >
            {t("openPage")}
            <Icon icon={ExternalLink} size="sm" />
          </a>
          <IconButton icon={X} label={t("closePreview")} size="sm" onClick={onClose} className="xl:hidden" />
        </div>
      </div>
      <div
        className={cn(
          "relative mx-auto min-h-0 w-full max-w-preview flex-1 overflow-hidden rounded-xl border",
          tone === "dark" ? "border-line-strong" : "border-line",
        )}
        style={{ transform: "translateZ(0)" }}
      >
        <div className="absolute inset-0 overflow-y-auto overscroll-contain">
          <DirectionRenderer direction={direction} page={page} theme={resolved} sizes={sizes} preview />
        </div>
      </div>
    </aside>
  );
}
