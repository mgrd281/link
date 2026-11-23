"use client";

import { Icon, Logo } from "@linkyo/ui";
import { ArrowRight } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { CREATOR_DOMAIN } from "@/lib/page-url";

/**
 * The way back from a project address that answers "not found": to the page it sits under. A
 * `not-found.tsx` receives no params, so this small island reads them: `/<username>` on public
 * pages, `/<locale>/p/<slug>` on example pages. The address follows the words, left to right.
 */
export function ProjectNotFoundLink() {
  const t = useTranslations("creator.portfolio");
  const params = useParams<{ username?: string; locale?: string; slug?: string }>();
  const href = params.username ? `/${params.username}` : params.locale && params.slug ? `/${params.locale}/p/${params.slug}` : null;
  if (!href) return null;
  const address = params.username ? `${CREATOR_DOMAIN}/${params.username}` : href;
  return (
    <a
      href={href}
      data-project-back
      className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:focus-ring group inline-flex min-h-control-xl max-w-full items-center gap-2 rounded-full px-6 text-body font-semibold transition-colors duration-micro"
    >
      <span className="min-w-0 truncate">
        {t("toPage")} <bdi dir="ltr">{address}</bdi>
      </span>
      <Icon icon={ArrowRight} size="md" className="shrink-0 duration-micro transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
    </a>
  );
}

/**
 * Linkyo's calm "not found" page for a project address, in the language of the page around it:
 * what happened, and the way back. Rendered from the messages the page already has, so the
 * segment's `not-found.tsx` needs no request data of its own (a project route stays static).
 */
export function ProjectNotFound() {
  const t = useTranslations("creator.portfolio");
  return (
    <main className="bg-canvas text-fg grid min-h-dvh place-items-center px-4 py-16">
      <div className="grid max-w-prose justify-items-center gap-6 text-center">
        <Logo className="h-8" title="Linkyo" />
        <h1 className="text-h2 font-semibold text-balance">{t("projectMissing")}</h1>
        <ProjectNotFoundLink />
      </div>
    </main>
  );
}
