# 0026 — Pasted songs and videos get their real title and picture

**Context.** A UX review of the whole journey (sign-up, welcome flow, dashboard on phone and
desktop) showed the weakest moment. A creator pastes their Spotify song and their YouTube video,
and the page shows "Music" with a grey placeholder and a black video box. ARCHITECTURE.md planned
a `link-metadata` Edge Function for Phase 1. Songs and videos do not need to wait for it.

**Decision.**

- **`GET /api/link-metadata?url=`** (Next route handler) asks the platform's public oEmbed endpoint
  for YouTube, YouTube Music, Spotify, Vimeo, SoundCloud and TikTok.
  - The endpoint is chosen from `detectLink()`, so the pasted address itself is never fetched (no
    SSRF).
  - Requests have a 3 s timeout and a 200 kB cap.
  - Results are cached for a day.
  - It returns `{ title, author, image }`. YouTube always gets its stable `hqdefault` thumbnail, and
    SoundCloud's "Song by Artist" is split.
- **Pictures stay private.**
  - Pictures are returned only from an exact list of platform image hosts (`PROXIED_IMAGE_HOSTS`).
  - Those hosts are served through our image optimizer (`images.remotePatterns`). A visitor's
    browser never contacts YouTube or Spotify for a cover or thumbnail.
  - Before, platform pictures were loaded straight from the platform with no referrer. They are now
    proxied, which also covers the concept pages' story thumbnails.
- **Client.**
  - The editor fills in the details a moment after a song or video is added, from the Add sheet or
    the welcome flow.
  - It only replaces what still shows its placeholder. Anything the creator typed in the meantime
    stays as written.
  - The fill-in is not an undo step of its own (`enrich` action): one undo removes the new block.
- **Same pass, smaller fixes:**
  - Buttons rendered as links (`<Button asChild>`) lost their icon. They now render the icon
    inside the link (Radix `Slottable`). This affects 11 buttons, including "View page" on Home,
    which now matches its neighbours.
  - The editor's "Add" and "Add section" buttons stack on narrow phones, so the second one no
    longer runs off the screen.
  - Keyboard shortcut tips show only with a fine pointer. Touch screens get a drag/menu tip.
  - The look step and the Design screen showed three similar hints. They now show one line: the
    chosen template's name and description.

**Consequences.**

- Until Phase 1, platform pictures go through the Next image optimizer. The demo's traffic stays
  well inside the free tier. In Phase 1 the Edge Function copies the picture into Storage when the
  link is added, with variants generated at upload like every other image, so COSTS.md (no Vercel
  image optimization in production) still holds.
- Generic links (OpenGraph of any website) still wait for the Phase 1 Edge Function with full SSRF
  protection.
