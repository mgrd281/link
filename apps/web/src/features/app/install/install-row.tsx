"use client";

import { icons } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { useAppMode } from "@/features/app-mode/use-app-mode";

import { ListRow } from "../list";
import { InstallSheet } from "./install-sheet";
import { useInstallVariant } from "./install-store";

/**
 * Settings › App: "Linkyo als App", with "Installiert" as its value inside the installed app. Opens the
 * install sheet. Not in the iPhone app (app mode): that already is the app.
 */
export function InstallRow() {
  const t = useTranslations("app.install");
  const [open, setOpen] = useState(false);
  const installed = useInstallVariant() === "installed";
  const app = useAppMode();
  if (app) return null;
  return (
    <>
      <ListRow icon={icons.install} title={t.rich("row", { bdi: (chunks: ReactNode) => <bdi>{chunks}</bdi> })} value={installed ? t("installedValue") : undefined} onClick={() => setOpen(true)} />
      <InstallSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
