# 0015 — Prepared pages for top creators (concierge onboarding)

**Context.** For big creators the founder wants to do the work up front: the Linkyo team builds the page, asks the
creator for their email, and when the creator signs up with that email (Google or a normal sign-up) the account is
simply there, page included.

**Decision.**

- **Prepared page = a preview with an invite.** Each prepared page lives on the server with its slug, address,
  look, pages per language and `invite.emailSha256` — the SHA-256 of the email(s) the creator gave us. Plain emails
  never enter the code or the browser.
- **The team's workflow.** Build the page in the dashboard (any account) → Settings → Export my data →
  `node apps/web/scripts/prepare-page.mjs --from export.json --email creator@example.com --name "Name"`. The script
  writes uploaded pictures to `public/prepared/<slug>/`, stores the page as JSON (checked with the page schema at
  start) and prints the preview link and the invite link. Hand-made previews (like Nizar's) use the same fields.
- **The creator's way in.** The preview's claim bar (or the invite link) opens sign-up with the address filled in and
  locked: "Your page is ready — sign up with the email you gave us". Any sign-up (with or without the link) asks the
  server (`POST /api/prepared`) whether a page was prepared for this email:
  - match → the account is created with that page and its address, no welcome steps, and Home greets them once
    ("Welcome, Nizar! Your page is ready.");
  - invite link with another email → "This page was prepared for a different email";
  - the reserved address with another email → "This address is reserved for a creator";
  - otherwise a normal account.
- **Only what is real carries over.** Example states shown in the preview (live now, a planned live, the verified
  look) are removed when the creator takes the page over.

**Security.** In demo mode emails are not verified, so the check only decides what a browser-local demo account starts
with. In Phase 1 the claim runs after Supabase Auth has verified the email (Google OAuth or a magic link), so only the
owner of the invited address can take the page over; invites move to a `prepared_pages` table readable only by the
service role, with an admin screen for the team instead of the script.

**Status.** Accepted (confirmed in the Stage 1 audit, 2026-11-24): the team prepares pages this way, and the claim
works as described. Still open: in real mode the team's drafts live in one browser and publishing needs the script and
a deploy; Stage 2 (WP2.1) moves drafts and invites to the database (`prepared_pages`, `prepared_invites`, hashed
one-time invite links).
