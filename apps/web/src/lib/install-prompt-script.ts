/**
 * Chrome, Edge and Samsung Internet offer to install Linkyo once per page load, with one
 * `beforeinstallprompt` event, often before the page's scripts have started and usually on the page
 * where the visit began (the website or sign-in), not in the dashboard where the offer is shown. This
 * runs first, on every page of the site: it keeps the event for the dashboard's install sheet and its
 * Home hint (`features/app/install/install-store.ts`) and holds back the browser's own banner, so
 * nobody is asked to install the dashboard before they have one. The address bar's install button
 * stays. `appinstalled` marks the app as installed for this page load.
 */
export const INSTALL_PROMPT_KEY = "__linkyoInstallPrompt";
export const INSTALLED_KEY = "__linkyoInstalled";
/** Fired on `window` whenever either of the two changes. */
export const INSTALL_CHANGE_EVENT = "linkyo:install";

export const installPromptInitScript = `(function(){var w=window;function c(){w.dispatchEvent(new Event("${INSTALL_CHANGE_EVENT}"))}w.addEventListener("beforeinstallprompt",function(e){e.preventDefault();w.${INSTALL_PROMPT_KEY}=e;c()});w.addEventListener("appinstalled",function(){w.${INSTALL_PROMPT_KEY}=null;w.${INSTALLED_KEY}=true;c()})})();`;
