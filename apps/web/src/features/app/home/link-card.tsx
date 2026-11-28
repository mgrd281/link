"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { accountStore } from "@/features/account/store";
import { CREATOR_DOMAIN } from "@/lib/page-url";

import { useSite } from "../site-context";
import { Disclosure } from "../disclosure";
import { HelpLink } from "../help-link";
import { NAV_ANCHORS } from "../routes";
import { ShareImageButton } from "../share-image";
import { CopyLinkButton, QrButton, ShareLinkButton } from "../share-tools";

/** The inset hairline of the dashboard's rows (as `ListRow` draws it): from the text to the end. */
const rowSeparator =
  "relative not-first:before:absolute not-first:before:start-16 not-first:before:end-0 not-first:before:top-0 not-first:before:border-t not-first:before:border-line";

/**
 * Where the page lives and how to hand it out. While the page is still being built, sharing is the
 * quiet (tinted) action; once it is ready, the card says so, "Share" becomes the screen's one primary,
 * and a short how-to explains where the link goes. The reach line never promises a public page
 * before there is one: the demo says the page lives in this browser, a real account that it is public.
 */
export function LinkCard({ username, ready }: { username: string; ready: boolean }) {
  const t = useTranslations("app.home");
  const tVisibility = useTranslations("app.visibility");
  const { doc } = useSite();
  const titleId = useId();
  return (
    // While the page is being built the eyebrow names the card; once it is ready, the title does.
    <section aria-labelledby={ready ? titleId : NAV_ANCHORS.homeLink} className="grid grid-cols-1 gap-4 rounded-lg bg-group p-4 lg:border lg:border-line lg:p-6">
      <div className="grid grid-cols-1 gap-1">
        {/* Always there: the section panel's "Your link" jumps here (focusable by script, no ring of its own). */}
        <p id={NAV_ANCHORS.homeLink} tabIndex={-1} className="text-caption font-semibold text-fg-secondary outline-none">
          {t("yourLink")}
        </p>
        {ready ? (
          <>
            <h2 id={titleId} className="text-title rtl:tracking-normal">
              {t("link.readyTitle")}
            </h2>
            <p className="text-small font-regular text-fg-secondary">{t("link.readyBody")}</p>
          </>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-1">
        <div className="flex items-center gap-2">
          {/* An address reads left to right in every language; in Arabic it still hugs the start (right). */}
          <p dir="ltr" className="min-w-0 flex-1 truncate text-start text-h3 font-semibold rtl:text-right">
            <span className="text-fg-secondary">{CREATOR_DOMAIN}/</span>
            {username}
          </p>
          <CopyLinkButton username={username} />
        </div>
        {/* The demo keeps everything in this browser; a real account's page is public at this address. */}
        {/* A paused page is not public (Settings › Sichtbarkeit): the line never says it is. */}
        <p className="text-small font-regular text-fg-secondary">{accountStore.demo ? t("linkDemo") : doc.profile.visibility?.paused ? tVisibility("homePaused") : t("link.live")}</p>
      </div>
      <ShareLinkButton username={username} variant={ready ? "primary" : "tinted"} />
      {ready ? (
        <Disclosure summary={t("link.howTo")}>
          <p className="pt-1 text-small font-regular text-fg-secondary">{t("link.howToBody")}</p>
        </Disclosure>
      ) : null}
      {/* The rows run to the card's edges on phones; their icons line up with the content above, and
          the hairline between them starts at the text, as in every list of the dashboard. */}
      <ul className="-mx-4">
        <li className={rowSeparator}>
          <QrButton username={username} appearance="row" />
        </li>
        <li className={rowSeparator}>
          <ShareImageButton appearance="row" />
        </li>
      </ul>
      <HelpLink slug="teilen" />
    </section>
  );
}
