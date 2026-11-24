import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { areaOf, isOrderPath } from "./area";
import { GLOBAL_COPY, localeOfPath } from "./global-copy";
import { gatedRouteMissing, isOrderId, orderMissing } from "./gated-routes";

const ID = "3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f";

describe("addresses behind the dashboard and team gates that can never exist", () => {
  it("knows an order id when it sees one", () => {
    expect(isOrderId(ID)).toBe(true);
    expect(isOrderId("x1")).toBe(false);
    expect(isOrderId(`${ID}0`)).toBe(false);
  });

  it("without payments, every order and proposal address is missing", () => {
    expect(orderMissing(ID, false)).toBe(true);
    expect(gatedRouteMissing("app", ["orders", ID], false)).toBe(true);
    expect(gatedRouteMissing("app", ["proposals", ID], false)).toBe(true);
    expect(gatedRouteMissing("admin", ["(shell)", "orders"], false)).toBe(true);
    expect(gatedRouteMissing("admin", ["(shell)", "orders", ID], false)).toBe(true);
    expect(gatedRouteMissing("admin", ["(shell)", "orders", ID, "proposal"], false)).toBe(true);
  });

  it("with payments, only an id that is no order id is missing", () => {
    expect(gatedRouteMissing("app", ["orders", ID], true)).toBe(false);
    expect(gatedRouteMissing("app", ["orders", "x1"], true)).toBe(true);
    expect(gatedRouteMissing("app", ["proposals", "x1"], true)).toBe(true);
    expect(gatedRouteMissing("admin", ["(shell)", "orders"], true)).toBe(false);
    expect(gatedRouteMissing("admin", ["(shell)", "orders", ID, "proposal"], true)).toBe(false);
    expect(gatedRouteMissing("admin", ["(shell)", "orders", "x1"], true)).toBe(true);
  });

  it("leaves every other screen to its page, and skips groups and Next's own markers", () => {
    for (const payments of [true, false]) {
      expect(gatedRouteMissing("app", [], payments)).toBe(false);
      expect(gatedRouteMissing("app", ["(shell)"], payments)).toBe(false);
      expect(gatedRouteMissing("app", ["(shell)", "editor"], payments)).toBe(false);
      expect(gatedRouteMissing("app", ["(shell)", "settings", "account"], payments)).toBe(false);
      expect(gatedRouteMissing("app", ["welcome"], payments)).toBe(false);
      expect(gatedRouteMissing("admin", ["(shell)"], payments)).toBe(false);
      expect(gatedRouteMissing("admin", ["(shell)", "creators", "mila"], payments)).toBe(false);
      expect(gatedRouteMissing("admin", ["preview", "mila"], payments)).toBe(false);
    }
    expect(gatedRouteMissing("app", ["orders", "x1", "__PAGE__"], true)).toBe(true);
    expect(gatedRouteMissing("app", ["orders", ID, "__PAGE__"], true)).toBe(false);
  });
});

describe("the part of Linkyo an address belongs to", () => {
  it("tells the dashboard, the team area and the website apart", () => {
    expect(areaOf("/app")).toBe("app");
    expect(areaOf("/app/xyz")).toBe("app");
    expect(areaOf("/admin")).toBe("admin");
    expect(areaOf("/admin/orders/x1")).toBe("admin");
    expect(areaOf("/")).toBe("site");
    expect(areaOf("/apple")).toBe("site");
    expect(areaOf("/administrator")).toBe("site");
    expect(areaOf("/p/does-not-exist")).toBe("site");
  });

  it("knows the order and proposal addresses", () => {
    expect(isOrderPath("/app/orders/x1")).toBe(true);
    expect(isOrderPath("/app/proposals")).toBe(true);
    expect(isOrderPath("/app/ordersx")).toBe(false);
    expect(isOrderPath("/admin/orders")).toBe(false);
  });
});

describe("the global error page's own words", () => {
  const MESSAGES = { de, en, ar };

  it("are the message files' words, in every language", () => {
    for (const locale of ["de", "en", "ar"] as const) {
      const { errors } = MESSAGES[locale];
      expect(GLOBAL_COPY[locale]).toEqual({ title: errors.error.title, body: errors.error.body, retry: errors.actions.retry, home: errors.actions.home });
    }
  });

  it("follow the address's language, German otherwise", () => {
    expect(localeOfPath("/ar/app")).toBe("ar");
    expect(localeOfPath("/en")).toBe("en");
    expect(localeOfPath("/de/nope")).toBe("de");
    expect(localeOfPath("/u/mila")).toBe("de");
    expect(localeOfPath("/")).toBe("de");
    expect(localeOfPath(null)).toBe("de");
  });
});
