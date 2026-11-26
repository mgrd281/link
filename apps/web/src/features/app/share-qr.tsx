"use client";

import { generatePalette, resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { Button } from "@linkyo/ui";
import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, type ReactNode } from "react";
import { encode } from "uqr";

import { bridgeAvailable } from "@/features/app-mode/bridge";
import { appDownload, appShare } from "@/features/app-mode/bridge-files";
import { haptic } from "@/lib/haptics";

import { Sheet } from "./sheet";

/** The canvas as a PNG file (null where the browser cannot make one). */
const pngOf = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

/*
 * The QR code and its sheet. Loaded the first time a QR sheet opens (`QrButton` in `./share-tools.tsx`),
 * so the encoder and the drawing never come with the dashboard's first load (ADR 0008).
 */

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

/** What the sheet shows and hands out: the code's content, the link shared, the address read, the file's name. */
export interface QrSheetTarget {
  url: string;
  code: string;
  address: string;
  fileName: string;
  /** The owner's page look: its code is drawn in the page's accent (`qrInk`); otherwise ink on white. */
  theme: CreatorThemeConfig | null;
}

/**
 * The QR code for posters, flyers and merch: shown large, downloadable as SVG (vector, for print) and
 * PNG, shareable where the phone can.
 */
export function QrSheet({ open, onOpenChange, canShare, target }: { open: boolean; onOpenChange: (open: boolean) => void; canShare: boolean; target: QrSheetTarget }) {
  const t = useTranslations("app.share");
  const holder = useRef<HTMLDivElement>(null);
  const { url, code, address, fileName, theme } = target;
  const ink = useMemo(() => (theme ? qrInk(theme) : null), [theme]);
  const bdi = { bdi: (chunks: ReactNode) => <bdi>{chunks}</bdi> };

  /** The code at about 1024 px for print, painted with the theme's resolved colors (no hard-coded values). */
  const paint = () => {
    const box = holder.current;
    if (!box?.querySelector("svg")) return null;
    const style = getComputedStyle(box);
    const { size, data } = encode(code, { ecc: "M", border: QR_BORDER });
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

  // In the iPhone app both files go to the app, which saves or shares them (a WebView downloads nothing
  // from a link). In a browser they download as before.
  const download = () => {
    const canvas = paint();
    if (!canvas) return;
    if (bridgeAvailable()) {
      void pngOf(canvas).then((png) => (png ? appDownload(png, fileName) : false));
      return;
    }
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
    const svg = qrSvg({ value: code, title: t("qrLabel", { url: address }), color: style.color, background: style.backgroundColor });
    if (bridgeAvailable()) {
      void appDownload(new Blob([svg], { type: "image/svg+xml" }), fileName.replace(/\.png$/, ".svg"));
      return;
    }
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
    const blob = await pngOf(canvas);
    if (bridgeAvailable()) {
      await appShare({ title: address, url, file: blob ? { blob, name: fileName } : undefined });
      return;
    }
    const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
    if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: address }).catch(() => undefined);
    } else {
      await navigator.share({ title: address, url }).catch(() => undefined);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
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
          <QrCode value={code} label={t("qrLabel", { url: address })} color={ink} className="w-full" />
        </div>
        <p dir="ltr" className="font-mono text-small text-fg-secondary">
          {address}
        </p>
        {ink ? <p className="text-center text-small text-fg-secondary">{t.rich("qrAccent", bdi)}</p> : null}
      </div>
    </Sheet>
  );
}
