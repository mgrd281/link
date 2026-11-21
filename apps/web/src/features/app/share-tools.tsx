"use client";

import { Button, Icon, IconButton, toast } from "@linkyo/ui";
import { ChevronRight, Copy, Download, QrCode as QrIcon, Share, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { encode } from "uqr";

import { copyText } from "@/lib/clipboard";
import { haptic } from "@/lib/haptics";

import { Sheet } from "./sheet";

export const pageUrl = (username: string) => `https://linkyo.app/${username}`;

/** ISO/IEC 18004 asks for four modules of quiet zone, so a code printed on a colored flyer still scans. */
const QR_BORDER = 4;

/** The QR code as SVG squares in the current text color (crisp at any size, prints well). */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, data } = useMemo(() => encode(value, { ecc: "M", border: QR_BORDER }), [value]);
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

/** Copy and share for one page address: the system share sheet where there is one, copy everywhere else. */
function useShareLink(username: string) {
  const t = useTranslations("app.share");
  const url = pageUrl(username);
  const copy = async () => {
    const ok = await copyText(url);
    toast({ title: ok ? t("copied") : t("copyFailed"), tone: ok ? "success" : "danger" });
  };
  const share = () => {
    if (typeof navigator.share === "function") void navigator.share({ title: `linkyo.app/${username}`, url }).catch(() => undefined);
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

/** The one primary action on Home: hand the address to the phone's share sheet (iOS includes Copy there). */
export function ShareLinkButton({ username, className }: { username: string; className?: string }) {
  const t = useTranslations("app.share");
  const { share } = useShareLink(username);
  return (
    <Button
      variant="primary"
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
 * A list row that opens a share tool, as in an iOS settings list: a small tinted icon square, the
 * label, and a chevron that points into the reading direction.
 */
export function ShareToolRow({ icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-control-xl w-full items-center gap-3 rounded-md px-1 text-start text-body font-medium transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-ring"
    >
      <span className="grid size-control-sm shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg">
        <Icon icon={icon} size="sm" />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <Icon icon={ChevronRight} size="sm" className="text-fg-tertiary rtl:-scale-x-100" />
    </button>
  );
}

/** QR code for posters, flyers and merch: shown large, downloadable as PNG, shareable where the phone can. */
export function QrButton({ username, compact = false, appearance = "button" }: { username: string; compact?: boolean; appearance?: "button" | "row" }) {
  const t = useTranslations("app.share");
  const [open, setOpen] = useState(false);
  // Read when the sheet opens, not while rendering: the server has no navigator, and the footer must match.
  const [canShare, setCanShare] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const url = pageUrl(username);
  const address = `linkyo.app/${username}`;
  const fileName = `linkyo-${username}-qr.png`;

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
          <>
            {canShare ? (
              <Button variant="tinted" icon={Share} onClick={() => void sharePng()}>
                {t("share")}
              </Button>
            ) : null}
            <Button variant="primary" icon={Download} onClick={download}>
              {t("download")}
            </Button>
          </>
        }
      >
        <div className="grid justify-items-center gap-4">
          <div ref={holder} className="w-full max-w-menu rounded-xl border border-line bg-white p-4 text-ink">
            <QrCode value={url} label={t("qrLabel", { url: address })} className="w-full" />
          </div>
          <p dir="ltr" className="font-mono text-small text-fg-secondary">
            {address}
          </p>
        </div>
      </Sheet>
    </>
  );
}
