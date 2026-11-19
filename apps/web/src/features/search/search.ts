/**
 * People search: the pure part. It runs in the browser over a small index (people-index.ts), so
 * nothing a visitor types leaves their device.
 */

/** One findable page: a person or a business. Built on the server, one list per language. */
export interface Person {
  slug: string;
  name: string;
  /** Other spellings to find them by: the name in the other languages. */
  aliases: string[];
  /** The line under the name: what they do. */
  role: string;
  /** Gallery category (the chips); "people" are well-known people. */
  category: string;
  /** Words that describe the page (its kind, category and place), in the visitor's language. */
  keywords: string[];
  /** The language of the page the result opens. */
  locale: "de" | "en" | "ar";
  href: string;
  /** A picture served by Linkyo itself, or none (then the initials show). */
  photo: string | null;
  /** What kind of page this is; every result says so. */
  badge: "example" | "concept" | "preview";
}

const ARABIC: Record<string, string> = { أ: "ا", إ: "ا", آ: "ا", ٱ: "ا", ى: "ي", ئ: "ي", ؤ: "و", ة: "ه" };

/** One character, folded: lower case, no accents, no Arabic vowel marks, one spelling per Arabic letter. */
function foldChar(char: string): string {
  const base = char.normalize("NFD").replace(/[\p{M}ـ]/gu, "").toLocaleLowerCase();
  if (base === "ß") return "ss";
  return ARABIC[base] ?? base;
}

/** "Bäckerei" → "backerei", "نَادِين" → "نادين": what people type finds what is written. */
export const fold = (text: string): string => Array.from(text.normalize("NFC"), foldChar).join("");

/** The folded text, and for each of its characters where it came from in the original. */
function foldWithMap(text: string): { folded: string; starts: number[]; ends: number[] } {
  let folded = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let index = 0;
  for (const char of text) {
    const part = foldChar(char);
    // One written character can fold into two ("ß" → "ss"): both point back at it.
    starts.push(...Array.from(part, () => index));
    ends.push(...Array.from(part, () => index + char.length));
    folded += part;
    index += char.length;
  }
  return { folded, starts, ends };
}

/** The words someone typed, folded. "@name" finds the address "name". */
export const termsOf = (query: string): string[] =>
  fold(query)
    .split(/[\s,·]+/)
    .map((term) => term.replace(/^@/, ""))
    .filter(Boolean);

/**
 * Edit distance with swaps of neighbours ("ronlado"), stopped early once it passes `max`: the
 * difference between what was typed and a word, for typing mistakes.
 */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const same = a[i - 1] === b[j - 1];
      let value = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + (same ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, (before[j - 2] ?? 0) + 1);
      next.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    before = row;
    row = next;
  }
  return row[b.length] ?? max + 1;
}

/** How many typing mistakes a word of this length may hold. Short words must be right. */
const mistakes = (length: number) => (length >= 8 ? 2 : length >= 4 ? 1 : 0);

const words = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Typed nearly right: the word, or the start of it while someone is still typing ("tailo" for
 * "Taylor"), within the mistakes its length allows.
 */
function near(term: string, word: string): boolean {
  const allowed = mistakes(term.length);
  if (allowed === 0) return false;
  for (let length = term.length - allowed; length <= term.length + allowed; length++) {
    if (length > 0 && distance(term, word.slice(0, length), allowed) <= allowed) return true;
  }
  return false;
}

/** How well one typed word fits a name: its start, the start of one of its words, or inside it. */
function nameScore(name: string, term: string, forgiving: boolean): number {
  if (name === term) return 120;
  if (name.startsWith(term)) return 100;
  const parts = words(name);
  if (parts.some((part) => part.startsWith(term))) return 85;
  if (name.includes(term)) return 60;
  return forgiving && parts.some((part) => near(term, part)) ? 45 : 0;
}

/**
 * How well one typed word fits what the page is about (role, kind, category, place): the start of a
 * word, or, for four letters and more, inside one ("sänger" in "Popsängerin"; not "mes" in "Semester").
 */
function topicScore(topic: string, term: string): number {
  if (words(topic).some((part) => part.startsWith(term))) return 40;
  return term.length >= 4 && topic.includes(term) ? 30 : 0;
}

export interface Prepared {
  person: Person;
  names: string[];
  slug: string;
  topic: string;
}

/** Folds every entry once, so each keystroke only compares strings. */
export function prepare(people: Person[]): Prepared[] {
  return people.map((person) => ({
    person,
    names: [person.name, ...person.aliases].map(fold),
    slug: person.slug,
    topic: fold([person.role, ...person.keywords].join(" ")),
  }));
}

/**
 * The people who fit what was typed, best first. Every typed word must fit somewhere: the name
 * (or one of its other spellings), the address, or what the page is about. Only when nothing fits
 * as typed are names with a typing mistake accepted ("ronldo"), so a near miss never crowds out a
 * real hit. With nothing typed, everyone in the given order (the server puts suggestions first).
 * `category` narrows to one chip.
 */
export function searchPeople(index: Prepared[], query: string, category: string | null = null): Person[] {
  const terms = termsOf(query);
  const pool = category ? index.filter((entry) => entry.person.category === category) : index;
  if (terms.length === 0) return pool.map((entry) => entry.person);
  const rank = (forgiving: boolean) =>
    pool
      .map((entry, order) => {
        let total = 0;
        for (const term of terms) {
          const byName = Math.max(...entry.names.map((name) => nameScore(name, term, forgiving)));
          const bySlug = entry.slug.startsWith(term) ? 70 : entry.slug.includes(term) ? 50 : 0;
          const best = Math.max(byName, bySlug, topicScore(entry.topic, term));
          if (best === 0) return null;
          total += best;
        }
        return { person: entry.person, total, order };
      })
      .filter((hit) => hit !== null)
      .sort((a, b) => b.total - a.total || a.order - b.order)
      .map((hit) => hit.person);
  const exact = rank(false);
  return exact.length > 0 ? exact : rank(true);
}

/**
 * Where the typed words show in a name, as [start, end) ranges of the name as written, so the
 * result can mark them. Only what really is in the name (not other spellings, not near misses).
 */
export function highlights(name: string, query: string): [number, number][] {
  const { folded, starts, ends } = foldWithMap(name.normalize("NFC"));
  const ranges: [number, number][] = [];
  for (const term of termsOf(query)) {
    let from = folded.indexOf(term);
    // Prefer the start of a word over the middle of one.
    for (let at = from; at !== -1; at = folded.indexOf(term, at + 1)) {
      if (at === 0 || !/[\p{L}\p{N}]/u.test(folded[at - 1] ?? "")) {
        from = at;
        break;
      }
    }
    if (from === -1) continue;
    const start = starts[from];
    const end = ends[from + term.length - 1];
    if (start !== undefined && end !== undefined) ranges.push([start, end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  // Merge what overlaps, so the name is cut into clean pieces.
  return ranges.reduce<[number, number][]>((merged, range) => {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
    return merged;
  }, []);
}
