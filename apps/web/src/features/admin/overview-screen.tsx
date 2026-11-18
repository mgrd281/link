"use client";

import { Button, Icon } from "@linkyo/ui";
import { ArrowRight, CircleCheck, FilePen, FlaskConical, Plus, Rocket, UsersRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Panel, Screen } from "@/features/app/screen";
import { useNow } from "@/features/directions/poster/live";
import { Link } from "@/i18n/navigation";

import { ActivityList } from "./activity-screen";
import { useCreatorRows, usePublished } from "./data";
import { useAdmin } from "./session";

function Stat({ icon, label, value, href }: { icon: LucideIcon; label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="grid min-w-0 gap-3 rounded-xl border border-line bg-surface p-4 shadow-e1 transition-colors duration-micro hover:border-line-input focus-visible:focus-ring">
      <span className="grid size-control-md place-items-center rounded-md bg-selected text-selected-fg">
        <Icon icon={icon} size="sm" />
      </span>
      <span className="grid gap-0.5">
        <span className="text-h2 tabular-nums">{value}</span>
        <span className="truncate text-small text-fg-secondary">{label}</span>
      </span>
    </Link>
  );
}

/** Where things stand at a glance: pages by status, the team, and what changed last. */
export function OverviewScreen() {
  const t = useTranslations("admin.overview");
  const { db, me, can } = useAdmin();
  const published = usePublished(db.token);
  const rows = useCreatorRows(db, published);
  const now = useNow();
  const count = (status: "draft" | "ready" | "published") => rows.filter((row) => row.status === status).length;
  const live = published.status === "ready" ? String(published.pages.length) : "–";

  return (
    <Screen
      title={t("title", { name: me.name.split(" ")[0] ?? me.name })}
      lead={t("lead")}
      wide
      actions={
        can("pages.create") ? (
          <Button asChild variant="primary">
            <Link href="/admin/creators">
              <Icon icon={Plus} size="sm" />
              {t("newPage")}
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Rocket} label={t("published")} value={live} href="/admin/creators" />
        <Stat icon={CircleCheck} label={t("ready")} value={count("ready")} href="/admin/creators" />
        <Stat icon={FilePen} label={t("drafts")} value={count("draft")} href="/admin/creators" />
        <Stat icon={UsersRound} label={t("team")} value={db.members.length} href="/admin/team" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title={t("recent")}
          id="recent-title"
          action={
            <Link href="/admin/activity" className="inline-flex items-center gap-1 rounded-sm text-small font-medium text-link hover:underline focus-visible:focus-ring">
              {t("allActivity")}
              <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
            </Link>
          }
        >
          {db.activity.length > 0 ? <ActivityList events={db.activity.slice(0, 6)} now={now} /> : <p className="text-small text-fg-secondary">{t("noActivity")}</p>}
        </Panel>
        <Panel title={t("howTitle")} id="how-title">
          <ol className="grid grid-cols-1 gap-3">
            {(["step1", "step2", "step3", "step4"] as const).map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="grid size-control-sm shrink-0 place-items-center rounded-full bg-selected text-caption font-semibold text-selected-fg tabular-nums">{index + 1}</span>
                <span className="text-small">{t(`how.${step}`)}</span>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-2 rounded-md bg-canvas-muted px-3 py-2 text-small text-fg-secondary">
            <Icon icon={FlaskConical} size="sm" className="mt-0.5 shrink-0" />
            <span>{t("demo")}</span>
          </p>
        </Panel>
      </div>
    </Screen>
  );
}
