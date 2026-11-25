"use client";

import { Button, Icon, IconButton, toast } from "@linkyo/ui";
import { ChevronRight, Copy, QrCode as QrIcon, Share, type LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAccount } from "@/features/account/store";
import { copyText } from "@/lib/clipboard";
import { haptic } from "@/lib/haptics";
import { pageAddress, pageUrl, qrPageUrl } from "@/lib/page-url";

/** Links, QR codes and sharing use the one page address helper (lib/page-url.ts). */
export { pageUrl };

// The QR code (its encoder, drawing and files) comes in its own chunk, loaded the first time a QR
// sheet opens (`./share-qr.tsx`, ADR 0008).
const QrSheet = dynamic(() => import("./share-qr").then((module) => module.QrSheet), { ssr: false });

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
 * PNG, shareable where the phone can (`./share-qr.tsx`, loaded the first time it opens). A creator
 * page's code is drawn in the page's accent colour (`qrInk`); any other link of ours (an invite)
 * stays ink on white.
 */
export function QrButton({ compact = false, appearance = "button", ...target }: QrTarget & { compact?: boolean; appearance?: "button" | "row" }) {
  const t = useTranslations("app.share");
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  // Read when the sheet opens, not while rendering: the server has no navigator, and the footer must match.
  const [canShare, setCanShare] = useState(false);
  // `code` is what the QR code holds: a page's address marked `?src=qr` (a scan counts as "QR-Code" in
  // the page's statistics); `url` is what is shared as a link, `address` what people read.
  const { url, code, address, fileName } =
    target.username === undefined
      ? { ...target, code: target.url }
      : { url: pageUrl(target.username), code: qrPageUrl(target.username), address: pageAddress(target.username), fileName: `linkyo-${target.username}-qr.png` };
  // The signed-in owner's own page look (the link card and the welcome flow show the owner's code).
  const snapshot = useAccount();
  const theme = target.username !== undefined && snapshot.status === "signedIn" ? snapshot.site.theme : null;

  const show = () => {
    setCanShare(typeof navigator.share === "function");
    setShown(true);
    setOpen(true);
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
      {shown ? <QrSheet open={open} onOpenChange={setOpen} canShare={canShare} target={{ url, code, address, fileName, theme }} /> : null}
    </>
  );
}
