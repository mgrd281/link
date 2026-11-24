import { describe, expect, it } from "vitest";

import { cleanHost, REFERRER_GROUPS, referrerGroup } from "./referrer";

const OWN = "linkyo.app";

describe("referrer groups", () => {
  it("name the big platforms by any of their hosts", () => {
    const cases: [string, string][] = [
      ["instagram.com", "instagram"],
      ["l.instagram.com", "instagram"],
      ["www.tiktok.com", "tiktok"],
      ["m.youtube.com", "youtube"],
      ["youtu.be", "youtube"],
      ["l.facebook.com", "facebook"],
      ["lm.facebook.com", "facebook"],
      ["t.co", "x"],
      ["twitter.com", "x"],
      ["x.com", "x"],
      ["www.linkedin.com", "linkedin"],
      ["lnkd.in", "linkedin"],
    ];
    for (const [host, group] of cases) expect(referrerGroup(host, OWN), host).toBe(group);
  });

  it("put search engines together, with their country domains", () => {
    for (const host of ["www.google.de", "google.com", "www.google.co.uk", "www.bing.com", "duckduckgo.com", "www.ecosia.org", "search.brave.com", "de.search.yahoo.com", "search.yahoo.com"])
      expect(referrerGroup(host, OWN), host).toBe("search");
  });

  it("call a visit without a referrer direct (typed in, a bookmark, a messenger)", () => {
    expect(referrerGroup("", OWN)).toBe("direct");
    expect(referrerGroup("not a host", OWN)).toBe("direct");
  });

  it("mark a QR code by the address's marker, whatever the referrer", () => {
    expect(referrerGroup("", OWN, "qr")).toBe("qr");
    expect(referrerGroup("instagram.com", OWN, "qr")).toBe("qr");
    expect(referrerGroup("", OWN, "poster")).toBe("direct");
  });

  it("count a step inside the same site as no new source", () => {
    expect(referrerGroup("linkyo.app", OWN)).toBeNull();
    expect(referrerGroup("LINKYO.APP", "linkyo.app:443")).toBeNull();
  });

  it("put everything else under other, never a host name of its own", () => {
    expect(referrerGroup("blog.example.com", OWN)).toBe("other");
    expect(referrerGroup("instagram.com.evil.example", OWN)).toBe("other");
    expect(referrerGroup("notinstagram.com", OWN)).toBe("other");
    expect(REFERRER_GROUPS).toContain(referrerGroup("anything.example", OWN));
  });

  it("read only a host name: no path, no query, no port", () => {
    expect(cleanHost("Example.COM:8080")).toBe("example.com");
    expect(cleanHost("example.com/path?q=1")).toBe("");
    expect(cleanHost("localhost")).toBe("");
    expect(cleanHost(42)).toBe("");
  });

  it("match the list the database accepts", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const sql = readFileSync(path.resolve(import.meta.dirname, "../../../../../supabase/migrations/20261125100000_page_stats.sql"), "utf8");
    const list = /referrer in \(([^)]*)\)/.exec(sql)?.[1] ?? "";
    expect(list.split(",").map((item) => item.trim().replace(/'/g, ""))).toEqual([...REFERRER_GROUPS]);
  });
});
