"use client";

import { Button, Icon } from "@linkyo/ui";
import { ArrowRight, PenTool, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/config";

interface WaitingProposal {
  id: string;
  aiAssisted: boolean;
}

/** The newest delivered, not yet used proposal of the signed-in account (`my_proposals()`), or null. */
async function waitingProposal(): Promise<WaitingProposal | null> {
  const { data, error } = await browserSupabase().rpc("my_proposals");
  if (error || !Array.isArray(data)) return null;
  const first = data[0] as { id?: unknown; aiAssisted?: unknown } | undefined;
  return first && typeof first.id === "string" ? { id: first.id, aiAssisted: first.aiAssisted === true } : null;
}

/**
 * Real accounts with the page service: a proposal from our team is waiting. What it says about who
 * made it follows how it was made (a page with AI content says so, with Sparkles; one designed by the
 * team says that, with a pen), never the package that was bought.
 */
export function ProposalCard() {
  const t = useTranslations("app.home.proposal");
  const [proposal, setProposal] = useState<WaitingProposal | null>(null);
  useEffect(() => {
    if (!supabaseEnabled) return;
    let live = true;
    void waitingProposal().then((found) => {
      if (live) setProposal(found);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!proposal) return null;
  return (
    <section aria-labelledby="proposal-title" data-proposal-card className="grid gap-4 rounded-lg border border-line-strong bg-surface p-4 lg:p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-control-lg shrink-0 place-items-center rounded-md bg-tinted text-tinted-fg">
          <Icon icon={proposal.aiAssisted ? Sparkles : PenTool} size="md" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 id="proposal-title" className="text-title rtl:tracking-normal">
            {t("title")}
          </h2>
          <p className="text-small font-regular text-fg-secondary">{proposal.aiAssisted ? t("bodyAi") : t("bodyTeam")}</p>
        </div>
      </div>
      <Button asChild variant="tinted" size="lg" className="w-full sm:w-auto sm:justify-self-start" trailing={<Icon icon={ArrowRight} size="md" />}>
        <Link href={`/app/proposals/${proposal.id}`}>{t("cta")}</Link>
      </Button>
    </section>
  );
}
