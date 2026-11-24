"use client";

import { Button, cn, Logo } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";

import { AREA_HOME, areaOf, isOrderPath, type ErrorArea } from "./area";

/**
 * Linkyo's own page for an address that does not exist or a screen that failed: the logo, one plain
 * sentence and the way back, in the visitor's language. It takes the colours of the part the address
 * belongs to: the dashboard's black and grey under /app (data-console, ADR 0062), teal elsewhere.
 * Kept small and server-friendly: Next.js sends a segment's not-found and error files with every
 * route below it.
 */
function ErrorFrame({ area, children }: { area: ErrorArea; children: ReactNode }) {
  const inConsole = area === "app";
  return (
    <main
      id="main"
      data-console={inConsole ? "frame" : undefined}
      className={cn("grid min-h-dvh place-items-center px-4 pt-16 pb-16 text-fg", inConsole ? "bg-canvas-muted" : "bg-canvas")}
    >
      <div className="grid w-full max-w-prose justify-items-center gap-8 text-center">
        <Logo className="h-8" tone={inConsole ? "mono" : "brand"} />
        {children}
      </div>
    </main>
  );
}

function Message({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="grid gap-3">
      <h1 className="text-h2 font-semibold text-balance rtl:tracking-normal">{title}</h1>
      <p className="text-body text-pretty text-fg-secondary">{body}</p>
      {children}
    </div>
  );
}

/** Two actions: equal and full width, stacked on phones; side by side from small tablets on. */
const actionsRow = "flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center";
const actionWidth = "w-full sm:w-auto";

/** One button shape per page: the website's pill (ADR 0059), the product's own buttons in its areas. */
const sizeFor = (frame: ErrorArea) => (frame === "site" ? "cta" : "xl");

/** The main way back of an area (the home page, the dashboard or the team area), shaped for the page it sits on. */
function HomeLink({ area, frame, variant }: { area: ErrorArea; frame: ErrorArea; variant: "primary" | "tinted" }) {
  const t = useTranslations("errors.actions");
  const label = area === "app" ? t("dashboard") : area === "admin" ? t("team") : t("home");
  return (
    <Button asChild variant={variant} size={sizeFor(frame)} className={actionWidth}>
      <Link href={AREA_HOME[area]}>{label}</Link>
    </Button>
  );
}

/** The page for an address nobody has: in the site's language, with the ways back that fit its part of Linkyo. */
export function NotFoundScreen() {
  const t = useTranslations("errors");
  const pathname = usePathname();
  const area = areaOf(pathname);
  const body =
    area === "app"
      ? isOrderPath(pathname) && !supabaseEnabled
        ? t("notFound.ordersDemo")
        : t("notFound.appBody")
      : area === "admin"
        ? t("notFound.teamBody")
        : t("notFound.body");
  return (
    <ErrorFrame area={area}>
      <Message title={t("notFound.title")} body={body} />
      <div className={actionsRow}>
        <HomeLink area={area} frame={area} variant="primary" />
        {area === "site" ? (
          <Button asChild variant="tinted" size="cta" className={actionWidth}>
            <Link href="/templates">{t("actions.templates")}</Link>
          </Button>
        ) : (
          <HomeLink area="site" frame={area} variant="tinted" />
        )}
      </div>
    </ErrorFrame>
  );
}

/** The error's reference for support, when the server gave one (never the message: it may hold details). */
function digestOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("digest" in error)) return null;
  return typeof error.digest === "string" && error.digest ? error.digest : null;
}

/** A page that failed to render: what happened, try again, or the way back. */
export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("errors");
  const area = areaOf(usePathname());
  const digest = digestOf(error);
  return (
    <ErrorFrame area={area}>
      <Message title={t("error.title")} body={t("error.body")}>
        {digest ? (
          <p className="text-caption text-fg-secondary">
            {t("error.reference")} <bdi dir="ltr">{digest}</bdi>
          </p>
        ) : null}
      </Message>
      <div className={actionsRow}>
        <Button variant="primary" size={sizeFor(area)} className={actionWidth} onClick={retry}>
          {t("actions.retry")}
        </Button>
        <HomeLink area={area} frame={area} variant="tinted" />
      </div>
    </ErrorFrame>
  );
}
