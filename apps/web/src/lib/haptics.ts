import { appHaptic } from "@/features/app-mode/bridge";

/**
 * A light tap of haptic feedback, where the device offers one to the web:
 * - Linkyo's iPhone app (app mode): the app plays it (`haptic` through the bridge);
 * - Android (Chrome, Samsung Internet): the Vibration API, one very short pulse;
 * - iPhone (iOS 18 and later): Safari plays the system's "selection" tick when a native switch
 *   control toggles, so a hidden switch is toggled through its label;
 * - everywhere else: nothing.
 * Call it only from a user's tap (browsers ignore it otherwise). The phone's own settings decide
 * whether it is felt at all (System Haptics, vibration off), so there is no separate switch.
 */
let iosSwitch: HTMLLabelElement | null = null;

const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

export function haptic(): void {
  if (typeof window === "undefined") return;
  if (appHaptic()) return;
  if (typeof navigator.vibrate === "function" && !isIos()) {
    navigator.vibrate(8);
    return;
  }
  if (!isIos()) return;
  if (!iosSwitch) {
    const box = document.createElement("div");
    box.className = "sr-only";
    box.setAttribute("aria-hidden", "true");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.id = "linkyo-haptic";
    input.tabIndex = -1;
    const label = document.createElement("label");
    label.htmlFor = input.id;
    box.append(input, label);
    document.body.append(box);
    iosSwitch = label;
  }
  iosSwitch.click();
}
