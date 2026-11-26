/**
 * Inside Linkyo's iPhone app (ADR 0087), React may render a whole document anew and drop the app's
 * `<html data-app>`: the root layout's own error page (`app/global-error.tsx`, its own <html>) and the
 * dashboard's island put it back (`useKeepAppSignal`), so the CSS and the code never disagree on app
 * mode. The global error page then offers only "try again" and the way back to the dashboard, never
 * the website (it shows the prices); a browser keeps the way to the home page.
 */
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import de from "@/messages/de.json";

import { GLOBAL_COPY } from "./global-copy";
import { GlobalErrorScreen } from "./global-error-screen";

const view = vi.hoisted(() => ({ app: false, pathname: "/de/app", kept: 0 }));

vi.mock("@/features/app-mode/use-app-mode", () => ({
  useAppMode: () => view.app,
  useKeepAppSignal: () => {
    view.kept += 1;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => view.pathname }));
// next/font only works inside Next's compiler.
vi.mock("@/fonts", () => ({ fontVariables: "" }));
// The dashboard island's own hooks (it renders nothing outside the app).
vi.mock("@/features/account/store", () => ({ useAccount: () => ({ status: "loading" }) }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => undefined }) }));

const { default: GlobalError } = await import("@/app/global-error");
const { AppModeIsland } = await import("@/features/app-mode/app-mode-island");

beforeEach(() => {
  view.app = false;
  view.pathname = "/de/app";
  view.kept = 0;
});

/** Every link of the markup: where it leads, its words and whether the app's CSS hides it. */
function links(markup: string) {
  return [...markup.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)].map(([, attributes = "", words = ""]) => ({
    href: /href="([^"]*)"/.exec(attributes)?.[1] ?? "",
    words: words.replace(/<[^>]+>/g, ""),
    hidden: /\bdata-app-hide=/.test(attributes),
  }));
}
/** What a person sees in the app: the links its CSS does not hide. */
const shownInApp = (markup: string) => links(markup).filter((link) => !link.hidden);

describe("the root layout's error page (app/global-error.tsx)", () => {
  it.each([
    ["de", "/de/app/editor"],
    ["ar", "/ar/hilfe"],
  ] as const)("in the app (%s): puts data-app back and leads only to the dashboard, with try again", (locale, pathname) => {
    view.app = true;
    view.pathname = pathname;
    const markup = renderToStaticMarkup(createElement(GlobalError, { error: new Error("x"), retry: () => undefined }));
    expect(view.kept).toBe(1);
    expect(links(markup)).toEqual([{ href: `/${locale}/app`, words: GLOBAL_COPY[locale].dashboard, hidden: false }]);
    expect(markup).toContain(GLOBAL_COPY[locale].retry);
    expect(markup).not.toContain(GLOBAL_COPY[locale].home);
  });

  it("in a browser: the way to the home page, marked so the app's CSS would hide it", () => {
    view.pathname = "/en/app";
    const markup = renderToStaticMarkup(createElement(GlobalError, { error: new Error("x"), retry: () => undefined }));
    expect(links(markup)).toEqual([{ href: "/en", words: GLOBAL_COPY.en.home, hidden: true }]);
    expect(shownInApp(markup)).toEqual([]);
  });
});

describe("its full screen (features/errors/global-error-screen.tsx)", () => {
  it("in the app: only the dashboard; in a browser: the home page, hidden by the app's CSS", () => {
    for (const locale of ["de", "en", "ar"] as const) {
      const app = renderToStaticMarkup(createElement(GlobalErrorScreen, { copy: GLOBAL_COPY[locale], locale, retry: () => undefined, app: true }));
      expect(links(app), locale).toEqual([{ href: `/${locale}/app`, words: GLOBAL_COPY[locale].dashboard, hidden: false }]);
      const browser = renderToStaticMarkup(createElement(GlobalErrorScreen, { copy: GLOBAL_COPY[locale], locale, retry: () => undefined, app: false }));
      expect(links(browser), locale).toEqual([{ href: `/${locale}`, words: GLOBAL_COPY[locale].home, hidden: true }]);
    }
  });
});

describe("the dashboard's island (AppModeIsland)", () => {
  it.each([
    [false, "a browser"],
    [true, "the app"],
  ])("puts data-app back once on its first render (%s: %s), so the code and the CSS agree", (app) => {
    view.app = app;
    renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "de", messages: de, timeZone: "Europe/Berlin", children: createElement(AppModeIsland) }));
    expect(view.kept).toBe(1);
  });
});
