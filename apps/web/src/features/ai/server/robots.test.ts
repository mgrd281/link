import { describe, expect, it, vi } from "vitest";

import { compileRobots, createRobots, parseRobots, patternMatches, ROBOTS_CACHE_MAX, ROBOTS_MAX_CHARS, ROBOTS_MAX_RULES, robotsAllows } from "./robots";
import type { SafeFetchResult } from "./safe-fetch";

const ok = (body: string): SafeFetchResult => ({ ok: true, url: "https://site.example/robots.txt", status: 200, contentType: "text/plain", body });

describe("robots.txt (RFC 9309)", () => {
  const text = `
# comment
User-agent: Googlebot
Disallow: /

User-agent: LinkyoImport/1.1
User-agent: OtherBot
Allow: /public/private-ok
Disallow: /public/
Disallow: /*.pdf$
Disallow:

User-agent: *
Disallow: /private
Allow: /private/open
`;
  const groups = parseRobots(text);

  it("groups user agents with their rules", () => {
    expect(groups).toHaveLength(3);
    expect(groups[1]?.agents).toEqual(["linkyoimport", "otherbot"]);
    expect(groups[1]?.rules).toHaveLength(3);
  });

  it("applies our own group, with the longest match winning", () => {
    expect(robotsAllows(groups, "/public/page")).toBe(false);
    expect(robotsAllows(groups, "/public/private-ok/x")).toBe(true);
    expect(robotsAllows(groups, "/files/cv.pdf")).toBe(false);
    expect(robotsAllows(groups, "/files/cv.pdf?x=1")).toBe(true);
    // Our group says nothing about /private: the * group does not apply when ours exists.
    expect(robotsAllows(groups, "/private")).toBe(true);
  });

  it("uses the * group when ours is missing, and lets an allow win a tie", () => {
    const star = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /tie\nAllow: /tie\n");
    expect(robotsAllows(star, "/private/x")).toBe(false);
    expect(robotsAllows(star, "/private/open/x")).toBe(true);
    expect(robotsAllows(star, "/tie")).toBe(true);
    expect(robotsAllows(star, "/robots.txt")).toBe(true);
    expect(robotsAllows(parseRobots(""), "/anything")).toBe(true);
    expect(robotsAllows(parseRobots("User-agent: *\nDisallow: /\n"), "/x")).toBe(false);
  });

  it("allows everything when robots.txt is missing (4xx) and disallows when it cannot be read (5xx, network)", async () => {
    const missing = createRobots({ fetchText: () => Promise.resolve({ ok: false, reason: "notFound", status: 404 }) });
    expect(await missing.allowed(new URL("https://a.example/x"))).toBe(true);
    const broken = createRobots({ fetchText: () => Promise.resolve({ ok: false, reason: "failed", status: 503 }) });
    expect(await broken.allowed(new URL("https://b.example/x"))).toBe(false);
    const offline = createRobots({ fetchText: () => Promise.resolve({ ok: false, reason: "timeout" }) });
    expect(await offline.allowed(new URL("https://c.example/x"))).toBe(false);
  });

  it("keeps an answer for 24 hours per site, and does not keep a failure", async () => {
    let now = 0;
    const fetchText = vi.fn(() => Promise.resolve(ok("User-agent: *\nDisallow: /no\n")));
    const robots = createRobots({ fetchText, now: () => now });
    expect(await robots.allowed(new URL("https://site.example/no"))).toBe(false);
    expect(await robots.allowed(new URL("https://site.example/yes"))).toBe(true);
    expect(fetchText).toHaveBeenCalledTimes(1);
    expect(fetchText).toHaveBeenCalledWith("https://site.example/robots.txt");
    now = 24 * 60 * 60 * 1000 + 1;
    await robots.allowed(new URL("https://site.example/yes"));
    expect(fetchText).toHaveBeenCalledTimes(2);

    const flaky = vi.fn(() => Promise.resolve<SafeFetchResult>({ ok: false, reason: "failed", status: 500 }));
    const again = createRobots({ fetchText: flaky });
    await again.allowed(new URL("https://x.example/"));
    await again.allowed(new URL("https://x.example/"));
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it("matches * and $ like RFC 9309, without a regular expression", () => {
    expect(patternMatches("/", "/anything")).toBe(true);
    expect(patternMatches("/fish", "/fish.html")).toBe(true);
    expect(patternMatches("/fish", "/Fish")).toBe(false);
    expect(patternMatches("/fish*", "/fish/salmon")).toBe(true);
    expect(patternMatches("/*.php", "/index.php?x=1")).toBe(true);
    expect(patternMatches("/*.php", "/php")).toBe(false);
    expect(patternMatches("/*.php$", "/folder/file.php")).toBe(true);
    expect(patternMatches("/*.php$", "/file.php?x=1")).toBe(false);
    expect(patternMatches("/*.php$", "/file.php5")).toBe(false);
    expect(patternMatches("/fish*.php", "/fishheads/catfish.php?id=1")).toBe(true);
    expect(patternMatches("/fish*.php", "/Fish.PHP")).toBe(false);
    expect(patternMatches("/a*b*c$", "/a-b-c-b-c")).toBe(true);
    expect(patternMatches("/a*b*c$", "/a-c-b")).toBe(false);
    expect(patternMatches("/a*a$", "/a")).toBe(false);
    expect(patternMatches("/a**b", "/ab")).toBe(true);
    expect(patternMatches("/exact$", "/exact")).toBe(true);
    expect(patternMatches("/exact$", "/exact/")).toBe(false);
    // Characters that mean something in a regular expression are plain text here; a "$" inside too.
    expect(patternMatches("/a.b(c)+[d]", "/a.b(c)+[d]/x")).toBe(true);
    expect(patternMatches("/a.b", "/axb")).toBe(false);
    expect(patternMatches("/pay$ment", "/pay$ment")).toBe(true);
  });

  // ssrf-1: the rules and the path both come from the site. As a regular expression (`.*` per `*`)
  // the first of these took 450 ms, the second two minutes, the others did not end.
  it("answers hostile wildcard rules in well under 200 ms", () => {
    const timed = (rule: string, path: string): boolean => {
      const groups = parseRobots(`User-agent: *\nDisallow: ${rule}\n`);
      const started = performance.now();
      const allowed = robotsAllows(groups, path);
      expect(performance.now() - started, `${rule} against ${String(path.length)} characters`).toBeLessThan(200);
      return allowed;
    };
    expect(timed("/*a*a*a*a*b", `/${"a".repeat(120)}`)).toBe(true);
    expect(timed("/*a*a*a*a*b", `/${"a".repeat(300)}`)).toBe(true);
    expect(timed("/*a*a*a*a*a*a*a*a*b", `/${"a".repeat(300)}`)).toBe(true);
    expect(timed("/*a*a*a*b", `/${"a".repeat(2000)}`)).toBe(true);
    expect(timed(`/${"*a".repeat(500)}*b$`, `/${"a".repeat(2047)}`)).toBe(true);
    expect(timed(`/${"*a".repeat(500)}*b$`, `/${"a".repeat(2046)}b`)).toBe(false);
    // The costliest rules a file may hold for us (a long piece that almost fits everywhere), as many as we weigh.
    const near = `Disallow: /*${"a".repeat(500)}b${"a".repeat(499)}\n`;
    const most = `User-agent: *\n${near.repeat(Math.floor(ROBOTS_MAX_CHARS / near.length))}`;
    const started = performance.now();
    const rules = compileRobots(most);
    expect(rules).toHaveLength(Math.floor(ROBOTS_MAX_CHARS / near.length));
    expect(robotsAllows([{ agents: ["*"], rules: rules ?? [] }], `/${"a".repeat(2047)}`)).toBe(true);
    // The largest file we read (512 KB) full of them is refused unweighed.
    expect(compileRobots(`User-agent: *\n${near.repeat(Math.floor((512 * 1024) / near.length))}`)).toBeNull();
    expect(performance.now() - started).toBeLessThan(200);
  });

  it("keeps only the rules that apply to us, and refuses a file with more rules than it will weigh", () => {
    const rules = compileRobots("User-agent: Googlebot\nDisallow: /g\n\nUser-agent: LinkyoImport\nDisallow: /ours\n\nUser-agent: *\nDisallow: /all\n");
    expect(rules).toEqual([{ allow: false, pattern: "/ours" }]);
    expect(compileRobots("User-agent: Googlebot\nDisallow: /g\n\nUser-agent: *\nDisallow: /all\nAllow: /all/open\n")).toEqual([
      { allow: false, pattern: "/all" },
      { allow: true, pattern: "/all/open" },
    ]);
    expect(compileRobots("")).toEqual([]);
    // Too many rules, or one longer than any address we fetch: not weighed, so not fetched.
    expect(compileRobots(`User-agent: *\n${"Allow: /a\n".repeat(ROBOTS_MAX_RULES)}`)).toHaveLength(ROBOTS_MAX_RULES);
    expect(compileRobots(`User-agent: *\n${"Allow: /a\n".repeat(ROBOTS_MAX_RULES + 1)}`)).toBeNull();
    expect(compileRobots(`User-agent: *\nDisallow: /${"*".repeat(2048)}\n`)).toBeNull();
    expect(compileRobots(`User-agent: *\n${`Disallow: /${"a".repeat(2000)}\n`.repeat(40)}`)).toBeNull();
    // Rules for other crawlers do not count.
    expect(compileRobots(`User-agent: Googlebot\n${"Disallow: /a\n".repeat(ROBOTS_MAX_RULES + 1)}\nUser-agent: *\nDisallow: /x\n`)).toEqual([{ allow: false, pattern: "/x" }]);
  });

  it("does not fetch a site whose rules are too many to weigh", async () => {
    const robots = createRobots({ fetchText: () => Promise.resolve(ok(`User-agent: *\n${"Allow: /\n".repeat(ROBOTS_MAX_RULES + 1)}`)) });
    expect(await robots.allowed(new URL("https://huge.example/"))).toBe(false);
  });

  // ssrf-4: one entry per site, for 24 hours, on a server that lives for days.
  it("forgets the oldest sites beyond its limit and every answer that ran out", async () => {
    let now = 0;
    const fetchText = vi.fn(() => Promise.resolve(ok("User-agent: *\nDisallow: /no\n")));
    const robots = createRobots({ fetchText, now: () => now, ttlMs: 1_000 });
    for (let site = 0; site <= ROBOTS_CACHE_MAX; site += 1) await robots.allowed(new URL(`https://s${String(site)}.example/`));
    expect(robots.size()).toBe(ROBOTS_CACHE_MAX);
    expect(fetchText).toHaveBeenCalledTimes(ROBOTS_CACHE_MAX + 1);
    // The newest is still known, the first one was dropped and is asked again.
    await robots.allowed(new URL(`https://s${String(ROBOTS_CACHE_MAX)}.example/x`));
    expect(fetchText).toHaveBeenCalledTimes(ROBOTS_CACHE_MAX + 1);
    await robots.allowed(new URL("https://s0.example/x"));
    expect(fetchText).toHaveBeenCalledTimes(ROBOTS_CACHE_MAX + 2);
    // After the 24 hours (here: a second) nothing is kept for sites nobody asks about again.
    now = 5_000;
    await robots.allowed(new URL("https://fresh.example/"));
    expect(robots.size()).toBe(1);
  });

  it("keeps only the rules for us, not the whole file", async () => {
    const robots = createRobots({ fetchText: () => Promise.resolve(ok(`User-agent: Other\n${"Disallow: /zzzzzzzzzzzzzzzzzzzzzzzzzzzz\n".repeat(900)}User-agent: *\nDisallow: /private-area-of-the-site\n`)) });
    expect(await robots.allowed(new URL("https://site.example/private-area-of-the-site/x"))).toBe(false);
    expect(await robots.allowed(new URL("https://site.example/zzzzzzzzzzzzzzzzzzzzzzzzzzzz"))).toBe(true);
    expect(robots.weight()).toBeLessThan(200);
  });
});
