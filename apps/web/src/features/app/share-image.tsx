"use client";

import { hasImage } from "@linkyo/blocks";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Button, cn, Segmented, toast } from "@linkyo/ui";
import { Download, ImageDown, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { themeStyle } from "@/features/creator/theme";
import { initials } from "@/features/directions/shared/creator-kit";
import { resolveMedia } from "@/features/directions/shared/media";
import { drawShareArt, loadFaces, SHARE_SIZES, type ShareFormat } from "@/features/share/story-card";

import { Sheet } from "./sheet";
import { useSite } from "./site-context";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

/**
 * "Picture for your story": the page's photo, name, line and address as an image to post, in the
 * page's own template (colors, display face, black and white for Mono). Story 9:16 or post 4:5;
 * shared through the phone's share sheet (straight to Instagram) or downloaded.
 */
export function ShareImageButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("app.shareImage");
  const { doc, account } = useSite();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShareFormat>("story");
  // The format whose picture is drawn (sharing waits for it).
  const [drawn, setDrawn] = useState<ShareFormat | null>(null);
  const ready = open && drawn === format;
  // The sheet mounts its content after opening: draw once the canvas and the font probe exist.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [fonts, setFonts] = useState<HTMLSpanElement | null>(null);
  const { profile } = doc;
  const rtl = profile.locale === "ar";
  const theme = useMemo(() => resolveCreatorTheme(doc.theme, { rtlScript: rtl }), [doc.theme, rtl]);
  const address = `linkyo.app/${account.username}`;
  const fileName = `linkyo-${account.username}-${format}.png`;

  useEffect(() => {
    if (!open) return;
    const run = new AbortController();
    const draw = async () => {
      const probe = fonts?.querySelector<HTMLElement>("[data-face=display]");
      const bodyProbe = fonts?.querySelector<HTMLElement>("[data-face=body]");
      const target = canvas;
      if (!probe || !bodyProbe || !target) return;
      const display = getComputedStyle(probe).fontFamily;
      const body = getComputedStyle(bodyProbe).fontFamily;
      const displayWeight = getComputedStyle(probe).fontWeight;
      await loadFaces(display, displayWeight, body);
      const photoSource = profile.hero ?? profile.avatar;
      const resolved = hasImage(photoSource) ? resolveMedia(photoSource.src) : null;
      const photo = resolved ? await loadImage(typeof resolved === "string" ? resolved : resolved.src) : null;
      if (run.signal.aborted) return;
      const { palette } = theme;
      drawShareArt(target, format, {
        name: profile.displayName,
        line: profile.tagline ?? profile.bio,
        address,
        photo,
        focal: photoSource.focal,
        colors: { bg: palette.bg, fg: palette.fg, muted: palette.fgMuted, accent: palette.accent, accentFg: palette.accentFg, surface: palette.surface2 },
        display,
        displayWeight,
        body,
        upper: Boolean((theme.pairing.display as { uppercase?: boolean }).uppercase),
        rtl,
        grey: theme.layout.hero === "mono",
        initials: initials(profile.displayName),
      });
      setDrawn(format);
    };
    void draw();
    return () => {
      run.abort();
    };
  }, [address, canvas, fonts, format, open, profile, rtl, theme]);

  const blob = () =>
    new Promise<Blob | null>((resolve) => {
      if (canvas) canvas.toBlob(resolve, "image/png");
      else resolve(null);
    });

  const download = async () => {
    const file = await blob();
    if (!file) return;
    const link = document.createElement("a");
    link.download = fileName;
    link.href = URL.createObjectURL(file);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const share = async () => {
    const data = await blob();
    if (!data) return;
    const file = new File([data], fileName, { type: "image/png" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: address }).catch(() => undefined);
    } else {
      await download();
      toast({ title: t("downloaded"), tone: "success" });
    }
  };

  const size = SHARE_SIZES[format];

  return (
    <>
      <Button icon={ImageDown} size={compact ? "md" : "lg"} onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("lead")}
        closeLabel={t("close")}
        footer={
          <>
            <Button icon={Download} disabled={!ready} onClick={() => void download()}>
              {t("download")}
            </Button>
            <Button variant="primary" icon={Share2} disabled={!ready} onClick={() => void share()}>
              {t("share")}
            </Button>
          </>
        }
      >
        <div className="grid justify-items-center gap-4">
          <Segmented
            label={t("format")}
            value={format}
            onValueChange={setFormat}
            options={[
              { value: "story", label: t("formats.story") },
              { value: "post", label: t("formats.post") },
            ]}
          />
          {/* The canvas is the picture; its description is the figure's caption for screen readers. */}
          <figure aria-label={t("preview", { name: profile.displayName, address })} className={cn("grid", format === "story" ? "w-3/5 max-w-menu" : "w-4/5 max-w-menu")}>
            <canvas ref={setCanvas} aria-hidden width={size.width} height={size.height} className="h-auto w-full rounded-lg border border-line" />
          </figure>
          <p className="max-w-prose text-center text-caption text-fg-tertiary">{t(`hints.${format}`, { address })}</p>
        </div>
        {/* Reads the page's real font stacks (the canvas can't resolve CSS variables itself). */}
        <span ref={setFonts} aria-hidden style={themeStyle(theme)} className="pointer-events-none absolute size-0 overflow-hidden opacity-0">
          <span data-face="display" className="font-creator-display" style={{ fontWeight: "var(--creator-display-weight)" }}>
            Aa
          </span>
          <span data-face="body" className="font-creator-body">
            Aa
          </span>
        </span>
      </Sheet>
    </>
  );
}
