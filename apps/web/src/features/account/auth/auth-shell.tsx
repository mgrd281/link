import { Icon, Logo } from "@linkyo/ui";
import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { LocaleSwitch } from "@/components/locale-switch";
import { ThemeSwitch } from "@/components/theme-switch";
import { Link } from "@/i18n/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";

import { AuthWall } from "./auth-wall";

/**
 * Sign-up and sign-in share one frame: the form on white, and on wide screens a tilted wall of
 * example pages, so people see what they are about to make.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("auth");
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-2">
      <div className="flex min-w-0 flex-col px-5 pt-5 pb-6 md:px-12 lg:px-16">
        <header className="flex items-center justify-between gap-3">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
          >
            {t("skip")}
          </a>
          <Link href="/" className="rounded-xs focus-visible:focus-ring" aria-label={t("home")}>
            <Logo className="h-8" title="Linkyo" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeSwitch />
            <LocaleSwitch />
          </div>
        </header>
        <main id="main" className="grid flex-1 place-items-center py-12">
          <div className="grid w-full max-w-preview grid-cols-1 gap-8">{children}</div>
        </main>
        {supabaseEnabled ? null : (
          <p className="mx-auto flex max-w-preview items-start gap-2 rounded-lg bg-canvas-muted p-3 text-caption text-fg-secondary">
            <Icon icon={FlaskConical} size="sm" className="mt-0.5 shrink-0 text-link" />
            <span>
              <strong className="font-semibold text-fg">{t("demo.title")}</strong> {t("demo.body")}
            </span>
          </p>
        )}
      </div>
      <AuthWall />
    </div>
  );
}

/** Title + lead of an auth step. */
export function AuthHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <h1 id="auth-title" tabIndex={-1} className="text-display tracking-display text-balance outline-none">
        {title}
      </h1>
      <p id="auth-lead" className="text-body-lg text-pretty text-fg-secondary">
        {lead}
      </p>
    </div>
  );
}
