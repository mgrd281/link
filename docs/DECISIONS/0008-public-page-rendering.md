# 0008 — Public creator page rendering (Phase 1 spike)

**Context.** Spec: JS < 70 KB, LCP < 1.5 s on 4G, CLS 0, Lighthouse ≥ 95. Phase 0 prototypes render through the App
Router with client islands: Lighthouse mobile 90–99, CLS ≤ 0.03, but **205 KB JS** (React + Next runtime + islands).
The reference analysis shows competitors at 39 KB–1.7 MB.

**Proposal.** Render public pages with the same React renderer components to **static HTML on the server**
(`react-dom/server` in a Route Handler or build step, cached as ISR with tag revalidation), inline critical CSS
(Tailwind compiled per renderer), and ship ~3 KB of vanilla islands: click-to-load embeds, newsletter form, analytics
beacon (`sendBeacon`). Fonts: only the active pairing, preloaded, `size-adjust` fallbacks. The dashboard preview keeps
using the React components directly → still "the real renderer".

**Spike exit criteria.** JS ≤ 10 KB, Lighthouse 100/100/100/100 on the three direction pages, identical HTML output in
dashboard preview and public page (snapshot test).
