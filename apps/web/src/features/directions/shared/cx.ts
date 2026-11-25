/**
 * Joins class names for the client islands of creator pages: the truthy parts, in order, one space
 * apart. Unlike `cn` (tailwind-merge with the token theme) it resolves no conflicts, so it brings
 * neither tailwind-merge nor the token object into the visitor's browser (ADR 0008's page-code
 * budget). Use it only for lists without conflicting utilities; class names that merge a caller's
 * `className` are merged with `cn` where the island is rendered (on the server) and passed in whole.
 * islands.test.ts holds every island's lists to `cn`'s result.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
