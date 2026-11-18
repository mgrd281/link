# 0016 — Team area (/admin): roles, permissions, prepared pages

**Context.** The founder asked for an admin dashboard where the Linkyo team has every permission and full editing
for the prepared pages of top creators (0015), instead of building pages in a personal account and running a script
by hand.

**Decision.**

- **One place for the team: `/admin`** (noindex). It reuses the creator dashboard's look and gestures (same editor,
  same design screen, same sheets) so nobody learns a second tool. It's clearly marked "Team" so it's never confused
  with a creator's own dashboard.
- **Access.** A Linkyo account is required. The account's email must be on the team. The very first person
  enters the **team code**, which the server checks (`POST /api/admin/verify`, SHA-256 compared in constant time
  against `LINKYO_ADMIN_CODE_SHA256`, with a demo default). That person becomes the owner. The browser keeps only a
  team token, an HMAC derived from the configured hash, never the code. Changing the code signs every browser out.
  `GET /api/admin/prepared` (published pages, invites only as a count) requires that token.
- **Roles → permissions in one table** (`features/admin/types.ts`), checked by every screen and shown to the team as
  a matrix:

  | Permission | Owner | Admin | Editor | Viewer |
  | --- | :-: | :-: | :-: | :-: |
  | Create pages | ✓ | ✓ | ✓ | – |
  | Edit & design pages | ✓ | ✓ | ✓ | – |
  | Approve & publish | ✓ | ✓ | – | – |
  | Delete pages | ✓ | ✓ | – | – |
  | Verify creators | ✓ | ✓ | – | – |
  | Manage invites | ✓ | ✓ | – | – |
  | Manage team & roles | ✓ | – | – | – |
  | See activity | ✓ | ✓ | ✓ | ✓ |

  The last owner can't be removed or demoted, and nobody changes their own role. Owners can **view as** another role
  to check what a teammate sees.
- **Creator pages.** One list holds drafts, pages ready to publish, and published pages, with search and status
  filters. A page has three tabs:
  - **Page** and **Design**: the real editor via `EditorProvider` with a stand-in account.
  - **Invite & approval**: invites (emails stay in the team area and are exported only as SHA-256), the verified
    badge (it stays after the takeover), languages (one page per language), status Draft → Ready, copyable preview
    and invite links, and delete.

  A published page can be copied into a draft and published again. Invites already sent stay valid, because
  publishing merges invite hashes with the ones already there.
- **Publishing (Phase 0).** "Download file" (enabled once a page is Ready) →
  `node apps/web/scripts/prepare-page.mjs --add linkyo-<slug>.json` → commit & deploy. Pictures become files; the
  schema check runs at start. In Phase 1 this becomes one "Publish" click (a `prepared_pages` table with row-level
  security mirroring the permission table).
- **Activity log.** Who did what to which page, newest first, grouped by day, capped at 500 entries. Creator emails
  never appear in it.

**Demo limits.** Team data (members, drafts, activity) lives in the browser that created it, like demo accounts.
The team code and published pages are server-side. Phase 1 moves members, drafts and activity to Supabase. Members
then sign in with verified emails, and roles are enforced by the database as well as the UI.

**Status.** Proposed — waiting for the founder's review.
