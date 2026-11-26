"use client";

import { Button, IconButton, icons } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";

import { Tile } from "../list";
import { installApp, useInstallVariant } from "./install-store";

/** localStorage: the Home hint has been shown in this browser (it shows once). */
export const INSTALL_HINT_KEY = "linkyo.installHint";

const never = () => () => undefined;

/** Shown before, or storage that cannot remember it (then it never shows: it would come back on every visit). */
function readShownBefore(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_HINT_KEY) !== null;
  } catch {
    return true;
  }
}

function rememberShown() {
  try {
    window.localStorage.setItem(INSTALL_HINT_KEY, "shown");
  } catch {
    // Blocked storage was already read as "shown": nothing to remember.
  }
}

/**
 * Home's hint "Linkyo als App", where the browser itself offers to install it (Chrome and Edge on
 * computers, Android): one button for the browser's dialog and an X. It shows once in a browser: the
 * first Home that has the offer remembers it in localStorage, and it stays on that Home until it is
 * dismissed, used, or Home is left. Safari users find the steps in Settings › Linkyo als App.
 */
export function InstallHint() {
  const t = useTranslations("app.install.hint");
  const titleId = useId();
  const variant = useInstallVariant();
  const shownBefore = useSyncExternalStore(never, readShownBefore, () => true);
  const [visible, setVisible] = useState(false);
  const [decided, setDecided] = useState(false);
  if (!decided && variant === "prompt" && !shownBefore) {
    setDecided(true);
    setVisible(true);
  }
  useEffect(() => {
    if (visible) rememberShown();
  }, [visible]);

  if (!visible || variant !== "prompt") return null;
  return (
    <section aria-labelledby={titleId} data-install-hint className="flex items-start gap-3 rounded-lg bg-group p-4 lg:border lg:border-line">
      <Tile icon={icons.install} />
      <div className="grid min-w-0 flex-1 gap-1">
        <h2 id={titleId} className="text-body font-semibold">
          {t.rich("title", { bdi: (chunks: ReactNode) => <bdi>{chunks}</bdi> })}
        </h2>
        <p className="text-small font-regular text-fg-secondary">{t("body")}</p>
        <Button variant="primary" size="md" icon={icons.install} className="mt-2 justify-self-start" onClick={() => void installApp()}>
          {t("install")}
        </Button>
      </div>
      {/* 32 px to look at; on touch screens a 48 px target (the kit's small button reaches only 36 px). */}
      <IconButton variant="ghost" size="sm" icon={icons.close} label={t("dismiss")} className="-me-1 -mt-1 rounded-full pointer-coarse:before:-inset-2" onClick={() => setVisible(false)} />
    </section>
  );
}
