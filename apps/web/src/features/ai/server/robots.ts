import type { SafeFetchResult } from "./safe-fetch";

/**
 * robots.txt (RFC 9309) for the importer and the website reader. We ask as `LinkyoImport`: the
 * groups naming that token apply, else the `*` groups; within them the longest matching rule wins
 * (an allow wins a tie). A missing file (4xx) allows everything; a file we could not get (5xx, a
 * network error) disallows for that run. Answers are kept for 24 hours per site.
 *
 * Everything here is written for a hostile file: matching is linear (no regular expression), a file
 * with too many rules is not weighed, and the store of answers has a fixed size.
 */

export const ROBOTS_AGENT = "LinkyoImport";
export const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;
export const ROBOTS_MAX_BYTES = 512 * 1024;

export interface RobotsRule {
  allow: boolean;
  pattern: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

/** The groups of a robots.txt: user-agent lines followed by their allow and disallow rules. */
export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let collectingAgents = false;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.split(/[/\s]/)[0]?.toLowerCase() ?? "");
      collectingAgents = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      collectingAgents = false;
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else if (current) {
      collectingAgents = false;
    }
  }
  return groups;
}

/**
 * Does a rule's pattern match the path? The pattern is read from the start of the path; `*` stands
 * for any run of characters and a final `$` ties the pattern to the path's end (RFC 9309, 2.2.3).
 *
 * No regular expression: the rule and the path both come from the site (its robots.txt, its
 * redirects), and `*` as `.*` backtracks without end on a rule like `/*a*a*a*a*b`. Here every piece
 * between two `*` is looked for once, left to right, so the work grows with the length of the path
 * and the pattern, not with their product.
 */
export function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const pieces = (anchored ? pattern.slice(0, -1) : pattern).split("*");
  const first = pieces[0] ?? "";
  if (!path.startsWith(first)) return false;
  if (pieces.length === 1) return !anchored || path.length === first.length;
  let position = first.length;
  const last = pieces.length - 1;
  for (let index = 1; index < last; index += 1) {
    const piece = pieces[index] ?? "";
    if (!piece) continue;
    // The leftmost place is the right one: it leaves the most of the path for the pieces after it.
    const found = path.indexOf(piece, position);
    if (found < 0) return false;
    position = found + piece.length;
  }
  const tail = pieces[last] ?? "";
  if (!anchored) return tail === "" || path.includes(tail, position);
  return path.length - tail.length >= position && path.endsWith(tail);
}

const rulesAllow = (rules: readonly RobotsRule[], path: string): boolean => {
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    // A shorter rule can never win against the best one so far: not weighed at all.
    if (best && (rule.pattern.length < best.pattern.length || (rule.pattern.length === best.pattern.length && (!rule.allow || best.allow)))) continue;
    if (patternMatches(rule.pattern, path)) best = rule;
  }
  return best ? best.allow : true;
};

/** The rules of the groups that apply to `agent`: the ones naming it, else the `*` groups. */
const applicableRules = (groups: readonly RobotsGroup[], agent: string): RobotsRule[] => {
  const token = agent.toLowerCase();
  const own = groups.filter((group) => group.agents.includes(token));
  return (own.length ? own : groups.filter((group) => group.agents.includes("*"))).flatMap((group) => group.rules);
};

/** May `agent` fetch `path` (path and query) under these groups? */
export function robotsAllows(groups: readonly RobotsGroup[], path: string, agent: string = ROBOTS_AGENT): boolean {
  if (path === "/robots.txt") return true;
  return rulesAllow(applicableRules(groups, agent), path);
}

/** How many of a site's rules we weigh, how long one may be (no address we fetch is longer), and how long all together. */
export const ROBOTS_MAX_RULES = 1_000;
export const ROBOTS_MAX_PATTERN = 2_048;
export const ROBOTS_MAX_CHARS = 64 * 1024;
/** How many sites' answers are kept at once. */
export const ROBOTS_CACHE_MAX = 200;

/**
 * What we keep of a robots.txt: only the rules that apply to `agent`, as our own copy (not pieces of
 * the file, which would keep all of it in memory). A site with more rules for us than
 * `ROBOTS_MAX_RULES` (or `ROBOTS_MAX_CHARS` in all), or a rule longer than any address we fetch, gets
 * `null`: we do not weigh such a file, so we do not fetch from that site (not crawling is always
 * within the rules). The limits bound both the time one answer takes and the memory it holds.
 */
export function compileRobots(text: string, agent: string = ROBOTS_AGENT): RobotsRule[] | null {
  const rules = applicableRules(parseRobots(text), agent);
  if (rules.length > ROBOTS_MAX_RULES) return null;
  let chars = 0;
  for (const rule of rules) {
    chars += rule.pattern.length;
    if (rule.pattern.length > ROBOTS_MAX_PATTERN || chars > ROBOTS_MAX_CHARS) return null;
  }
  return JSON.parse(JSON.stringify(rules)) as RobotsRule[];
}

export interface Robots {
  /** May we fetch this address? `fetchText` reads the site's robots.txt for this call (its deadline). */
  allowed: (url: URL, fetchText?: (url: string) => Promise<SafeFetchResult>) => Promise<boolean>;
  /** Sites with a kept answer, and the characters of all kept rules (for tests and the logs). */
  size: () => number;
  weight: () => number;
}

/**
 * robots.txt answers per site, fetched through `fetchText` and kept for `ttlMs`. The store is
 * bounded, because the sites are whatever people type: at most `ROBOTS_CACHE_MAX` sites (the oldest
 * goes first), answers that ran out are removed whenever one is added, and each answer holds at
 * most `ROBOTS_MAX_RULES` rules of `ROBOTS_MAX_CHARS` characters together.
 */
export function createRobots(options: { fetchText: (url: string) => Promise<SafeFetchResult>; now?: () => number; ttlMs?: number }): Robots {
  /** `rules: null`: a file too big to weigh, the site is not fetched. */
  const cache = new Map<string, { rules: RobotsRule[] | null; expires: number }>();
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? ROBOTS_TTL_MS;
  const answer = (rules: RobotsRule[] | null, path: string) => path === "/robots.txt" || (rules !== null && rulesAllow(rules, path));
  const keep = (origin: string, rules: RobotsRule[] | null) => {
    const time = now();
    for (const [key, entry] of cache) if (entry.expires <= time) cache.delete(key);
    cache.delete(origin);
    // A Map keeps the order of insertion: its first key is the oldest answer.
    while (cache.size >= ROBOTS_CACHE_MAX) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
    }
    cache.set(origin, { rules, expires: time + ttl });
  };
  return {
    async allowed(url, fetchText = options.fetchText) {
      const path = `${url.pathname}${url.search}`;
      const cached = cache.get(url.origin);
      if (cached && cached.expires > now()) return answer(cached.rules, path);
      const result = await fetchText(`${url.origin}/robots.txt`);
      let rules: RobotsRule[] | null;
      if (result.ok) rules = compileRobots(result.body);
      else if (result.status !== undefined && result.status >= 400 && result.status < 500) rules = [];
      else return false; // unreachable: disallowed for this run, asked again next time
      keep(url.origin, rules);
      return answer(rules, path);
    },
    size: () => cache.size,
    weight: () => {
      let total = 0;
      for (const entry of cache.values()) for (const rule of entry.rules ?? []) total += rule.pattern.length;
      return total;
    },
  };
}
