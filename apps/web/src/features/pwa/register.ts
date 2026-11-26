import { serviceWorkerScope, serviceWorkerUrl } from "./paths";

/** At most this often a window that comes back to the front asks whether a new worker was deployed. */
export const UPDATE_EVERY = 60 * 60 * 1000;

/** What registering needs from the browser (passed in, so a test can stand in for it). */
export interface RegisterEnv {
  /** `navigator.serviceWorker`, or undefined where the browser has none. */
  serviceWorker: { register: (url: string, options: RegistrationOptions) => Promise<{ update: () => Promise<unknown> }> } | undefined;
  window: { addEventListener: (type: "load", listener: () => void, options?: AddEventListenerOptions) => void; removeEventListener: (type: "load", listener: () => void) => void };
  document: {
    readyState: DocumentReadyState;
    visibilityState: DocumentVisibilityState;
    addEventListener: (type: "visibilitychange", listener: () => void) => void;
    removeEventListener: (type: "visibilitychange", listener: () => void) => void;
  };
  now: () => number;
}

/**
 * Registers this language's dashboard worker (features/pwa/service-worker.ts) once the page has
 * loaded, for the scope `/<locale>/app`, with `updateViaCache: "none"`: the script is always fetched
 * fresh when the browser checks it. A window that comes back to the front checks for a new one (at
 * most hourly), so a deploy's worker reaches dashboards that stay open for days. Returns the cleanup.
 */
export function startDashboardWorker(locale: string, env: RegisterEnv): () => void {
  const { serviceWorker, window, document, now } = env;
  if (!serviceWorker) return () => undefined;
  let registration: { update: () => Promise<unknown> } | null = null;
  let checked = now();
  const register = () => {
    serviceWorker
      .register(serviceWorkerUrl(locale), { scope: serviceWorkerScope(locale), updateViaCache: "none" })
      .then((done) => {
        registration = done;
      })
      // No worker (a browser that refuses it, private modes): the dashboard works the same online.
      .catch(() => undefined);
  };
  const onVisible = () => {
    if (document.visibilityState !== "visible" || !registration || now() - checked < UPDATE_EVERY) return;
    checked = now();
    registration.update().catch(() => undefined);
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("load", register);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
