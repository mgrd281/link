"use client";

import { ConfirmDialog, Icon, toast } from "@linkyo/ui";
import {
  Check,
  CircleUserRound,
  Download,
  Languages,
  Link2,
  LogOut,
  Scale,
  ShieldCheck,
  SunMoon,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ThemeSwitch } from "@/components/theme-switch";
import { accountStore } from "@/features/account/store";
import { useOnTeam } from "@/features/admin/live";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { useLegalDraft } from "./drafts";
import { pickFiles } from "./images";
import { parseImport, type ImportedSite } from "./import";
import { legalStatus } from "./legal";
import { ListGroup, ListRow, PickerRow, SegmentedRow } from "./list";
import { ProfileSheet } from "./profile-form";
import { Screen } from "./screen";
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

/** Export and import: the page as a file, and a page back from such a file (undoable, the legal notice too). */
function DataGroup() {
  const t = useTranslations("app.settings");
  const { account, site, doc, dispatch, flush, latest } = useSite();
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
  const exportData = async () => {
    // A change still waiting for autosave goes into the file too.
    flush();
    const blob = new Blob([await accountStore.exportData()], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `linkyo-${account.username}-export.json`;
    link.click();
    URL.revokeObjectURL(link.href);
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

/**
 * Settings, as a grouped list like iOS Settings: every row shows its current value, and what needs
 * typing opens its own pane (address, legal notice, account) or the Profile sheet. Choices that
 * apply at once (page language, appearance, app language) are changed right in their row. The page
 * sits beside it on wide screens, so a new profile or page language shows live.
 */
export function SettingsScreen() {
  const t = useTranslations("app.settings");
  const tApp = useTranslations("app");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { account, site, doc, dispatch } = useSite();
  const onTeam = useOnTeam(account.email);
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  useOldHashes(openProfile);

  const legal = legalStatus(site.legal);

  return (
    <Screen title={t("title")} preview>
      {/* One grouped list: the group headers already set the groups apart, so they sit closer than the cards of other screens. */}
      <div className="grid grid-cols-1 gap-4">
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
            subtitle={`linkyo.app/${account.username}`}
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
          {onTeam ? <ListRow icon={ShieldCheck} title={tApp("teamArea")} href="/admin" /> : null}
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
        </ListGroup>

        <DataGroup />

        {/* Logging out is safe (nothing is lost), so it is a plain row, not a red one. Last "Log out" on the screen. */}
        <ListGroup
          footer={
            accountStore.demo ? (
              <span className="text-caption text-fg-tertiary">{t("demoNote")}</span>
            ) : undefined
          }
        >
          <ListRow icon={LogOut} title={t("logout")} accessory="none" onClick={() => accountStore.logOut()} />
        </ListGroup>
      </div>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </Screen>
  );
}
