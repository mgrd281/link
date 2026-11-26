/**
 * The installed app opens with `launch_handler: { client_mode: "focus-existing" }` (features/pwa/manifest.ts):
 * when its window is already open, Chrome and Edge bring that window to the front and hand the address
 * that was asked for (a shortcut such as "Statistik", or the share target with a shared link) to
 * `window.launchQueue`; they do not load it themselves. This runs first, on every page of the site
 * that links the manifest (beside the install script), and loads that address in the window:
 *
 * - only an address of this site (the same origin), and only one that differs from the page shown;
 * - a plain start from the icon (the start address, `/<locale>/app?source=app`) only brings the window
 *   to the front: the screen the owner was on stays;
 * - the launch that opened this very window is not loaded again: its parameters arrive while the page
 *   is still loading, and the page already is that address (or where it led, such as the share route's
 *   redirect to Home).
 *
 * A full page load: the share route's redirect and Home's intents (`?add=1`, `?shared=`) run as on any start.
 */
export const launchQueueInitScript = `(function(){var w=window,q=w.launchQueue;if(!q||typeof q.setConsumer!=="function")return;q.setConsumer(function(p){var l=w.location,u;try{u=new URL(p.targetURL)}catch(e){return}if(w.document.readyState!=="complete"||u.origin!==l.origin||u.href===l.href||(/^\\/[a-z]{2}\\/app\\/?$/.test(u.pathname)&&u.searchParams.get("source")==="app"))return;l.assign(u.pathname+u.search+u.hash)})})();`;
