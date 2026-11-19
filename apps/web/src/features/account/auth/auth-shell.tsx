import { Icon, Logo } from "@linkyo/ui";
import { Check, FlaskConical } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { LocaleSwitch } from "@/components/locale-switch";
import { ThemeSwitch } from "@/components/theme-switch";
import { phoneShots, phoneSizes } from "@/features/marketing/assets";
import { Phone } from "@/features/marketing/phone";
import { Link } from "@/i18n/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Sign-up, log-in and reset share one frame: the form on a calm canvas, and on wide screens a dark
 * studio panel with two real creator pages, so people see where they are going.
 */
export function AuthShell({ locale, children }: { locale: string; children: ReactNode }) {
  const t = useTranslations("auth");
  const shots = phoneShots(locale);
  const points = t.raw("side.points") as string[];
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col px-5 pt-4 pb-6 md:px-10">
        <header className="flex items-center justify-between gap-3">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
          >
            {t("skip")}
          </a>
          <Link href="/" className="rounded-xs focus-visible:focus-ring" aria-label={t("home")}>
            <Logo className="h-6" title="Linkyo" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeSwitch />
            <LocaleSwitch />
          </div>
        </header>
        <main id="main" className="grid flex-1 place-items-center py-10">
          <div className="grid w-full max-w-preview grid-cols-1 gap-8">{children}</div>
        </main>
        {supabaseEnabled ? null : (
          <p className="mx-auto flex max-w-preview items-start gap-2 rounded-lg border border-line bg-canvas-muted p-3 text-caption text-fg-secondary">
            <Icon icon={FlaskConical} size="sm" className="mt-0.5 shrink-0 text-link" />
            <span>
              <strong className="font-semibold text-fg">{t("demo.title")}</strong> {t("demo.body")}
            </span>
          </p>
        )}
      </div>

      <aside data-theme="dark" aria-label={t("side.label")} className="relative isolate hidden overflow-clip bg-canvas text-fg lg:grid lg:place-items-center">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="mk-glow absolute -end-1/4 top-0 aspect-square w-3/4 rounded-full bg-primary opacity-secondary blur-ambient" />
          <div className="absolute -start-1/4 bottom-0 aspect-square w-1/2 rounded-full bg-primary-pressed opacity-disabled blur-ambient" />
        </div>
        <div className="relative grid w-full max-w-prose gap-10 px-10 py-16">
          <div aria-hidden className="relative mx-auto grid w-3/4 grid-cols-2 items-end gap-4">
            <Phone className="mk-phone-in translate-y-8 -rotate-3">
              <Image src={shots.pulse} alt="" fill sizes={phoneSizes.side} className="object-cover object-top" placeholder="blur" />
            </Phone>
            <Phone className="mk-phone-in rotate-3">
              <Image src={shots.nocturne} alt="" fill sizes={phoneSizes.side} className="object-cover object-top" placeholder="blur" />
            </Phone>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <p className="text-h2 text-balance">{t("side.title")}</p>
            <ul className="grid grid-cols-1 gap-2">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-body text-fg-secondary">
                  <Icon icon={Check} size="sm" className="mt-1 shrink-0 text-success-strong" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Title + lead of an auth form. */
export function AuthHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <h1 className="text-h1 tracking-tight">{title}</h1>
      <p className="text-body text-fg-secondary">{lead}</p>
    </div>
  );
}
