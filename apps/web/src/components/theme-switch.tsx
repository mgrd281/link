"use client";

import { Segmented } from "@linkyo/ui";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme-script";

type Choice = "light" | "dark";
const EVENT = "ly-theme-change";
const DARK = "(prefers-color-scheme: dark)";

/**
 * Light or dark. Until someone picks one, the page follows the device and the switch shows which
 * of the two that is (no third "system" button to explain).
 */
function read(): Choice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable: follow the device */
  }
  return window.matchMedia(DARK).matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK);
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

function apply(choice: Choice) {
  document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* storage unavailable: the choice still applies for this page view */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function ThemeSwitch({ size = "sm" }: { size?: "sm" | "md" }) {
  const t = useTranslations("common.theme");
  const choice = useSyncExternalStore(subscribe, read, () => "light" as const);
  return (
    <Segmented<Choice>
      size={size}
      label={t("label")}
      value={choice}
      onValueChange={apply}
      options={[
        { value: "light", label: t("light"), icon: Sun, iconOnly: true },
        { value: "dark", label: t("dark"), icon: Moon, iconOnly: true },
      ]}
    />
  );
}
