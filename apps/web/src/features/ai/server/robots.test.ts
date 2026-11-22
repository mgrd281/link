import { describe, expect, it, vi } from "vitest";

import { createRobots, parseRobots, robotsAllows } from "./robots";
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
});
