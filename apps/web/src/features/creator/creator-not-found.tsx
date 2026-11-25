import { Button, Icon, Logo } from "@linkyo/ui";
import { ArrowRight } from "lucide-react";

/**
 * An address nobody has (yet): Linkyo's own calm page with the way to make one. Its words come from the
 * not-found file (`app/u/[username]/not-found.tsx`), which loads this through `./not-found-lazy.tsx`, so
 * the button's code comes with this page only and not with every creator page (ADR 0008).
 */
export function CreatorNotFoundScreen({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <main className="bg-canvas text-fg grid min-h-dvh place-items-center px-4 py-16">
      <div className="grid max-w-prose justify-items-center gap-6 text-center">
        <Logo className="h-8" title="Linkyo" />
        <div className="grid gap-2">
          <h1 className="text-h2 font-semibold text-balance">{title}</h1>
          <p className="text-body text-fg-secondary text-pretty">{body}</p>
        </div>
        <Button asChild variant="primary" size="cta" className="group">
          <a href={href}>
            {cta}
            <Icon icon={ArrowRight} size="md" className="duration-micro transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </a>
        </Button>
      </div>
    </main>
  );
}
