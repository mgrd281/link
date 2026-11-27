import { vi } from "vitest";

/*
 * Unit tests render pages with `renderToStaticMarkup`, which cannot wait for a part that loads lazily.
 * Creator pages load Laufbahn's parts that way in the browser (`next/dynamic` in a client module, so
 * their code comes with Laufbahn's pages only, ADR 0008), and Next renders them on the server as part
 * of the page. Here the lazy modules are the parts themselves, so a test sees the page's whole HTML, as
 * the server sends it.
 */

vi.mock("@/features/directions/poster/signposted-lazy", async () => ({
  SignpostedBody: (await import("@/features/directions/poster/signposted")).default,
}));

vi.mock("@/features/directions/poster/signposted-bar", async () => {
  const { AppDownloads, BarReveal, SectionSwitcher } = await import("@/features/directions/poster/laufbahn-index");
  return { AppDownloads, BarReveal, SectionSwitcher };
});

vi.mock("@/features/directions/poster/signposted-blocks", async () => {
  const { LaufbahnAbout, LaufbahnSkills, LaufbahnText, LaufbahnTimeline } = await import("@/features/directions/poster/laufbahn");
  return { LaufbahnAbout, LaufbahnSkills, LaufbahnText, LaufbahnTimeline };
});
