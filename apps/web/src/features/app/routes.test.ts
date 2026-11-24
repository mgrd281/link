import { describe, expect, it } from "vitest";

import {
  DESIGN_TABS,
  designTabFrom,
  hasSectionPanel,
  INVITE_HREF,
  isReturnPath,
  isSettingsPath,
  markedTab,
  NAV_ANCHORS,
  routeInfo,
  SECTION_HREF,
  SETTINGS_HREF,
  TAB_HREF,
  TABS,
  WORK_HREF,
} from "./routes";

describe("dashboard routes", () => {
  it("keeps every existing place as it was, now with its section", () => {
    expect(routeInfo("/app")).toEqual({ title: "nav.home", tab: "home", parent: null, section: "home" });
    expect(routeInfo("/app/editor")).toEqual({ title: "nav.page", tab: "page", parent: null, section: "page" });
    expect(routeInfo("/app/design")).toEqual({ title: "nav.design", tab: "design", parent: null, section: "design" });
    expect(routeInfo("/app/analytics")).toEqual({ title: "nav.analytics", tab: "analytics", parent: null, section: "analytics" });
    expect(routeInfo("/app/settings")).toEqual({ title: "nav.settings", tab: null, parent: "origin", section: "settings" });
    expect(routeInfo("/app/settings/account")).toEqual({ title: "settings.panes.account", tab: null, parent: SETTINGS_HREF, section: "settings" });
    expect(routeInfo("/app/settings/address")).toEqual({ title: "settings.panes.address", tab: null, parent: SETTINGS_HREF, section: "settings" });
    expect(routeInfo("/app/settings/legal")).toEqual({ title: "settings.panes.legal", tab: null, parent: SETTINGS_HREF, section: "settings" });
  });

  it("shows Arbeiten as a view of the Page tab: Page stays marked, nothing to go back to", () => {
    expect(WORK_HREF).toBe("/app/work");
    expect(routeInfo("/app/work")).toEqual({ title: "nav.work", tab: "page", parent: null, section: "page" });
    expect(routeInfo("/app/work/")).toEqual(routeInfo("/app/work"));
    expect(markedTab("/app/work")).toBe("page");
    expect(isReturnPath("/app/work")).toBe(true);
    // The tab's own address stays the content list.
    expect(TAB_HREF.page).toBe("/app/editor");
  });

  it("pushes Invite over Settings in its own section", () => {
    expect(INVITE_HREF).toBe("/app/invite");
    expect(routeInfo("/app/invite")).toEqual({ title: "invite.title", tab: null, parent: "/app/settings", section: "invite" });
    expect(routeInfo("/app/invite/")).toEqual(routeInfo("/app/invite"));
  });

  it("counts every Settings path, known or not, as the settings section", () => {
    for (const path of ["/app/settings", "/app/settings/", "/app/settings/account", "/app/settings/address", "/app/settings/legal", "/app/settings/unknown"]) {
      expect(isSettingsPath(path.replace(/\/$/, ""))).toBe(true);
      expect(routeInfo(path).section).toBe("settings");
      expect(routeInfo(path).tab).toBeNull();
    }
    expect(routeInfo("/app/settings/unknown")).toEqual({ title: "nav.settings", tab: null, parent: SETTINGS_HREF, section: "settings" });
  });

  it("treats an unknown path as Home", () => {
    expect(routeInfo("/app/nowhere")).toEqual({ title: "nav.home", tab: "home", parent: null, section: "home" });
    expect(routeInfo("/app/")).toEqual(routeInfo("/app"));
  });

  it("links every section to its place", () => {
    expect(SECTION_HREF).toEqual({ ...TAB_HREF, invite: "/app/invite", settings: "/app/settings" });
    for (const tab of TABS) {
      expect(routeInfo(SECTION_HREF[tab])).toMatchObject({ tab, section: tab, parent: null });
    }
    expect(routeInfo(SECTION_HREF.invite).section).toBe("invite");
    expect(routeInfo(SECTION_HREF.settings).section).toBe("settings");
  });

  it("still lets Fertig return to Invite but never to the own page", () => {
    expect(isReturnPath("/app/invite")).toBe(true);
    expect(isReturnPath("/app/preview")).toBe(false);
  });
});

describe("the tab bar's marked tab", () => {
  it("marks the screen's own tab", () => {
    for (const tab of TABS) expect(markedTab(TAB_HREF[tab])).toBe(tab);
    expect(markedTab("/app/")).toBe("home");
  });

  it("marks no tab on a pushed screen, wherever it was opened from", () => {
    for (const path of [SETTINGS_HREF, "/app/settings/account", "/app/settings/address", "/app/settings/legal", "/app/settings/unknown", INVITE_HREF]) {
      expect(markedTab(path)).toBeNull();
      expect(markedTab(`${path}/`)).toBeNull();
    }
  });

  it("marks a tab just tapped at once, before its screen has loaded", () => {
    expect(markedTab(SETTINGS_HREF, "analytics")).toBe("analytics");
    expect(markedTab("/app", "page")).toBe("page");
    expect(markedTab(INVITE_HREF, null)).toBeNull();
  });
});

describe("the section panel", () => {
  it("lists parts only for places with four or more of them, or with panes", () => {
    for (const counted of [true, false]) {
      expect(hasSectionPanel("home", counted)).toBe(false);
      expect(hasSectionPanel("page", counted)).toBe(false);
      expect(hasSectionPanel("design", counted)).toBe(false);
      expect(hasSectionPanel("invite", counted)).toBe(true);
      expect(hasSectionPanel("settings", counted)).toBe(true);
    }
    // Stats has five parts with numbers; real accounts see one empty state (nothing to point at).
    expect(hasSectionPanel("analytics", true)).toBe(true);
    expect(hasSectionPanel("analytics", false)).toBe(false);
  });

  it("follows the route: Arbeiten and every Settings pane belong to their place", () => {
    expect(hasSectionPanel(routeInfo(WORK_HREF).section, true)).toBe(false);
    expect(hasSectionPanel(routeInfo("/app/settings/legal").section, false)).toBe(true);
  });
});

describe("design tabs in the URL", () => {
  it("reads ?tab= and falls back to Color", () => {
    expect(DESIGN_TABS).toEqual(["color", "fonts", "buttons"]);
    for (const tab of DESIGN_TABS) expect(designTabFrom(tab)).toBe(tab);
    expect(designTabFrom(null)).toBe("color");
    expect(designTabFrom("")).toBe("color");
    expect(designTabFrom("junk")).toBe("color");
    expect(designTabFrom("FONTS")).toBe("color");
  });
});

describe("panel anchors", () => {
  it("are unique, valid ids", () => {
    const ids = Object.values(NAV_ANCHORS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z-]*[a-z]$/);
  });

  it("include the four Invite sections", () => {
    expect([NAV_ANCHORS.inviteLink, NAV_ANCHORS.inviteRewards, NAV_ANCHORS.invitePeople, NAV_ANCHORS.inviteRules]).toEqual([
      "invite-link",
      "invite-rewards",
      "invite-people",
      "invite-rules",
    ]);
  });
});
