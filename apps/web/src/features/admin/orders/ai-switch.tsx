"use client";

import { Icon, Switch, toast } from "@linkyo/ui";
import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useState } from "react";

import { useAdmin } from "../session";

import { loadAiStatus, setAiEnabled, type AiStatus } from "./orders-data";

/** Today's AI spend in US dollars (the API bills in dollars), from micro-dollars. */
const dollars = (micros: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", numberingSystem: "latn" }).format(micros / 1_000_000);

/**
 * The AI kill switch in the orders header: every AI draft (customers' and the team's) stops while it
 * is off. Shown with `security.view`, switchable with `security.manage`; today's runs and spend
 * beside it.
 */
export function AiSwitch() {
  const t = useTranslations("admin.orders.ai");
  const tErrors = useTranslations("legal.errors");
  const locale = useLocale();
  const { can } = useAdmin();
  const id = useId();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = can("security.view");
  const editable = can("security.manage");

  const refresh = useCallback(async () => {
    try {
      setStatus(await loadAiStatus());
    } catch {
      setStatus(null);
    }
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    loadAiStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible || !status) return null;
  const change = async (next: boolean) => {
    setBusy(true);
    try {
      await setAiEnabled(next);
      await refresh();
    } catch {
      toast({ title: tErrors("server"), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-ai-switch className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
      <Icon icon={Sparkles} size="sm" className="shrink-0 text-fg-secondary" />
      <span className="grid min-w-0">
        <label htmlFor={id} className="text-small font-semibold">
          {t("label")}
        </label>
        <span className="text-caption text-fg-secondary">{t("today", { runs: status.runs, spent: dollars(status.spentMicros, locale) })}</span>
      </span>
      <Switch id={id} checked={status.enabled} disabled={!editable || busy} onCheckedChange={(next) => void change(next)} />
    </div>
  );
}
