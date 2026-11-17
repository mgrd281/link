"use client";

import { Button, toast } from "@linkyo/ui";
import { Copy, Download, QrCode as QrIcon, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { encode } from "uqr";

import { copyText } from "@/lib/clipboard";

import { Sheet } from "./sheet";

export const pageUrl = (username: string) => `https://linkyo.app/${username}`;

/** The QR code as SVG squares in the current text color (crisp at any size, prints well). */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, data } = useMemo(() => encode(value, { ecc: "M", border: 2 }), [value]);
  const path = useMemo(() => {
    let d = "";
    data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return d;
  }, [data]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={size} height={size} className="fill-white" />
      <path d={path} className="fill-ink" />
    </svg>
  );
}

/** Copy / share the page address. Share uses the system sheet on phones, copy everywhere else. */
export function ShareButtons({ username, compact = false }: { username: string; compact?: boolean }) {
  const t = useTranslations("app.share");
  const url = pageUrl(username);
  const copy = async () => {
    const ok = await copyText(url);
    toast({ title: ok ? t("copied") : t("copyFailed"), tone: ok ? "success" : "danger" });
  };
  return (
    <>
      <Button icon={Copy} onClick={() => void copy()} size={compact ? "md" : "lg"}>
        {t("copy")}
      </Button>
      <Button
        icon={Share2}
        size={compact ? "md" : "lg"}
        onClick={() => {
          if (typeof navigator.share === "function") void navigator.share({ title: `linkyo.app/${username}`, url }).catch(() => undefined);
          else void copy();
        }}
      >
        {t("share")}
      </Button>
    </>
  );
}

/** QR code for posters, flyers and merch: shown large, downloadable as PNG. */
export function QrButton({ username, compact = false }: { username: string; compact?: boolean }) {
  const t = useTranslations("app.share");
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const url = pageUrl(username);

  const download = () => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    // Paint with the theme's resolved colors (no hard-coded values), 1024 px for print.
    const style = getComputedStyle(holder.current as HTMLElement);
    const { size, data } = encode(url, { ecc: "M", border: 2 });
    const scale = Math.floor(1024 / size);
    const canvas = document.createElement("canvas");
    canvas.width = size * scale;
    canvas.height = size * scale;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = style.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = style.color;
    data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) context.fillRect(x * scale, y * scale, scale, scale);
      }),
    );
    const link = document.createElement("a");
    link.download = `linkyo-${username}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <>
      <Button icon={QrIcon} size={compact ? "md" : "lg"} onClick={() => setOpen(true)}>
        {t("qr")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("qrTitle")}
        description={t("qrLead")}
        closeLabel={t("close")}
        footer={
          <Button variant="primary" icon={Download} onClick={download}>
            {t("download")}
          </Button>
        }
      >
        <div className="grid justify-items-center gap-4">
          <div ref={holder} className="w-full max-w-menu rounded-xl border border-line bg-white p-4 text-ink shadow-e2">
            <QrCode value={url} label={t("qrLabel", { url: `linkyo.app/${username}` })} className="w-full" />
          </div>
          <p dir="ltr" className="font-mono text-small text-fg-secondary">
            linkyo.app/{username}
          </p>
        </div>
      </Sheet>
    </>
  );
}
