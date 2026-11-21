"use client";

import { Button, IconButton, Skeleton, toast } from "@linkyo/ui";
import { Copy, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { inviteAddress, inviteHost, inviteUrl } from "@/features/referrals/links";
import { copyText } from "@/lib/clipboard";
import { haptic } from "@/lib/haptics";

import { NAV_ANCHORS } from "../routes";
import { QrButton } from "../share-tools";

/**
 * The invite link and how to hand it out, with the anatomy of Home's link card. Sharing is the
 * screen's one primary action; copy is a quiet button beside the address it copies, and the QR code
 * a row. The address reads left to right in every language: the host may be cut off on a phone,
 * the code never is.
 *
 * The eyebrow is always there (also while loading, and with an error), because the section panel's
 * "Your invite link" jumps to it. Without a code yet, `error` takes the place of the link, or
 * skeletons of its shape while it loads.
 */
export function InviteLinkCard({ code, error }: { code: string | null; error?: ReactNode }) {
  const t = useTranslations("app.invite");
  return (
    <section aria-labelledby={NAV_ANCHORS.inviteLink} className="grid grid-cols-1 gap-4 rounded-lg bg-group p-4 lg:border lg:border-line lg:p-6">
      <div className="grid grid-cols-1 gap-1">
        {/* A jump target of the section panel: focusable by script, no ring of its own. */}
        <p id={NAV_ANCHORS.inviteLink} tabIndex={-1} className="text-caption font-semibold text-fg-secondary outline-none">
          {t("link.eyebrow")}
        </p>
        {code ? <Address code={code} /> : error ? null : <Skeleton className="h-control-md w-full" />}
      </div>
      {code ? (
        <Actions code={code} />
      ) : (
        (error ?? (
          <>
            <Skeleton className="h-control-lg w-full rounded-md" />
            <Skeleton className="h-control-lg w-full rounded-md" />
          </>
        ))
      )}
    </section>
  );
}

/** Copy and share for the invite link: the system share sheet where there is one, copy everywhere else. */
function useInviteLink(code: string) {
  const t = useTranslations("app.invite");
  const tShare = useTranslations("app.share");
  const url = inviteUrl(code);
  const copy = async () => {
    const ok = await copyText(url);
    toast({ title: ok ? t("link.copied") : tShare("copyFailed"), tone: ok ? "success" : "danger" });
  };
  const share = () => {
    if (typeof navigator.share === "function") void navigator.share({ title: "Linkyo", text: t("link.shareText"), url }).catch(() => undefined);
    else void copy();
  };
  return { url, copy, share };
}

function Address({ code }: { code: string }) {
  const t = useTranslations("app.invite");
  const { copy } = useInviteLink(code);
  return (
    <div className="flex items-center gap-2">
      {/* Left to right in every language; in Arabic it still hugs the start (right). The host gives way first. */}
      <p dir="ltr" className="flex min-w-0 flex-1 text-body font-semibold sm:text-h3 rtl:justify-end">
        <span className="truncate text-fg-secondary">{inviteHost()}/i/</span>
        <span className="shrink-0">{code}</span>
      </p>
      <IconButton
        variant="tinted"
        icon={Copy}
        label={t("link.copy")}
        onClick={() => {
          haptic();
          void copy();
        }}
      />
    </div>
  );
}

function Actions({ code }: { code: string }) {
  const t = useTranslations("app.invite");
  const { url, share } = useInviteLink(code);
  return (
    <>
      <Button
        variant="primary"
        size="lg"
        block
        icon={Share}
        onClick={() => {
          haptic();
          share();
        }}
      >
        {t("link.share")}
      </Button>
      {/* The row runs to the card's edges; its icon still lines up with the content above. */}
      <ul className="-mx-4 lg:-mx-6 lg:[&_button]:px-6">
        <li>
          <QrButton url={url} address={inviteAddress(code)} fileName={`linkyo-invite-${code}-qr.png`} appearance="row" />
        </li>
      </ul>
    </>
  );
}
