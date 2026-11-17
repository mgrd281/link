# 0009 — Music smart links without Odesli

**Context.** The master prompt suggests song.link/Odesli. Research (2026-11-17): keyless access ended (401
`PUBLIC_API_ACCESS_DEPRECATED`), and **Odesli belongs to Linktree** (acquired 2021), a direct competitor — a dependency
would leak our users' release links to a competitor and could be revoked.

**Proposal.** Own resolver in an Edge Function: identify the release from the pasted URL (Spotify oEmbed / Apple MusicKit
lookup / Deezer public API) → get ISRC/UPC → search the other catalogs (Apple MusicKit, Deezer, YouTube Music via
YouTube Data API, SoundCloud/Bandcamp by URL only) → cache per ISRC. Creators can always edit/add platform links.
Spotify Web API is optional (2026 quota rules: Premium owner, 5 users in dev mode, extended quota only ≥ 250 k MAU).
