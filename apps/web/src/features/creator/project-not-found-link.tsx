"use client";

import { Icon, Logo } from "@linkyo/ui";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { CREATOR_DOMAIN } from "@/lib/page-url";

/** What the people index (`/api/people/<locale>`) says about a page: its owner's name and its address. */
interface Owner {
  name: string;
  href: string;
}

/**
 * The example page's owner, from the people index the search already serves as a static file
 * (same origin, no cookie, nothing typed is sent). A `not-found.tsx` gets no request data, so the
 * name cannot be rendered on the server; until it arrives (and without script) the button says
 * "Back to the page".
 */
function useExampleOwner(locale: string | undefined, slug: string | undefined): Owner | null {
  const [owner, setOwner] = useState<Owner | null>(null);
  useEffect(() => {
    if (!locale || !slug) return;
    let live = true;
    fetch(`/api/people/${encodeURIComponent(locale)}`)
      .then((response) => (response.ok ? (response.json() as Promise<{ people?: { slug?: unknown; name?: unknown; href?: unknown }[] }>) : null))
      .then((data) => {
        const person = data?.people?.find((candidate) => candidate.slug === slug);
        if (live && typeof person?.name === "string" && typeof person.href === "string" && person.href.startsWith("/")) setOwner({ name: person.name, href: person.href });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [locale, slug]);
  return owner;
}

/**
 * The way back from a project address that answers "not found": to the page it sits under. A
 * `not-found.tsx` receives no params, so this small island reads them: `/<username>` on public
 * pages (the button names the address, left to right), `/<locale>/p/<slug>` on example pages
 * ("Back to Ronja Feldkamp", in the example's own language).
 */
export function ProjectNotFoundLink() {
  const t = useTranslations();
  const params = useParams<{ username?: string; locale?: string; slug?: string }>();
  const example = params.username ? null : params.locale && params.slug ? { locale: params.locale, slug: params.slug } : null;
  const owner = useExampleOwner(example?.locale, example?.slug);
  const href = params.username ? `/${params.username}` : example ? (owner?.href ?? `/${example.locale}/p/${example.slug}`) : null;
  if (!href) return null;
  return (
    <a
      href={href}
      data-project-back
      className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:focus-ring group inline-flex min-h-control-xl max-w-full items-center gap-2 rounded-full px-6 text-body font-semibold transition-colors duration-micro"
    >
      {/* "Back to Ronja Feldkamp" points back; "To the page linkyo.app/mila" points on. */}
      {example ? <Icon icon={ArrowLeft} size="md" className="shrink-0 duration-micro transition-transform group-hover:-translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:translate-x-0.5" /> : null}
      <span dir="auto" className="min-w-0 truncate">
        {params.username ? (
          <>
            {t("creator.portfolio.toPage")} <bdi dir="ltr">{`${CREATOR_DOMAIN}/${params.username}`}</bdi>
          </>
        ) : owner ? (
          t("examples.notFoundBackTo", { name: owner.name })
        ) : (
          t("examples.notFoundBack")
        )}
      </span>
      {example ? null : <Icon icon={ArrowRight} size="md" className="shrink-0 duration-micro transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />}
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
