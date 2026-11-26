"use client";

import { ConfirmDialog, Icon, icons, toast } from "@linkyo/ui";
import {
  Check,
  CircleUserRound,
  Download,
  FileText,
  FileX,
  Gift,
  Languages,
  Link2,
  LockKeyhole,
  LogOut,
  Receipt,
  Scale,
  ShieldCheck,
  SunMoon,
  Undo2,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ThemeSwitch } from "@/components/theme-switch";
import { accountStore } from "@/features/account/store";
import { useOnTeam } from "@/features/admin/live";
import { openExternal } from "@/features/app-mode/bridge";
import { appDownload } from "@/features/app-mode/bridge-files";
import { useAppMode } from "@/features/app-mode/use-app-mode";
import { legalLinksVisible } from "@/features/legal/company";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { paymentsEnabled } from "@/lib/flags";
import { pageAddress } from "@/lib/page-url";
import { browserSupabase } from "@/lib/supabase/browser";

import { useLegalDraft } from "./drafts";
import { pickFiles } from "./images";
import { parseImport, type ImportedSite } from "./import";
import { InstallRow } from "./install/install-row";
import { legalStatus } from "./legal";
import { ListGroup, ListRow, PickerRow, SegmentedRow } from "./list";
import { ProfileSheet } from "./profile-form";
import { INVITE_HREF } from "./routes";
import { Screen } from "./screen";
import { PlanRow } from "./settings/plan-screen";
import { ProfileAvatar } from "./shell";
import { useSite, type SiteDoc } from "./site-context";

/** Each language in its own name and voice. */
const LANGUAGES = [
  { value: "de", label: "Deutsch", lang: "de" },
  { value: "en", label: "English", lang: "en" },
  { value: "ar", label: "العربية", lang: "ar" },
] as const satisfies readonly { value: Locale; label: string; lang: string }[];

/**
 * Links and bookmarks to the sections of the old one-page Settings (the Home checklist, emails):
 * a section that became a pane opens it; one that stayed here is scrolled to.
 */
const PANES: Record<string, string> = {
  "#legal": "/app/settings/legal",
  "#address-title": "/app/settings/address",
  "#account-title": "/app/settings/account",
  "#signins-title": "/app/settings/account#signins",
};
const GROUPS: Record<string, string> = { "#dashboard-title": "app", "#data-title": "data" };

function useOldHashes(openProfile: () => void) {
  const router = useRouter();
  useEffect(() => {
    const follow = () => {
      const { hash } = window.location;
      const pane = PANES[hash];
      if (pane) {
        router.replace(pane);
        return;
      }
      const group = GROUPS[hash];
      const profile = hash === "#profile-title";
      if (!group && !profile) return;
      // The address loses the old hash, so a reload or Back does not repeat this.
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
      if (profile) openProfile();
      else document.getElementById(group ?? "")?.scrollIntoView({ block: "start" });
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [router, openProfile]);
}

/**
 * Downloads everything the account holds as one JSON file (Settings › Data, and the delete dialog's
 * "export first"), and answers the file's name. A change still waiting for autosave goes in too. In
 * the iPhone app the file goes to the app, which offers to save or share it (a WebView downloads
 * nothing from a link).
 */
export function useExportData(): () => Promise<string> {
  const { account, flush } = useSite();
  return useCallback(async () => {
    flush();
    const name = `linkyo-${account.username}-export.json`;
    const blob = new Blob([await accountStore.exportData()], { type: "application/json" });
    if (await appDownload(blob, name)) return name;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
    return name;
  }, [account.username, flush]);
}

/** Export and import: the page as a file, and a page back from such a file (undoable, the legal notice too). */
function DataGroup() {
  const t = useTranslations("app.settings");
  const { account, site, doc, dispatch, latest } = useSite();
  const exportData = useExportData();
  const [legalDraft, setLegalDraft] = useLegalDraft(account.id);
  const [incoming, setIncoming] = useState<ImportedSite | null>(null);
  const chooseImport = async () => {
    const [file] = await pickFiles({ accept: "application/json,.json" });
    if (!file) return;
    const parsed = parseImport(await file.text());
    if (parsed) setIncoming(parsed);
    else toast({ title: t("importInvalid"), tone: "danger" });
  };
  const applyImport = () => {
    if (!incoming) return;
    const before = doc;
    const imported: SiteDoc = {
      ...doc,
      profile: { ...incoming.page.profile, username: account.username },
      blocks: incoming.page.blocks,
      theme: incoming.theme,
    };
    dispatch({ type: "replace", doc: imported });
    const { legal } = incoming;
    const legalBefore = site.legal;
    const draftBefore = legalDraft;
    if (legal) {
      accountStore.updateSite((current) => ({ ...current, legal }));
      // Unsaved edits of the old notice would hide the imported one, and a Save would overwrite it.
      setLegalDraft(null);
    }
    setIncoming(null);
    toast({
      title: t("imported"),
      tone: "success",
      action: {
        label: t("undo"),
        onAction: () => {
          // Takes back the import only. After a later change (a page language picked meanwhile) a plain
          // undo would take back that change instead, so nothing happens; ⌘Z still steps back through both.
          const now = latest();
          if (now !== imported && now !== before) return;
          // ⌘Z may have taken the page back already; the legal notice is not in that history.
          if (now === imported) dispatch({ type: "undo" });
          if (!legal) return;
          accountStore.updateSite((current) => ({ ...current, legal: legalBefore }));
          if (draftBefore) setLegalDraft(draftBefore);
        },
      },
    });
  };
  return (
    <>
      <ListGroup title={t("groups.data")} titleId="data" footer={t("footers.data")}>
        <ListRow icon={Download} title={t("export")} accessory="none" onClick={() => void exportData()} />
        <ListRow icon={Upload} title={t("import")} accessory="none" onClick={() => void chooseImport()} />
      </ListGroup>
      <ConfirmDialog
        open={incoming !== null}
        onOpenChange={(open) => {
          if (!open) setIncoming(null);
        }}
        title={t("importTitle")}
        description={t("importBody", {
          name: incoming?.page.profile.displayName ?? "",
          count: incoming?.page.blocks.length ?? 0,
        })}
        confirmLabel={t("importConfirm")}
        cancelLabel={t("cancel")}
        destructive={false}
        onConfirm={applyImport}
      />
    </>
  );
}

/** The account's newest page-service order, for the Settings row (null while none exists). */
function useNewestOrder(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!paymentsEnabled) return;
    let cancelled = false;
    void browserSupabase()
      .rpc("my_orders")
      .then(({ data }) => {
        const first: unknown = Array.isArray(data) ? data[0] : null;
        const newest = first && typeof first === "object" && "id" in first && typeof first.id === "string" ? first.id : null;
        if (!cancelled) setId(newest);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return id;
}

/**
 * Contracts and legal: the newest order, "Vertrag widerrufen" and "Verträge hier kündigen" where
 * contracts can be made (payments on), and Linkyo's legal pages once they are linked anywhere
 * (`legalLinksVisible`). Withdrawal and cancellation also work signed out (the footer says so).
 *
 * In the iPhone app nothing is sold and nothing leads to a contract (App Store 3.1.1, 3.1.3(f)): no
 * order, withdrawal or cancellation row. The AGB state prices, so the app opens them in Safari; the
 * Impressum and the privacy policy open in the app, without the website's header and footer.
 */
function ContractsGroup() {
  const t = useTranslations("app.settings");
  const locale = useLocale();
  const app = useAppMode();
  const newestOrder = useNewestOrder();
  const contracts = paymentsEnabled && !app;
  if (!contracts && !legalLinksVisible) return null;
  return (
    <ListGroup title={t("groups.contracts")} titleId="contracts" footer={contracts ? t("footers.contracts") : undefined}>
      {contracts && newestOrder ? <ListRow icon={Receipt} title={t("rows.orders")} href={`/app/orders/${newestOrder}`} /> : null}
      {contracts ? <ListRow icon={Undo2} title={t("rows.withdraw")} href="/widerruf" /> : null}
      {contracts ? <ListRow icon={FileX} title={t("rows.cancel")} href="/kuendigen" /> : null}
      {legalLinksVisible ? <ListRow icon={Scale} title={t("rows.imprint")} href="/impressum" /> : null}
      {legalLinksVisible ? <ListRow icon={LockKeyhole} title={t("rows.privacy")} href="/datenschutz" /> : null}
      {legalLinksVisible && app ? (
        <ListRow
          icon={FileText}
          title={t("rows.terms")}
          accessory={<Icon icon={icons.external} size="sm" className="text-fg-tertiary" />}
          onClick={() => openExternal(`/${locale}/agb`)}
        />
      ) : null}
      {legalLinksVisible && !app ? <ListRow icon={FileText} title={t("rows.terms")} href="/agb" /> : null}
    </ListGroup>
  );
}

/**
 * Settings, as a grouped list like iOS Settings: every row shows its current value, and what needs
 * typing opens its own pane (address, legal notice, account) or the Profile sheet. Choices that
 * apply at once (page language, appearance, app language) are changed right in their row. The page
 * sits beside it on wide screens, so a new profile or page language shows live.
 */
export function SettingsScreen() {
  const t = useTranslations("app.settings");
  const tApp = useTranslations("app");
  const tInvite = useTranslations("app.invite");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { account, site, doc, dispatch } = useSite();
  const onTeam = useOnTeam(account.email);
  // The team area stays on the website, and signing out is the app's own: the iPhone app shows neither.
  const app = useAppMode();
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  useOldHashes(openProfile);

  const legal = legalStatus(site.legal);

  return (
    <Screen title={t("title")} preview>
      {/* One grouped list: the group headers already set the groups apart, so they sit closer than the cards of other screens. */}
      <div className="grid grid-cols-1 gap-4">
        {/* The plan first (D-03): what the account has, AI drafts left, and payments where they exist. */}
        <ListGroup>
          <PlanRow icon={icons.billing} />
        </ListGroup>

        <ListGroup title={t("groups.page")} titleId="page" footer={t("footers.pageLanguage")}>
          <ListRow
            leading={<ProfileAvatar size="sm" />}
            title={t("rows.profile")}
            subtitle={doc.profile.displayName}
            subtitleDir="auto"
            onClick={openProfile}
          />
          <ListRow
            icon={Link2}
            title={t("rows.address")}
            subtitle={pageAddress(account.username)}
            subtitleDir="ltr"
            href="/app/settings/address"
          />
          <ListRow
            icon={Scale}
            title={t("rows.legal")}
            value={
              legal === "complete" ? (
                <span className="inline-flex items-center gap-1">
                  <Icon icon={Check} size="sm" className="text-success-strong" />
                  {t("legalState.complete")}
                </span>
              ) : (
                t(`legalState.${legal}`)
              )
            }
            href="/app/settings/legal"
          />
          <PickerRow
            icon={Languages}
            label={t("rows.pageLanguage")}
            value={doc.profile.locale}
            options={LANGUAGES}
            onValue={(next) => dispatch({ type: "profile", patch: { locale: next } })}
          />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={CircleUserRound}
            title={t("rows.account")}
            subtitle={account.email}
            subtitleDir="ltr"
            href="/app/settings/account"
          />
          {onTeam && !app ? <ListRow icon={ShieldCheck} title={tApp("teamArea")} href="/admin" /> : null}
          {/* Phones have no rail: Invite is always reachable from here (its back link says "‹ Settings"). */}
          <ListRow icon={Gift} title={tInvite("title")} href={INVITE_HREF} className="lg:hidden" />
        </ListGroup>

        <ListGroup title={t("groups.app")} titleId="app" footer={t("footers.app")}>
          <SegmentedRow icon={SunMoon} label={t("theme")}>
            <ThemeSwitch
              withSystem
              size="md"
              label={t("theme")}
              className="pointer-coarse:h-control-lg w-full *:flex-1 sm:w-auto sm:*:flex-none"
            />
          </SegmentedRow>
          <PickerRow
            icon={Languages}
            label={t("rows.appLanguage")}
            value={locale}
            options={LANGUAGES}
            onValue={(next) => router.replace(pathname, { locale: next })}
          />
          <InstallRow />
        </ListGroup>

        <DataGroup />

        <ContractsGroup />

        {/* Logging out is safe (nothing is lost), so it is a plain row, not a red one. Last "Log out" on the screen.
          Not in the iPhone app: it signs out natively (its own Settings row), ending this web view's session
          with the app's own; a web-only sign-out would land on the sign-in page, which the app answers by
          signing the web view straight back in. */}
        {app ? null : (
          <ListGroup
            footer={
              accountStore.demo ? (
                <span className="text-caption text-fg-tertiary">{t("demoNote")}</span>
              ) : undefined
            }
          >
            <ListRow icon={LogOut} title={t("logout")} accessory="none" onClick={() => accountStore.logOut()} />
          </ListGroup>
        )}
      </div>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </Screen>
  );
}
