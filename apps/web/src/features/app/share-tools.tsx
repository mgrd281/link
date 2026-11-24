"use client";

import { generatePalette, resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { Button, Icon, IconButton, toast } from "@linkyo/ui";
import { ChevronRight, Copy, Download, QrCode as QrIcon, Share, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { encode } from "uqr";

import { useAccount } from "@/features/account/store";
import { copyText } from "@/lib/clipboard";
import { haptic } from "@/lib/haptics";
import { pageAddress, pageUrl } from "@/lib/page-url";

import { Sheet } from "./sheet";

/** Links, QR codes and sharing use the one page address helper (lib/page-url.ts). */
export { pageUrl };

/** ISO/IEC 18004 asks for four modules of quiet zone, so a code printed on a colored flyer still scans. */
const QR_BORDER = 4;

/** The modules of a QR code as one SVG path of unit squares, and the code's size in modules. */
export function qrModules(value: string): { size: number; path: string } {
  const { size, data } = encode(value, { ecc: "M", border: QR_BORDER });
  let path = "";
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return { size, path };
}

/** Text for an XML attribute or element (the title names the address; nothing else is free text). */
const xml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);

/**
 * The QR code as a standalone SVG file for print: vector squares in `color` on `background` (both
 * resolved colours, never literals here), about 1024 px wide when placed without a size, titled
 * with the address it leads to.
 */
export function qrSvg({ value, title, color, background }: { value: string; title: string; color: string; background: string }): string {
  const { size, path } = qrModules(value);
  const side = String(size);
  const width = String(size * Math.floor(1024 / size));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${width}" height="${width}" shape-rendering="crispEdges">`,
    `<title>${xml(title)}</title>`,
    `<rect width="${side}" height="${side}" fill="${xml(background)}"/>`,
    `<path d="${path}" fill="${xml(color)}"/>`,
    "</svg>",
  ].join("");
}

/**
 * The colour a creator page's QR code is printed in: the page's accent, at the lightness the theme
 * engine gives accent text on a light page, so it keeps at least 4.5:1 against the white paper
 * around it (a scanner needs the contrast; a pale accent would not scan). Hue and chroma stay.
 */
export function qrInk(theme: CreatorThemeConfig): string {
  const { accent } = resolveCreatorTheme(theme).palette;
  return generatePalette({ accent, mode: "light" }).accentText;
}

/**
 * The QR code as SVG squares, ink on white (crisp at any size, prints well), or in `color` (a
 * resolved colour such as a page's accent from `qrInk`, never a literal).
 */
export function QrCode({ value, label, className, color }: { value: string; label: string; className?: string; color?: string | null }) {
  const { size, path } = useMemo(() => qrModules(value), [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={size} height={size} className="fill-white" />
      <path d={path} className="fill-ink" style={color ? { fill: color } : undefined} />
    </svg>
  );
}

/** Copy and share for one page address: the system share sheet where there is one, copy everywhere else. */
function useShareLink(username: string) {
  const t = useTranslations("app.share");
  const url = pageUrl(username);
  const copy = async () => {
    const ok = await copyText(url);
    toast({ title: ok ? t("copied") : t("copyFailed"), tone: ok ? "success" : "danger" });
  };
  const share = () => {
    if (typeof navigator.share === "function") void navigator.share({ title: pageAddress(username), url }).catch(() => undefined);
    else void copy();
  };
  return { copy, share };
}

/** Copy / share the page address as two buttons (the welcome flow's done step). */
export function ShareButtons({ username, compact = false }: { username: string; compact?: boolean }) {
  const t = useTranslations("app.share");
  const { copy, share } = useShareLink(username);
  return (
    <>
      <Button icon={Copy} onClick={() => void copy()} size={compact ? "md" : "lg"}>
        {t("copy")}
      </Button>
      <Button icon={Share} size={compact ? "md" : "lg"} onClick={share}>
        {t("share")}
      </Button>
    </>
  );
}

/** Copy belongs with the address it copies: a quiet icon button at the end of the address line. */
export function CopyLinkButton({ username }: { username: string }) {
  const t = useTranslations("app.share");
  const { copy } = useShareLink(username);
  return (
    <IconButton
      variant="tinted"
      icon={Copy}
      label={t("copy")}
      onClick={() => {
        haptic();
        void copy();
      }}
    />
  );
}

/**
 * Hands the address to the phone's share sheet (iOS includes Copy there). Home's one primary once the
 * page is ready; while it is still being built, the next step is the primary and this one is tinted.
 */
export function ShareLinkButton({ username, className, variant = "primary" }: { username: string; className?: string; variant?: "primary" | "tinted" }) {
  const t = useTranslations("app.share");
  const { share } = useShareLink(username);
  return (
    <Button
      variant={variant}
      size="lg"
      block
      icon={Share}
      className={className}
      onClick={() => {
        haptic();
        share();
      }}
    >
      {t("share")}
    </Button>
  );
}

/**
 * A list row that opens a share tool, with the dashboard's row anatomy (as in Settings): a 32 px
 * tinted icon tile, the label, and a chevron that points into the reading direction. Focus is drawn
 * inside the row, so a list that runs to its card's edges never clips it.
 */
export function ShareToolRow({ icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-control-lg w-full items-center gap-4 px-4 py-2 text-start text-body leading-snug transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-field lg:pointer-fine:min-h-touch-target"
    >
      <span className="grid size-control-sm shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg">
        <Icon icon={icon} size="sm" />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <Icon icon={ChevronRight} size="sm" className="text-fg-tertiary" />
    </button>
  );
}

/**
 * What a QR code points to: a creator's page address (`username`), or any other link of ours, such as
 * an invite link, with the address as people read it and the PNG's file name.
 */
type QrTarget = { username: string; url?: never; address?: never; fileName?: never } | { url: string; address: string; fileName: string; username?: never };

/**
 * QR code for posters, flyers and merch: shown large, downloadable as SVG (vector, for print) and
 * PNG, shareable where the phone can. A creator page's code is drawn in the page's accent colour
 * (`qrInk`); any other link of ours (an invite) stays ink on white.
 */
export function QrButton({ compact = false, appearance = "button", ...target }: QrTarget & { compact?: boolean; appearance?: "button" | "row" }) {
  const t = useTranslations("app.share");
  const [open, setOpen] = useState(false);
  // Read when the sheet opens, not while rendering: the server has no navigator, and the footer must match.
  const [canShare, setCanShare] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const { url, address, fileName } =
    target.username === undefined
      ? target
      : { url: pageUrl(target.username), address: pageAddress(target.username), fileName: `linkyo-${target.username}-qr.png` };
  // The signed-in owner's own page look (the link card and the welcome flow show the owner's code).
  const snapshot = useAccount();
  const theme = target.username !== undefined && snapshot.status === "signedIn" ? snapshot.site.theme : null;
  const ink = useMemo(() => (theme ? qrInk(theme) : null), [theme]);
  const bdi = { bdi: (chunks: ReactNode) => <bdi>{chunks}</bdi> };

  const show = () => {
    setCanShare(typeof navigator.share === "function");
    setOpen(true);
  };

  /** The code at about 1024 px for print, painted with the theme's resolved colors (no hard-coded values). */
  const paint = () => {
    const box = holder.current;
    if (!box?.querySelector("svg")) return null;
    const style = getComputedStyle(box);
    const { size, data } = encode(url, { ecc: "M", border: QR_BORDER });
    const scale = Math.floor(1024 / size);
    const canvas = document.createElement("canvas");
    canvas.width = size * scale;
    canvas.height = size * scale;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = style.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = style.color;
    data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) context.fillRect(x * scale, y * scale, scale, scale);
      }),
    );
    return canvas;
  };

  const download = () => {
    const canvas = paint();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = fileName;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  /** The same code as a vector file, in the colours shown on screen. */
  const downloadSvg = () => {
    const box = holder.current;
    if (!box) return;
    const style = getComputedStyle(box);
    const svg = qrSvg({ value: url, title: t("qrLabel", { url: address }), color: style.color, background: style.backgroundColor });
    const link = document.createElement("a");
    link.download = fileName.replace(/\.png$/, ".svg");
    link.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    link.click();
    URL.revokeObjectURL(link.href);
  };

  /** The PNG itself where the phone can share files (Messages, AirDrop, a print app); otherwise the address. */
  const sharePng = async () => {
    haptic();
    const canvas = paint();
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
    if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: address }).catch(() => undefined);
    } else {
      await navigator.share({ title: address, url }).catch(() => undefined);
    }
  };

  return (
    <>
      {appearance === "row" ? (
        <ShareToolRow icon={QrIcon} label={t("qr")} onClick={show} />
      ) : (
        <Button icon={QrIcon} size={compact ? "md" : "lg"} onClick={show}>
          {t("qr")}
        </Button>
      )}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("qrTitle")}
        description={t("qrLead")}
        closeLabel={t("close")}
        footer={
          // Phones: one full-width button per line, the vector file (for print) on top.
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
            {canShare ? (
              <Button variant="ghost" icon={Share} onClick={() => void sharePng()}>
                {t("share")}
              </Button>
            ) : null}
            <Button variant="tinted" icon={Download} onClick={download}>
              {t("download")}
            </Button>
            <Button variant="primary" icon={Download} onClick={downloadSvg}>
              {t.rich("downloadSvg", bdi)}
            </Button>
          </div>
        }
      >
        <div className="grid justify-items-center gap-4">
          {/* The code's colour is the page's accent (from the theme engine, never a literal), else ink. */}
          <div
            ref={holder}
            data-qr-ink={ink ? "accent" : "ink"}
            className="w-full max-w-menu rounded-xl border border-line bg-white p-4 text-ink"
            style={ink ? { color: ink } : undefined}
          >
            <QrCode value={url} label={t("qrLabel", { url: address })} color={ink} className="w-full" />
          </div>
          <p dir="ltr" className="font-mono text-small text-fg-secondary">
            {address}
          </p>
          {ink ? <p className="text-center text-small text-fg-secondary">{t.rich("qrAccent", bdi)}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
