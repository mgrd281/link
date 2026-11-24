"use client";

import { Button, Icon } from "@linkyo/ui";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { ListGroup, ListRow } from "@/features/app/list";
import { useSite } from "@/features/app/site-context";
import { Link } from "@/i18n/navigation";

import { useAiQuota } from "./quota";

/**
 * Home's way to the AI builder, only while the AI is on for this account. While the page is still
 * empty or a starter, the next step is a card ("Let the AI build your page"); once the page is
 * ready, a quiet row to rebuild it.
 */
export function AiHomeCard({ ready }: { ready: boolean }) {
  const t = useTranslations("app.home.ai");
  const { account } = useSite();
  const { enabled } = useAiQuota({ account: account.id });
  if (!enabled) return null;
  if (ready) {
    return (
      <ListGroup>
        <ListRow icon={Sparkles} title={t("rebuild")} href="/app/build?mode=rebuild" />
      </ListGroup>
    );
  }
  return (
    <section aria-labelledby="ai-home-title" data-ai-home className="grid grid-cols-1 gap-4 rounded-lg bg-group p-4 lg:border lg:border-line lg:p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-control-lg shrink-0 place-items-center rounded-md bg-tinted text-tinted-fg">
          <Icon icon={Sparkles} size="md" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 id="ai-home-title" className="text-title rtl:tracking-normal">
            {t("title")}
          </h2>
          <p className="text-small font-regular text-fg-secondary">{t("body")}</p>
        </div>
      </div>
      <Button asChild variant="tinted" size="lg" className="w-full sm:w-auto sm:justify-self-start" trailing={<Icon icon={ArrowRight} size="md" />}>
        <Link href="/app/build">{t("cta")}</Link>
      </Button>
    </section>
  );
}
