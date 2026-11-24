"use client";

import { Button, Icon, LogoSymbol, TextField } from "@linkyo/ui";
import { ArrowRight, KeyRound, LogOut, ShieldX, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useState, type ReactNode, type SubmitEvent } from "react";

import { accountStore, useAccount } from "@/features/account/store";
import type { Account } from "@/features/account/types";
import { BrandSplash } from "@/features/app/gate";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";

import { bdi } from "./bidi";
import { refreshLive, useLiveTeam } from "./live";
import { adminStore, useAdminDb } from "./store";
import { can, type AdminDb, type Member, type Permission, type Role } from "./types";

interface AdminValue {
  account: Account;
  db: AdminDb;
  me: Member;
  /** The role screens follow: the member's own, or the one an owner is previewing. */
  role: Role;
  viewAs: Role | null;
  setViewAs: (role: Role | null) => void;
  can: (permission: Permission) => boolean;
}

const AdminContext = createContext<AdminValue | null>(null);

export function useAdmin(): AdminValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin() outside <AdminGate>");
  return value;
}

/**
 * Guards /admin: a Linkyo account is required, and that account's email must be on the team. The
 * very first visitor with the team code sets the team up and becomes its owner.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  return supabaseEnabled ? <LiveGate>{children}</LiveGate> : <DemoGate>{children}</DemoGate>;
}

/**
 * Real accounts: the team is a table in the database. Membership and role decide, nothing else
 * (no team code); the first owner is made once with make_owner() in the SQL editor.
 */
function LiveGate({ children }: { children: ReactNode }) {
  const snapshot = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (snapshot.status === "signedOut") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [snapshot.status, pathname, router]);
  if (snapshot.status !== "signedIn") return <BrandSplash />;
  return <LiveTeamGate account={snapshot.account}>{children}</LiveTeamGate>;
}

function LiveTeamGate({ account, children }: { account: Account; children: ReactNode }) {
  const team = useLiveTeam();
  const local = useAdminDb();
  const [viewAs, setViewAs] = useState<Role | null>(null);
  // Another account signed in: read the team again.
  useEffect(() => {
    void refreshLive();
  }, [account.id]);
  if (team.status === "loading" || local === null) return <BrandSplash />;
  if (team.status === "none") return <NoAccess account={account} />;
  const role = team.me.role === "owner" && viewAs ? viewAs : team.me.role;
  // Prepared pages are still kept in this browser and published by script; their history with them.
  const pageActivity = local.activity.filter((event) => event.action.startsWith("page.") || event.action.startsWith("invite."));
  const db: AdminDb = {
    version: 1,
    members: team.members,
    drafts: local.drafts,
    activity: [...team.activity, ...pageActivity].sort((a, b) => b.at.localeCompare(a.at)),
  };
  const value: AdminValue = {
    account,
    db,
    me: team.me,
    role,
    viewAs: team.me.role === "owner" ? viewAs : null,
    setViewAs,
    can: (permission) => can(role, permission),
  };
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

/** Demo: the team lives in this browser; the first visitor with the team code becomes its owner. */
function DemoGate({ children }: { children: ReactNode }) {
  const snapshot = useAccount();
  const db = useAdminDb();
  const router = useRouter();
  const pathname = usePathname();
  const [viewAs, setViewAs] = useState<Role | null>(null);

  useEffect(() => {
    if (snapshot.status === "signedOut") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [snapshot.status, pathname, router]);

  if (snapshot.status !== "signedIn" || db === null) return <BrandSplash />;
  if (db.members.length === 0) return <TeamSetup account={snapshot.account} />;
  const me = db.members.find((member) => member.email === snapshot.account.email);
  if (!me) return <NoAccess account={snapshot.account} />;

  const role = me.role === "owner" && viewAs ? viewAs : me.role;
  const value: AdminValue = {
    account: snapshot.account,
    db,
    me,
    role,
    viewAs: me.role === "owner" ? viewAs : null,
    setViewAs,
    can: (permission) => can(role, permission),
  };
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

function GateCard({ icon, title, lead, children }: { icon: LucideIcon; title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10 text-fg">
      <div className="grid w-full max-w-preview grid-cols-1 gap-6 rounded-xl border border-line bg-surface p-6 md:p-8">
        <div className="flex items-center gap-3">
          <LogoSymbol className="size-control-lg" />
          <span className="grid size-control-lg place-items-center rounded-lg bg-selected text-selected-fg">
            <Icon icon={icon} size="md" />
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <h1 className="text-h2 tracking-tight">{title}</h1>
          <div className="text-body text-fg-secondary">{lead}</div>
        </div>
        {children}
      </div>
    </main>
  );
}

/** First visit: the team code proves this person belongs to Linkyo; they become the owner. */
function TeamSetup({ account }: { account: Account }) {
  const t = useTranslations("admin.gate");
  const [name, setName] = useState(account.username);
  const [code, setCode] = useState("");
  const [error, setError] = useState<"code" | "name" | "network" | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("name");
      document.getElementById("team-name")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const result = (await response.json()) as { ok: boolean; token?: string };
      if (result.ok && result.token) {
        adminStore.setupOwner({ email: account.email, name: name.trim() }, result.token);
        return;
      }
      setError("code");
      document.getElementById("team-code")?.focus();
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GateCard icon={KeyRound} title={t("setupTitle")} lead={t("setupLead", { email: account.email })}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-5">
        <TextField
          id="team-name"
          label={t("name")}
          size="lg"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          autoComplete="name"
          error={error === "name" ? t("nameMissing") : undefined}
        />
        <TextField
          id="team-code"
          label={t("code")}
          size="lg"
          type="password"
          ltr
          icon={KeyRound}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          hint={t.rich("codeHint", { bdi })}
          error={error === "code" ? t("codeWrong") : error === "network" ? t("network") : undefined}
        />
        <Button type="submit" variant="primary" size="xl" block loading={busy} trailing={<Icon icon={ArrowRight} size="md" />}>
          {t("setupSubmit")}
        </Button>
      </form>
      <Link href="/app" className="justify-self-start text-small font-semibold text-link focus-visible:focus-ring hover:text-fg transition-colors duration-micro">
        {t("backToApp")}
      </Link>
    </GateCard>
  );
}

/** Signed in, but not on the team: say who to ask, offer a way out. */
function NoAccess({ account }: { account: Account }) {
  const t = useTranslations("admin.gate");
  return (
    <GateCard icon={ShieldX} title={t("noAccessTitle")} lead={t("noAccessLead", { email: account.email })}>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/app"
          className="inline-flex h-control-lg items-center gap-2 rounded-md bg-primary px-5 text-body font-semibold text-primary-fg hover:bg-primary-hover focus-visible:focus-ring"
        >
          {t("backToApp")}
        </Link>
        <Button size="lg" variant="ghost" icon={LogOut} onClick={() => accountStore.logOut()}>
          {t("switchAccount")}
        </Button>
      </div>
    </GateCard>
  );
}
