"use client";

import { Button, Icon, icons } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Sheet } from "../sheet";
import { installApp, useInstallVariant } from "./install-store";

/** Latin names in the Arabic texts (Linkyo, Safari, Mac, Dock, Chrome, Edge) sit in <bdi>. */
const bdi = { bdi: (chunks: ReactNode) => <bdi>{chunks}</bdi> };

/** A numbered step: the number as a quiet disc (the list itself numbers it for screen readers). */
function Steps({ steps }: { steps: readonly ReactNode[] }) {
  return (
    // Safari (VoiceOver) drops the list semantics of a list without bullets unless the role is set.
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above
    <ol role="list" className="grid grid-cols-1 gap-3">
      {steps.map((step, at) => (
        // The steps are fixed and never reorder: their place is their key.
        <li key={at} className="flex items-start gap-3">
          <span aria-hidden className="grid size-control-sm shrink-0 place-items-center rounded-full bg-tinted text-small font-semibold text-tinted-fg tabular-nums">
            {at + 1}
          </span>
          <span className="min-w-0 pt-1 text-body">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * "Linkyo als App": how to install the dashboard on this device, and only the way that works here
 * (device.ts): Chrome, Edge and Android get one button that opens the browser's own dialog, iPhone and
 * iPad three steps with the share glyph, Safari on a Mac its menu path, the installed app a plain
 * "installed", Chrome or Edge without an offer the app's icon or the browser's menu. It promises
 * nothing else: no notifications, no App Store.
 */
export function InstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("app.install");
  const variant = useInstallVariant() ?? "other";
  const [busy, setBusy] = useState(false);
  const installed = variant === "installed";

  const install = async () => {
    setBusy(true);
    try {
      await installApp();
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (installed) {
    body = (
      <div className="flex items-start gap-3">
        <span className="grid size-control-sm shrink-0 place-items-center rounded-sm bg-success-subtle text-success-strong">
          <Icon icon={icons.success} size="sm" />
        </span>
        <p className="min-w-0 pt-1 text-body">{t.rich("installed.body", bdi)}</p>
      </div>
    );
  } else if (variant === "prompt") {
    body = (
      <div className="grid grid-cols-1 gap-4">
        <p className="text-body">{t.rich("prompt.body", bdi)}</p>
        <Button variant="primary" size="lg" icon={icons.install} loading={busy} className="justify-self-start max-sm:w-full" onClick={() => void install()}>
          {t("prompt.button")}
        </Button>
      </div>
    );
  } else if (variant === "later") {
    body = <p className="text-body">{t.rich("prompt.later", bdi)}</p>;
  } else if (variant === "ios") {
    body = (
      <div className="grid grid-cols-1 gap-4">
        <p className="text-body">{t.rich("ios.intro", bdi)}</p>
        <Steps
          steps={[
            t.rich("ios.step1", { glyph: () => <Icon icon={icons.share} size="sm" className="inline-block align-text-bottom" /> }),
            t("ios.step2"),
            t("ios.step3"),
          ]}
        />
      </div>
    );
  } else if (variant === "macSafari") {
    body = (
      <div className="grid grid-cols-1 gap-4">
        <p className="text-body">{t.rich("mac.intro", bdi)}</p>
        <Steps steps={[t.rich("mac.step", bdi)]} />
      </div>
    );
  } else if (variant === "chromium") {
    body = <p className="text-body">{t.rich("chromium.body", bdi)}</p>;
  } else {
    body = <p className="text-body">{t.rich("other.body", bdi)}</p>;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={installed ? t.rich("installed.title", bdi) : t.rich("title", bdi)} description={installed ? undefined : t("lead")} closeLabel={t("close")}>
      <div data-install-variant={variant}>{body}</div>
    </Sheet>
  );
}
