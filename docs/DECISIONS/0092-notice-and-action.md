# 0092 — Notice and action: reports, decisions with a statement of reasons, the team's queue

**Status.** Accepted (2026-11-28; 2026-11-28; Stage 4, WP4.1: A-04, A-17 reports and digest, and the console leftovers
3–9 as far as listed below). The lead numbers it after 0091.
Builds on [0016](0016-team-area.md) and [0030](0030-real-accounts.md) (team functions, the activity log),
[0073](0073-team-money-through-stripe.md) (`deliver()` and honest `mailed`), [0090](0090-csp-and-limits.md)
(the in-route limiter, reused unchanged; the report route gets its own row).

**Context.** Linkyo hosts what creators publish, so the DSA's rules for hosting services apply: a notice
mechanism that is easy to reach and electronic (Art. 16), a confirmation of receipt and a notice of the
decision to the person who reported (Art. 16(4), (5)), and a statement of reasons to the creator for every
restriction (Art. 17). Before this package, reports went to an e-mail address named in the Impressum;
there was no queue, a suspension had no reason, and nothing could hide a single block (A-04). The team
had no count of what waits (A-17).

**Decision.**

1. **Database** (`supabase/migrations/20261128100000_reports.sql`, additive; tests
   `supabase/tests/reports.test.sql`):
   - `reports`: the page (its address as reported, and the account it named then), the exact address,
     one of nine categories, the explanation (20–4000 characters), the reporter's name and e-mail
     (required except for the abuse of minors, Art. 16(2)(c)), the good-faith statement (required,
     Art. 16(2)(d)), the language, `open`/`decided`. Row-level security on; only `reports.manage` reads.
   - `moderation_decisions`: one row per decision (`hide_block`, `unpublish`, `suspend`, `dismiss`), with
     the reason the creator reads (10–2000 characters), the ground (`illegal` or `terms`; none for a
     dismissal), who decided, and when it was lifted. One restriction of a kind in force per account and
     block (a partial unique index).
   - **Filing is the server's** (`submit_report`, service role only). Stricter than the plan ("anon can
     insert only through the function"): with the function open to the publishable key, anyone could file
     around the route's limit. Anon and accounts can neither insert into nor read the tables, and anon
     cannot call the function (pgTAP). `reports_accepting()` is anon's only call: the form asks whether
     the migration is in.
   - **Decisions** go through `admin_moderate(customer, decision, why, legal_ground, target_block,
     for_report)`: `reports.manage` first (and `customers.manage` to suspend), the checks (an open report
     about this account, an existing block, not twice, never the own account), the decision, the change
     (suspend signs the account out), the report decided, then `audit()`. The log gets the decision's id,
     the ground and the block's name, never the reason (editors and viewers read the log; the reason may
     quote the report). `admin_lift_moderation(decision, why)` lifts one.
   - **What visitors see:** `public_page()` now leaves out hidden blocks and answers nothing for a page
     taken offline. Project pages, documents and link previews read it, so they follow.
   - **A suspension always has a reason:** `admin_set_status(…, 'suspended')` is refused
     (`linkyo:reasonRequired`); it only lets accounts back in, and that lifts the suspension in force.
   - `admin_reports(state)`, `admin_moderation_target(customer)` (the page's blocks and what is in
     force), `admin_moderation_counts(year)` (reports by category, decisions by action and ground, lifted,
     the median hours to a decision, open now: the transparency figures), `my_moderation()` (the creator's
     own restrictions with their reasons, for the dashboard later), `moderation_digest()` (service role).
   - **Retention:** 180 days after the decision the reporter's name, e-mail, words and link are removed
     (`moderation_purge()`, nightly at 03:53 by `pg_cron`); category, page and the decision stay for the
     count. The permission `reports.manage` is the owners' and admins' (19 and 17 permissions now).
   - Rollback: in the migration's header.

2. **The form** at `/<locale>/melden` (`features/moderation/report-form.tsx`, noindex, not in the
   sitemap; in `e2e/routes.ts`): the page's address (the creator footer's "Melden" fills it:
   `?url=<the page's or project's address>`), the category, the explanation, name and e-mail, the
   good-faith box. No cookie, nothing stored in the browser, nothing from another host. On sending: the
   receipt on screen with the report's number (the first 8 hex digits of its id), date and time, and
   whether the confirmation e-mail went out. Where reports cannot be taken (a demo build, no server key,
   a database without the migration), the page says so and names the e-mail address of `COMPANY` instead,
   as the Impressum does: no form whose button would fail. The page is ISR (300 s), so it follows the
   database without a deploy. The footer's legal links carry "Inhalt melden" in every build; `/kontakt`
   leads there.

3. **The route** `POST /api/reports`: 10 per address and 5 per e-mail address an hour (`lib/rate-limit.ts`
   unchanged, the keys HMACs held in memory), a 32 KB body cap (413), the checks of the form, then
   `submit_report` as the server and the receipt to the reporter's own address. 201 / 400 with the fields /
   409 `unavailable` / 429 with `Retry-After`; never a 500 for a missing function. ADR 0090's firewall
   table gains: `Path equals /api/reports AND Method equals POST → 20 requests / 3600 s / IP`.

4. **The team's queue** at `/admin/reports` (`features/admin/reports-screen.tsx`; nav item "Meldungen" with
   `reports.manage`, hidden where the database has no reports): open reports oldest first with the team's
   target (24 h for hate, violence, minors and sexual content; 72 h for the rest; `REPORT_SLA_HOURS`, a
   target the console shows, not a promise), the reporter's words in their own language and direction, and
   a decision sheet (what happens, which block, the ground, the reasons). Decided reports show the outcome,
   the ground, the reasons, who and when, and "Aufheben" while the restriction is in force. This year's
   figures sit below. The nav badge and the overview's "Braucht Aufmerksamkeit" count open reports; one past
   its target sets the badge apart and says so in words. The customer screen's "Konto sperren" asks for the
   ground and the reasons and goes the same way (`/api/admin/customers/<id>/status`). The demo shows four
   made-up reports (example.com addresses) and decides on them in this browser; nothing is sent.

5. **The e-mails** (`features/email/templates/statement-of-reasons.ts`, `report-notices.ts`,
   `team-digest.ts`), through `deliver()`: true only when a delivering transport took the message; until F1
   production sends nothing, and the console says "E-Mails gehen noch nicht raus". The paragraphs that make
   a legal promise carry `[vom Anwalt zu prüfen]` (`LEGAL_PROMISES.report`), so a `LAUNCH=1` build fails
   while they are unreviewed. The statement of reasons names (Art. 17(3)): what was restricted, where and for
   how long (a); whether a report led to it, without naming the reporter, and the team's findings (b); that
   a person decided without automated means (c); the ground, the law in the team's reasons or the terms
   with their address (d, e); and how to object: within six months to the company's e-mail address, a
   certified out-of-court dispute settlement body (Art. 21 DSA) or a court (f). The digest
   (`POST /api/maintenance/report-digest`, bearer `MAINTENANCE_SECRET`) sends one e-mail per member with
   `reports.manage` when reports wait: how many, how many are late, since when, the link; no page, reporter
   or content. **No job calls it yet.**

**Consequences.**

- The hosted database needs the migration (the lead, after the stage, dry run first). Until then the form
  shows the e-mail way, the queue is hidden, and a suspension from the customer screen still works without
  its reason on record (the route falls back to `admin_set_status` and says so).
- After the migration, any code or script that suspends with `admin_set_status(…, 'suspended')` fails on
  purpose.
- The creator learns of a restriction only by e-mail, which production does not send yet (F1): the
  dashboard does not show it. `my_moderation()` is there for a dashboard notice (not in this package).
- Objections (Art. 20) arrive by e-mail and are handled by hand; "Aufheben" records the outcome. Linkyo is a
  micro enterprise; whether Art. 20/21/24 apply in full is for the lawyer.

**Console leftovers (polish/LEFTOVERS.md 3–9).** Done in the same package: a customer's sign-in cards keep
their whole date and time on a phone (the result moved under it) and the list sizes its columns to its
values on laptops (3, 4); a Latin name in the Arabic customers list truncates in its own direction and keeps
its start (5); a sign-in's country and city shrink by their widths, so the dot never stands alone (7); the
team area's editor names a block's switch "… auf dieser Seite zeigen" (8; the other two sentences the
leftover quotes live in the design system's showcase and the home page's playground, not in the team area's
editor). Not done: the security log's shared columns at 1280 (6) need a decision on where its one-row grid
starts, and the console screens' direct lucide imports (9) need registry meanings for about twenty glyphs;
both are left to the lead.

**Founder decisions needed.** The contact point named in the e-mails and the unavailable state is
`COMPANY.email`; the Impressum's "Inhalte melden" and the privacy policy (`features/legal/texts.ts`, a draft
not edited here) still describe the e-mail way and need the form, its data, its legal basis and the 180 days;
the wording of the Art. 16/17 texts needs the lawyer; the digest needs a schedule; the migration needs the
go-ahead for the hosted project.
