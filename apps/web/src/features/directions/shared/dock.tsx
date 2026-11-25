import { Icon, Logo } from "@linkyo/ui";
import { ArrowRight, X } from "lucide-react";
import { useLocale } from "next-intl";

import { localePath } from "@/lib/locale-path";

import { LinkyoDockIsland } from "./dock-island";

/**
 * The Linkyo bar on creator pages (`./dock-island.tsx`): it slides up once visitors scroll past the
 * hero and can be closed. Its logo and icons are drawn here, on the server for a public page, and its
 * call to action is a plain link to the address in the page's language (what the router's link
 * renders), so the visitor's browser loads no icon kit and no router link code for it (ADR 0008).
 */
export function LinkyoDock({ title, cta, href, closeLabel }: { title: string; cta: string; href: string; closeLabel: string }) {
  const locale = useLocale();
  return (
    <LinkyoDockIsland
      title={title}
      cta={cta}
      href={localePath(href, locale)}
      closeLabel={closeLabel}
      parts={{
        logo: <Logo className="h-5 shrink-0" title="Linkyo" />,
        arrow: <Icon icon={ArrowRight} size="sm" />,
        close: <Icon icon={X} size="sm" />,
      }}
    />
  );
}
