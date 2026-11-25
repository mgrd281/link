"use client";

import { cn, Segmented } from "@linkyo/ui";
import { Moon, Sun, SunMoon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme-script";
import { touchSegmented } from "@/lib/touch";

type Theme = "light" | "dark";
type Choice = Theme | "system";
const EVENT = "ly-theme-change";
const DARK = "(prefers-color-scheme: dark)";

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* storage unavailable: follow the device */
  }
  return null;
}

/** The look in use: the stored choice, or the device's while nothing is stored. */
function readTheme(): Theme {
  return stored() ?? (window.matchMedia(DARK).matches ? "dark" : "light");
}

/** The choice itself: "system" while nothing is stored. */
function readChoice(): Choice {
  return stored() ?? "system";
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
  // "system": forget the choice, so the page follows the device again (the init script then sets nothing).
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* storage unavailable: the choice still applies for this page view */
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Light or dark. On the website, until someone picks one, the page follows the device and the switch
 * shows which of the two that is (no third button to explain). With `withSystem` (the dashboard's
 * Settings) a third, labelled choice, "Automatic", hands the look back to the device.
 */
export function ThemeSwitch({
  size = "sm",
  withSystem = false,
  label,
  className,
}: {
  size?: "sm" | "md";
  withSystem?: boolean;
  /** The group's name when a visible label beside it says it differently (Settings: "Appearance"). */
  label?: string;
  className?: string;
}) {
  const t = useTranslations("common.theme");
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const);
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as const);
  if (!withSystem) {
    return (
      <Segmented<Theme>
        size={size}
        label={label ?? t("label")}
        value={theme}
        onValueChange={apply}
        // Sun and moon are 44 px targets on a touch screen (they were 34 × 36).
        className={cn(touchSegmented, className)}
        options={[
          { value: "light", label: t("light"), icon: Sun, iconOnly: true },
          { value: "dark", label: t("dark"), icon: Moon, iconOnly: true },
        ]}
      />
    );
  }
  return (
    <Segmented<Choice>
      size={size}
      label={label ?? t("label")}
      value={choice}
      onValueChange={apply}
      className={className}
      options={[
        { value: "light", label: t("light"), icon: Sun },
        { value: "dark", label: t("dark"), icon: Moon },
        { value: "system", label: t("system"), icon: SunMoon },
      ]}
    />
  );
}
