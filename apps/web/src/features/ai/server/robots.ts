import type { SafeFetchResult } from "./safe-fetch";

/**
 * robots.txt (RFC 9309) for the importer and the website reader. We ask as `LinkyoImport`: the
 * groups naming that token apply, else the `*` groups; within them the longest matching rule wins
 * (an allow wins a tie). A missing file (4xx) allows everything; a file we could not get (5xx, a
 * network error) disallows for that run. Answers are kept for 24 hours per site.
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

const patternRegex = (pattern: string): RegExp => {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
};

/** May `agent` fetch `path` (path and query) under these groups? */
export function robotsAllows(groups: readonly RobotsGroup[], path: string, agent: string = ROBOTS_AGENT): boolean {
  if (path === "/robots.txt") return true;
  const token = agent.toLowerCase();
  const own = groups.filter((group) => group.agents.includes(token));
  const applicable = own.length ? own : groups.filter((group) => group.agents.includes("*"));
  let best: RobotsRule | null = null;
  for (const rule of applicable.flatMap((group) => group.rules)) {
    if (!patternRegex(rule.pattern).test(path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)) best = rule;
  }
  return best ? best.allow : true;
}

export interface Robots {
  /** May we fetch this address? */
  allowed: (url: URL) => Promise<boolean>;
}

/** robots.txt answers per site, fetched through `fetchText` and kept for `ttlMs`. */
export function createRobots(options: { fetchText: (url: string) => Promise<SafeFetchResult>; now?: () => number; ttlMs?: number }): Robots {
  const cache = new Map<string, { groups: RobotsGroup[]; expires: number }>();
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? ROBOTS_TTL_MS;
  return {
    async allowed(url) {
      const path = `${url.pathname}${url.search}`;
      const cached = cache.get(url.origin);
      if (cached && cached.expires > now()) return robotsAllows(cached.groups, path);
      const result = await options.fetchText(`${url.origin}/robots.txt`);
      let groups: RobotsGroup[];
      if (result.ok) groups = parseRobots(result.body);
      else if (result.status !== undefined && result.status >= 400 && result.status < 500) groups = [];
      else return false; // unreachable: disallowed for this run, asked again next time
      cache.set(url.origin, { groups, expires: now() + ttl });
      return robotsAllows(groups, path);
    },
  };
}
