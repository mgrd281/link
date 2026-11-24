import { can, PERMISSIONS, ROLES, type Permission, type Role } from "../types";

/**
 * May the console load `admin_customers()` for the signed-in member? (S1-R-01, ADR 0073.)
 *
 * Until `20261124100100_admin_money.sql` is applied, the database still grants editors
 * `customers.view`, so `admin_customers()` would send them every customer's name, e-mail address,
 * city and team notes, although the console hides customers from editors. On such a database the
 * console does not call it at all for a role that may not see customers (the code's role map), and
 * the screens say that customer figures are not available for this role: never a 0 that looks like a
 * count. A database with the migration answers those roles with rows without people (the numbers of
 * Overview and Analytics), so the call is safe there.
 */
export interface CustomerAccess {
  /** The database is older than the migration: nobody holds `orders.view` there. */
  legacy: boolean;
  /** `admin_customers()` is not called for this member. */
  withheld: boolean;
}

/** What `admin_me()` answers for a member: their role and the database's permissions for it. */
function member(me: unknown): { role: Role; permissions: readonly Permission[] } | null {
  if (typeof me !== "object" || me === null || !("role" in me) || !("permissions" in me)) return null;
  const role = ROLES.find((known) => known === me.role);
  if (!role || !Array.isArray(me.permissions)) return null;
  const permissions = PERMISSIONS.filter((permission) => (me.permissions as unknown[]).includes(permission));
  return { role, permissions };
}

/**
 * The decision for the signed-in member, from `admin_me()`. Not withheld for roles that may see
 * customers. Withheld for the others on the old database, and also wherever the database still
 * grants such a role `customers.view` (it would hand over people). Without a readable answer (not on
 * the team, an error) nothing is loaded.
 */
export function customerAccess(me: unknown): CustomerAccess {
  const found = member(me);
  if (!found) return { legacy: false, withheld: true };
  const legacy = !found.permissions.includes("orders.view");
  const exposes = found.permissions.includes("customers.view");
  return { legacy, withheld: !can(found.role, "customers.view") && (legacy || exposes) };
}

/**
 * Whether the screens for `role` say customer figures are not available: the member's own decision,
 * and for an owner viewing the console as another role, what that role would see on this database.
 */
export const figuresWithheld = (access: CustomerAccess, role: Role): boolean => access.withheld || (access.legacy && !can(role, "customers.view"));
