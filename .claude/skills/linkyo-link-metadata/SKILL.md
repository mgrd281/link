---
name: linkyo-link-metadata
description: How pasted links get their real title, artist and picture in Linkyo (/api/link-metadata via platform oEmbed, pictures re-served by our image optimizer). Use when adding a platform, when a pasted song or video shows a placeholder, when a platform picture fails to load, or when touching detectLink, PROXIED_IMAGE_HOSTS or images.remotePatterns.
---

# Linkyo link metadata

See ADR 0026. A pasted link becomes a block right away (`detectLink` in `packages/blocks`). A moment
later the editor fills in the real details.

## Flow

1. `features/app/site-context.tsx` → `enrich(blocks)` after Add. The welcome flow calls it too.
2. `features/app/metadata.ts`:
   - `metadataUrl(block)` picks the URL: a video's page or a release's first link;
   - `fetchLinkMetadata(url)` calls our route;
   - `metadataPatch(current, added, meta)` only fills fields that still hold their placeholder.
3. `src/app/api/link-metadata/route.ts` asks the platform's oEmbed (`OEMBED` map). It never fetches
   the pasted address itself. It has a 3 s timeout, a 200 kB cap and a one-day cache.
4. The `enrich` reducer action patches the block without an undo step of its own.

## Pictures stay private

- `features/directions/shared/remote-images.ts` → `PROXIED_IMAGE_HOSTS`, an exact host list.
- `next.config.ts` builds `images.remotePatterns` from it, and `MediaImage` sends those hosts
  through `/_next/image`. A visitor's browser never contacts YouTube or Spotify.
- The route returns a picture only if `isProxiedImage()` accepts it.

## Add a platform

1. Make sure `detectLink` recognises the address (`packages/blocks/src/detect.ts`, add a test in
   `test/detect.test.ts`).
2. Add its keyless oEmbed endpoint to `OEMBED`, keyed by `detection.platform`. Check the real
   response first, for example with
   `curl -s "https://<platform>/oembed?url=<encoded>" | python3 -m json.tool`, and note which
   fields carry the title, author and thumbnail.
3. Add the exact thumbnail host(s) to `PROXIED_IMAGE_HOSTS`. Never use wildcards, and skip signed,
   expiring URLs (TikTok).
4. If the platform formats titles oddly (SoundCloud's "Song by Artist", YouTube's "Artist -
   Topic"), normalise it in the route or in `metadataPatch`.
5. Tests:
   - extend `route.test.ts` (stub `fetch` with `vi.stubGlobal`);
   - extend `metadata.test.ts` when patch rules change;
   - e2e stubs `**/api/link-metadata**` with `page.route` (never call real platforms in tests).
6. Check it for real against the running app:
   `curl "localhost:3100/api/link-metadata?url=<encoded>"`.

## Not here

- Generic websites (OpenGraph of any URL) need full SSRF protection: DNS resolution, public IPs
  only. They wait for the Phase 1 Edge Function.
- In Phase 1 that function also copies pictures into Storage (variants at upload) instead of
  re-serving them.
