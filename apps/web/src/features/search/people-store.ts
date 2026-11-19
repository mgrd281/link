import type { Person } from "./search";

const lists = new Map<string, Promise<Person[]>>();

/**
 * The people who can be found, for one language: fetched once per visit from our own static route
 * (/api/people/<locale>), then kept. A failed fetch is forgotten, so "Try again" really tries again.
 */
export function loadPeople(locale: string): Promise<Person[]> {
  const known = lists.get(locale);
  if (known) return known;
  const pending = fetch(`/api/people/${locale}`).then(async (response) => {
    if (!response.ok) throw new Error(`people index: ${response.status}`);
    return ((await response.json()) as { people: Person[] }).people;
  });
  pending.catch(() => lists.delete(locale));
  lists.set(locale, pending);
  return pending;
}
