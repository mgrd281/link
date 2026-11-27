import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { isPreparedDocument } from "./lib/creator-path";
import proxy from "./proxy";

// next-intl's middleware does not load outside Next: a stand-in that answers as it does for a
// localized address, with the Link header of hreflang alternates it adds to every one of them.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return {
    default: () => (request: NextRequest) => {
      const response = NextResponse.next();
      const rest = request.nextUrl.pathname.replace(/^\/(?:de|en|ar)(?=\/|$)/u, "");
      const alternates = ["de", "en", "ar"].map(
        (locale) => `<${request.nextUrl.origin}/${locale}${rest}>; rel="alternate"; hreflang="${locale}"`,
      );
      response.headers.set("link", alternates.join(", "));
      return response;
    },
  };
});

const answer = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

describe("the PDFs of a prepared page (ADR 0089)", () => {
  it("answer without next-intl's hreflang alternates: an attachment in one language, and /ar/p/<slug>/cv is a 404", () => {
    for (const path of [
      "/de/p/jonas-brandt/cv",
      "/de/p/jonas-brandt/letter",
      "/de/p/jonas-brandt/application",
      "/en/p/jonas-brandt/cv",
      "/de/p/jonas-brandt/cv/",
      "/ar/p/karim-nasser/cv",
    ]) {
      expect(isPreparedDocument(path), path).toBe(true);
      expect(answer(path).headers.get("link"), path).toBeNull();
    }
  });

  it("leave every other localized address its alternates: the page itself, its projects, the site", () => {
    for (const path of [
      "/de/p/jonas-brandt",
      "/de/p/jonas-brandt/",
      "/de/p/jonas-brandt/hafenlicht",
      "/de/p/cv",
      "/en/templates",
      "/de",
      "/de/p/jonas-brandt/cv/extra",
    ]) {
      expect(isPreparedDocument(path), path).toBe(false);
      expect(answer(path).headers.get("link"), path).toContain('hreflang="ar"');
    }
  });

  it("knows the documents by their segments only, in a language of the site", () => {
    expect(isPreparedDocument("/fr/p/jonas-brandt/cv")).toBe(false);
    expect(isPreparedDocument("/de/x/jonas-brandt/cv")).toBe(false);
    expect(isPreparedDocument("/de/p/jonas-brandt/lebenslauf")).toBe(false);
    expect(isPreparedDocument("/u/jonas-brandt/cv")).toBe(false);
  });
});
