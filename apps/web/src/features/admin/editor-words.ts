/**
 * The page editor (`app.editor`) is the owner's own screen: with nothing on the page yet it speaks
 * to them ("Deine Seite wartet", "… erscheint sofort auf deiner Seite", "Add your first link"). In
 * the team area the editor always shows a page that belongs to someone else: a page the team
 * prepares for a creator, a proposal for a customer. There the empty state reads about this page
 * (`admin.editor.*`: "Diese Seite hat noch keinen Link"), whoever looks at it.
 *
 * The team area's shell hands these words down to every screen inside it (`AdminShell`), so an
 * editor mounted there never needs to remember it; a screen may still say more (the proposal editor
 * names the briefing, `orders/team-words.ts`). Pure, so the tests read the same rule; the messages
 * passed in are not changed.
 */

/** The editor's words that speak to the page's owner, and the team area's words for them. */
export const OTHERS_PAGE_WORDS = ["emptyTitle", "emptyBody", "addFirst"] as const;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** The messages with the editor's empty state in the team area's words; everything else as it is. */
export function othersPageMessages<M extends object>(messages: M): M {
  const app = record(record(messages).app);
  const editor = record(app.editor);
  const team = record(record(record(messages).admin).editor);
  const words = Object.fromEntries(OTHERS_PAGE_WORDS.map((key) => [key, team[key] ?? editor[key]]));
  return { ...messages, app: { ...app, editor: { ...editor, ...words } } };
}
