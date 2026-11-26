import { Logo } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { LegalLinks } from "@/features/legal/legal-links";
import { Link } from "@/i18n/navigation";

import { AuthWall } from "./auth-wall";

/**
 * Sign-up and sign-in share one frame: the logo, the form on white, and on wide screens a tilted
 * wall of example pages, so people see what they are about to make. Nothing else but the legal pages
 * at the foot: language and light/dark live on the homepage (the language comes along in the address).
 * Inside Linkyo's iPhone app (app mode, `data-app-hide`) neither the logo's link to the homepage and
 * its prices nor the legal foot with its contract links shows: the app signs in natively and comes
 * here only for a moment, when the web view's session has ended.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("auth");
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-2">
      <div className="flex min-w-0 flex-col px-5 pt-5 pb-6 md:px-12 lg:px-16">
        <header className="flex items-center">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
          >
            {t("skip")}
          </a>
          <Link href="/" data-app-hide className="rounded-xs focus-visible:focus-ring" aria-label={t("home")}>
            <Logo className="h-8" title="Linkyo" />
          </Link>
        </header>
        <main id="main" className="grid flex-1 place-items-center py-12">
          <div className="grid w-full max-w-creator grid-cols-1 gap-6">{children}</div>
        </main>
        {/* The legal pages, as at the foot of the website (named, or links once the company details are in). */}
        <footer data-app-hide className="text-small text-fg-secondary md:text-caption">
          <LegalLinks />
        </footer>
      </div>
      <AuthWall />
    </div>
  );
}

/** Title + lead of an auth step: one short line each, like "Sign up for free" / "Ready to be linkyo?". */
export function AuthHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="grid grid-cols-1 gap-1">
      <h1 id="auth-title" tabIndex={-1} className="text-h2 tracking-display text-balance outline-none md:text-display-sm">
        {title}
      </h1>
      <p id="auth-lead" className="text-body text-pretty text-fg-secondary md:text-body-lg">
        {lead}
      </p>
    </div>
  );
}
