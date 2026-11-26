/** The address of a language's dashboard service worker (features/pwa/service-worker.ts). */
export const serviceWorkerUrl = (locale: string) => `/${locale}/app/sw.js`;

/** The scope it is registered for: this language's dashboard and nothing else. */
export const serviceWorkerScope = (locale: string) => `/${locale}/app`;
