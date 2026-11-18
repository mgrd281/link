# 0021 — More page kinds: online business, tech, coaching, streaming, podcasts

**Context.** The founder asked for page kinds for affiliate creators, online retailers, online
marketing and programmers, "and more". The welcome flow asks "What describes you best?" (ADR 0018);
the gallery shows examples per kind (ADR 0019).

**Decision.**

- **Seven new kinds** (21 in total):

  | Kind | Template | First socials | Questions |
  |---|---|---|---|
  | `affiliate` | Daylight · modern | Instagram, TikTok, YouTube | affiliate switch, newsletter |
  | `marketing` | Daylight · modern | LinkedIn, Instagram, X | booking, website, newsletter, email |
  | `developer` | Nocturne · tech | GitHub, LinkedIn, X | website, CV, email |
  | `designer` | Atelier · editorial | Instagram, LinkedIn, Threads | website, booking, email |
  | `coach` | Daylight · elegant | Instagram, LinkedIn, YouTube | booking, newsletter, email |
  | `streamer` | Nocturne · tech | Twitch, Discord, YouTube, TikTok | — |
  | `podcast` | Atelier · editorial | Instagram, YouTube, TikTok | newsletter |

  The kinds are ordered by audience: creators first, then online business, then local business and
  careers.
- **Online retailers** use the existing `store` kind, now named "Online-Händler & Shop" / "Online
  store & seller" / "تاجر إلكتروني ومتجر".
- **Affiliate links are labelled by construction.** The affiliate kind asks "These are affiliate links".
  When the switch is on, every pasted link, card or product carries `affiliate: true`, and the page
  shows the "Anzeige"/"Ad" label (UWG § 5a, MStV § 22). Other kinds have no such switch, so it can
  never label their links by accident.
- **GitHub becomes a platform.** It has a Simple Icons glyph and link detection; LinkedIn profile links
  are detected too. Twitch and Discord join the welcome flow's handle fields.
- **Gallery:** two new categories, "Online business" and "Tech & design", and eleven new fictional
  examples:
  - two affiliate creators;
  - two online retailers;
  - a marketing consultant;
  - a marketing agency;
  - an Arabic course creator;
  - two developers;
  - a UX/UI designer;
  - a business coach.

  Every example has its own look and language. Affiliate products carry the ad label. Photos are
  Unsplash-licensed and credited in `assets/examples/CREDITS.md`.

**Status.** Applied.
