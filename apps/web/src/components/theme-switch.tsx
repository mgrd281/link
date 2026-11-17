"use client";

import { Segmented } from "@linkyo/ui";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme-script";

type Choice = "light" | "dark" | "system";
const EVENT = "ly-theme-change";

function read(): Choice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function apply(choice: Choice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* storage unavailable: the choice still applies for this page view */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function ThemeSwitch({ size = "sm" }: { size?: "sm" | "md" }) {
  const t = useTranslations("common.theme");
  const choice = useSyncExternalStore(subscribe, read, () => "system" as const);
  return (
    <Segmented<Choice>
      size={size}
      label={t("label")}
      value={choice}
      onValueChange={apply}
      options={[
        { value: "light", label: t("light"), icon: Sun, iconOnly: true },
        { value: "dark", label: t("dark"), icon: Moon, iconOnly: true },
        { value: "system", label: t("system"), icon: Monitor, iconOnly: true },
      ]}
    />
  );
}
