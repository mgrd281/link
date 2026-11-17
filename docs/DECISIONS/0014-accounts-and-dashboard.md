# 0014 — Accounts and the creator dashboard (demo mode first)

**Context.** The founder asked for sign-up, log-in and "a complete, comprehensive and very easy dashboard that also
works on the phone, UX 10/10". Real accounts need the Phase 1 backend (Supabase Auth + Postgres in Frankfurt, ADR 0010),
which this environment cannot provision. Waiting would block every UX decision for the most-used part of the product.

**Decision.**

- **One account contract, two implementations.** Screens talk only to `AccountStore`
  (`apps/web/src/features/account/types.ts`): sign-up, log-in, log-out, reset, change email/password/address, update
  site, export, delete, plus a synchronous snapshot for `useSyncExternalStore`. Today `LocalAccountStore` keeps
  everything in this browser's `localStorage` (one key, `linkyo.demo.v1`); Phase 1 swaps the one line in `store.ts` for
  a Supabase implementation with the same methods. Every demo screen says "Demo" and what that means.
- **Honest demo.** Passwords are hashed with PBKDF2-SHA-256 (310 000 iterations, random salt) and never stored in plain
  text; log-in gives one answer for unknown email and wrong password; reset sets the password directly and says that
  real accounts will get an email link; Google/Apple buttons are shown, disabled and marked "At launch"; analytics are
  labelled "Sample data" everywhere; the page address is labelled as going live at launch. No cookies, no network.
- **Routes.** `/signup` (address prefilled from the homepage claim), `/login` (returns to `?next=`, in-app paths only),
  `/forgot`; `/app` is guarded in the browser (signed-out → log-in, new accounts → `/app/welcome`): `/app` home,
  `/app/editor`, `/app/design`, `/app/analytics`, `/app/settings`, `/app/preview` (the page full screen).
- **One editor for the whole dashboard.** A single provider holds profile, blocks and look in one undo history (⌘Z /
  ⇧⌘Z everywhere) and autosaves 400 ms after the last change; the last change is written immediately when the page is
  hidden or closed. The status ("Saved / Saving… / Not saved") is always visible.
- **Adding and editing.** One Add sheet everywhere (sidebar button, the central + on the phone tab bar): paste one or
  more links (smart detect picks the block type), pick one of 16 types, or upload photos (one → image, several →
  gallery). Every block type has an edit sheet; drafts show in the live page while typing; validation uses the API's
  Zod schema and names the field that needs attention; closing with changes asks before discarding. Pictures are resized
  in the browser (photos 1080 px JPEG, logos keep transparency) and measured for light/dark tone.
- **Layout.** Wide screens: sidebar (profile, Add, Home · Page · Design · Stats · Settings, save state, account) and,
  from `xl`, the live phone preview beside every editing screen — edit sheets dock next to it so the page stays
  visible. Phones: top bar (who, save state, view page, account menu) and a bottom tab bar with Add in the middle, all
  within thumb reach; sheets slide up; previews open full height.
- **No photo yet.** `NO_IMAGE` in `@linkyo/blocks`; the Poster renderer shows a monogram hero and calm image tiles, so a
  new page never shows a broken or borrowed picture. Pasted links never carry sample media onto a creator's page.
- **Legal.** Settings collect the Impressum (§ 5 DDG) and offer JSON export and account deletion (type the address to
  confirm).

**Accessibility.** axe (WCAG 2.2 AA) is clean on sign-up/log-in/reset (3 languages × light/dark × desktop/phone) and on
every dashboard screen plus the Add and edit sheets (en + ar × light/dark × desktop/phone). The analytics chart is a
slider (arrow keys read each day) with a table view; the checklist is a progressbar; reorder works with ⌥↑/⌥↓; dashboard
previews no longer nest a second `<main>`.

**Phase 1 work this leaves.** Supabase `AccountStore` (Auth with email links, Google, Apple; RLS; Storage for images),
server-side metadata fetching for pasted links, real cookie-free analytics, publishing the page at `linkyo.app/<name>`.

**Status.** Proposed — waiting for the founder's review.
