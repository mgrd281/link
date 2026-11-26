import { APP_PLATFORMS } from "@/features/app-mode/app-mode";

/** Runs before paint: applies the stored theme choice so there is no flash (light | dark | system). */
export const THEME_STORAGE_KEY = "ly-theme";

/**
 * Not inside Linkyo's iPhone app (`<html data-app>`, which the app sets before any of the page's
 * scripts run; ADR 0087): the app sets its appearance natively, so the web view follows the
 * device's (`prefers-color-scheme`) whatever a page once stored. The same platforms as `inAppMode()`.
 */
export const themeInitScript = `(function(){try{if(${JSON.stringify(APP_PLATFORMS)}.indexOf(document.documentElement.dataset.app)>=0)return;var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
