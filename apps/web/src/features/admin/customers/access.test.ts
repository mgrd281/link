import { describe, expect, it } from "vitest";

import { ROLE_PERMISSIONS, type Permission, type Role } from "../types";

import { customerAccess, figuresWithheld } from "./access";

/**
 * S1-R-01: on the hosted database as it is today (before 20261124100100_admin_money.sql), editors
 * still hold `customers.view`, and nobody holds `orders.view` (supabase/migrations/…_team.sql).
 * There the console must not call admin_customers() for an editor: it would send every customer's
 * name, e-mail address, city and notes to the browser.
 */

/** `role_permissions` before the migration (20261119100200_team.sql). */
const OLD: Record<Role, readonly Permission[]> = {
  owner: ROLE_PERMISSIONS.owner.filter((permission) => permission !== "orders.view" && permission !== "customers.export"),
  admin: ROLE_PERMISSIONS.admin.filter((permission) => permission !== "orders.view" && permission !== "customers.export"),
  editor: ["pages.create", "pages.edit", "activity.view", "customers.view", "analytics.view"],
  viewer: ["activity.view", "customers.view", "billing.view", "security.view", "analytics.view"],
};

/** `role_permissions` after it: the code's map (customers.test.ts checks they match the migrations). */
const NEW = ROLE_PERMISSIONS;

/** What admin_me() answers for a member (the permissions sorted, as SQL orders them). */
const me = (role: Role, permissions: readonly Permission[]) => ({ role, email: `${role}@example.com`, permissions: [...permissions].sort() });

describe("customer figures on the hosted database", () => {
  it("are withheld from editors while the database is the old one", () => {
    expect(customerAccess(me("editor", OLD.editor))).toEqual({ legacy: true, withheld: true });
  });

  it("are loaded for every role that may see customers, old database or new", () => {
    for (const role of ["owner", "admin", "viewer"] as const) {
      expect(customerAccess(me(role, OLD[role])), role).toEqual({ legacy: true, withheld: false });
      expect(customerAccess(me(role, NEW[role])), role).toEqual({ legacy: false, withheld: false });
    }
  });

  it("are loaded for editors once the migration is applied (rows without people)", () => {
    expect(customerAccess(me("editor", NEW.editor))).toEqual({ legacy: false, withheld: false });
  });

  it("stay withheld wherever the database still grants an editor customers.view", () => {
    // orders.view already there, but customers.view not taken away yet: it would still hand over people.
    expect(customerAccess(me("editor", [...NEW.editor, "customers.view"])).withheld).toBe(true);
  });

  it("are not loaded without a readable member (not on the team, an error, an unknown role)", () => {
    for (const answer of [null, undefined, "editor", {}, { role: "editor" }, { role: "guest", permissions: [] }, { role: "owner", permissions: "all" }]) {
      expect(customerAccess(answer).withheld, JSON.stringify(answer)).toBe(true);
    }
  });

  it("show an owner viewing as an editor what the editor sees on this database", () => {
    const oldOwner = customerAccess(me("owner", OLD.owner));
    expect(figuresWithheld(oldOwner, "owner")).toBe(false);
    expect(figuresWithheld(oldOwner, "editor")).toBe(true);
    expect(figuresWithheld(oldOwner, "viewer")).toBe(false);
    const newOwner = customerAccess(me("owner", NEW.owner));
    expect(figuresWithheld(newOwner, "editor")).toBe(false);
    // A member whose own figures are withheld sees no figures in any view.
    expect(figuresWithheld(customerAccess(me("editor", OLD.editor)), "editor")).toBe(true);
  });
});
