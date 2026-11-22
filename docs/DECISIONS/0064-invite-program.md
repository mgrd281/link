# 0064 — Invite program: a personal link, counted friends, rewards that are never revenue

**Status.** Accepted (v6, WP2: backend and sign-up; the Invite screen and the team console follow in
WP3 and WP4 on this contract).

**Context.** The founder asked for an invite program: every creator gets a personal link; friends
who join through it count; a few counted friends unlock a free verification review, more give
"Pro for life". It has to resist farming (ten fake mailboxes must not buy Pro for life), must not
cheat real friends, must keep creator pages free of cookies and third-party requests, and must never
let a reward look like revenue.

Two facts shaped it:
- **"invite" was taken.** `?invite=`, `SignUpInput.invite`, `user_metadata.invite`, the
  `invites.manage` permission and `admin.creator.invites` all mean the team's *prepared-page*
  invite ([ADR 0015](0015-prepared-pages.md)). The program is therefore called **referral** in code,
  data and URLs (`?ref=`, `public.referrals`, `features/referrals/*`). "Einladen", "Invite" and
  "دعوة" appear in copy only.
- **Pro doesn't exist yet** (`marketing.pricing.pro.badge = "Coming soon"`), so "Pro for life" is a
  promise kept in a separate table until Pro launches.

**Decision.**

### 1. Rules (one place for the numbers)

`apps/web/src/features/referrals/rules.ts`:

| Rule | Value |
|---|---|
| Counted invites for a free verification review | `REFERRAL_RULES.verificationAt` = 3 |
| Counted invites for Pro for life | `REFERRAL_RULES.proForLifeAt` = 10 |
| Held for the team: this many sign-ups of one inviter from one network … | `clusterSize` = 3 |
| … within | `clusterDays` = 7 |
| Ask for a review again after a decline | `retryVerificationDays` = 7 |

SQL `public.referral_rule(name)` mirrors them; `rules.test.ts` reads the migration and fails on any
difference (also on the code alphabet, the code pattern and the Gmail rule of `email_identity`).
Messages never type a threshold; they take it as a parameter.

**Codes.** 8 symbols from a 31-letter alphabet without 0, 1, i, l and o (31^8 ≈ 8.5 × 10^11). The
database makes the code (`profiles.referral_code`, default `new_referral_code()`, unique, not
null); the customer can read it and can never choose or change it (the column grant stays
`update (locale)`). It is not the username: renaming keeps old links working, and whoever takes a
freed username inherits nothing.

**The link.** `/i/<code>`: next-intl adds the visitor's language, then
`app/[locale]/i/[code]/page.tsx` answers 307 to `/<locale>/signup?ref=<code>` (`/<locale>/signup`
for a malformed code). No cookie, no storage, no lookup there. The host is `NEXT_PUBLIC_SITE_URL`
or the serving origin, so links work on today's deployment and switch with one variable.

**Sign-up.** The sign-up keeps exactly one field ([ADR 0039](0039-signup-one-field.md)). For a
known code it shows one quiet line, "Invited by <name>" (the inviter's page name, only once their
page is set up) or "You were invited to Linkyo", and under the terms what the inviter will see
("your page name, never your email"). An unknown code shows nothing. Any well-formed code is sent,
even while the lookup is on its way or after it failed (otherwise a quick tap on a slow phone lost
the attribution for good); the database ignores a code nobody has.
`/api/auth/code` drops a malformed `ref` silently and puts the code in the user metadata and in the
emailed link (`/api/auth/confirm?…&ref=<code>`); `handle_new_user` (replaced in this migration
with its body unchanged plus one block) writes a `pending` referral for a **new** account only, so
existing accounts are never attributed and nothing can attach an inviter later. One inviter per
account (`referrals.invitee_id` is unique).

**The confirming browser must carry the same code.** The metadata comes from whoever first asked
for a sign-up code for an address, not necessarily its owner, and GoTrue keeps it when the owner
asks later. So an invite settles only when the browser that confirms the mailbox shows the pending
row's code: the code step sends `signUp.ref` to `/api/auth/verify`, the emailed link carries `ref`
to `/api/auth/confirm`, and `settle_referral(invitee, ref)` compares it with the inviter's code. A
missing or different code drops the pending row (no error, the sign-in goes on). The prepared-page
`?invite=` flow is not affected.

### 2. States and checks

| Stored state | The inviter sees | When |
|---|---|---|
| `pending` | Not confirmed | signed up through the link, code not entered yet |
| `qualified` | Counts | email confirmed and the checks passed (shown as "Doesn't count" while the invited account is suspended) |
| `held` | Being checked | email confirmed, but a signal needs a person on the team |
| `rejected` | Doesn't count | an automatic check failed |
| `revoked` | Doesn't count | removed by the team (audited) |

**Counted** = `qualified`, and the invited account is active or was deleted after it counted.

The checks run on the server in `public.settle_referral()`, right after the invited person's first
sign-in has been logged: `/api/auth/verify` and `/api/auth/confirm` (not for an email change) call
`settleReferral()` after `recordSignIn`, with the browser's code (§1). It never throws and never
fails a sign-in. The hourly `linkyo-settle-referrals` job applies the same rule to anything the
routes missed: a row still pending 15 minutes after the email was confirmed was confirmed without
the code reaching our server, so it is dropped. The inviter never learns which check fired.

| Check | Outcome |
|---|---|
| Same mailbox (`email_identity`: lower case, `+tag` dropped, Gmail dots dropped) | `rejected` / `self` |
| The same mailbox already has a referral of this inviter, also one whose account was deleted since (`mailbox_hash`) | `rejected` / `repeat` |
| The invitee's first device id (`linkyo.device`) appears in the inviter's sign-ins (not `dev_unknown`, not `dev_email_link`) | `rejected` / `sameDevice` |
| Throwaway domain or a subdomain of one (`disposable_domains`, 48 seeded) | `rejected` / `disposable` |
| Invitee suspended | `rejected` / `inviteeSuspended` |
| No sign-in log (confirmed around our routes, e.g. GoTrue with the publishable key) | `held` / `noSignals` |
| Same network (IPv4 equal, IPv6 same /64) **and** same browser signature | `held` / `sameNetwork` |
| The 3rd or later settled invite of one inviter from one network within 7 days (`network` of the earlier rows) | `held` / `cluster` |

The same network **alone never holds** (shared flats, offices, mobile carriers), and a hold is not a
rejection. Loopback (no IP known, local development) is never compared. The team sees yes/no
`signals`, never an IP or device id. Two values stay on the row so that deleting an invited account
does not reset the checks (its sign-ins are deleted with it):
- `mailbox_hash`: sha256 hex of `email_identity(email)`, never the address. Kept as long as the row,
  so one mailbox counts once per inviter, however often its account is deleted and made again.
- `network`: the opening sign-in's IPv4 address or IPv6 /64 (as `sign_ins` keeps the IP), for the
  cluster check. The hourly job clears it once the invite was settled more than `cluster_days` (7)
  ago, the only window the check reads.

### 3. Rewards

| Counted | Reward | How it is given |
|---|---|---|
| 3 | `verification_review` | automatic; unlocks "Request review" (1–3 official profile links, a note). A person on the team approves (sets `profiles.verified`, which `sites_guard` copies into the page, as `admin_set_verified` does) or declines with a reason. One open request at a time; after a decline, again after 7 days. |
| 10 | `pro_for_life` | automatic; a row in `public.rewards` |

Rewards are permanent: if the count drops later (a removal, a suspension), they stay unless the
team removes one (audited). A removed reward is never given again automatically. A suspended
inviter gets nothing until active again; the hourly job then gives what is due. The team can give
either reward by hand (`source = 'team'`).

### 4. Pro for life is never revenue

Pro for life is a `rewards` row. Nothing in the program writes `public.subscriptions` or
`public.invoices`, and revenue (`monthlyRevenue`, `isPaying`, `kpis().mrr`, `mrrByMonth`,
`funnel().paid`) reads only `subscriptions`. pgTAP checks that the 10th counted invite leaves the
inviter with **no** subscription row and on the free plan in `admin_customers()`; the console's
revenue unit test (WP4) pins the same in TypeScript. When Pro launches, billing must use one
entitlement check (`hasPro()`, WP4) and must never create a subscription for reward holders.
`PRO_AVAILABLE` (false) flips the wording from "yours the day it launches" to "active".

### 5. Who may do what

No new permission; `role_permissions` is unchanged.

| Action | Permission |
|---|---|
| Read the queue or a customer's Invites tab | `customers.view` |
| Count / remove / restore an invite; give or remove the verification review | `customers.manage` |
| Give or remove Pro for life | `billing.manage` |
| Approve or decline a verification request | `creators.verify` (nobody reviews their own request: `linkyo:notYourself`; the demo's `teamReview` refuses the signed-in account's own request too) |

Audit actions: `referral.release`, `referral.revoke`, `referral.restore`, `reward.verification`,
`reward.pro` (actor "system"), `reward.revoke`, `reward.restore`, `verification.request` (actor:
the customer), `verification.approve`, `verification.decline`.

Customers read the program only through functions (`my_referrals`, `my_verification_requests`,
`referral_inviter`, `request_verification`); `referrals` and `verification_requests` have no
policies and no grants for `anon` or `authenticated`. Visitors may call `referral_inviter` only.
`rewards` keeps its owner policy, but customers may select only `profile_id, kind, source,
granted_at, revoked_at`: who removed a reward (`revoked_by`) and the team's reason
(`revoke_reason`) are read through `admin_customer_referrals` only.

### 6. Demo mode

Every demo account lives in one browser, so a demo invite works only by signing out, opening the
link in the same browser and making a second account. Entering the on-screen code is the demo's
email confirmation, so the invite is settled at once: it counts, or it is a self-invite or a
repeat (`emailIdentity`; the demo keeps the mailbox on the invite, also after the invited account
is deleted). The device and network checks can't apply. `LocalAccountStore` keeps codes,
referrals, rewards and verification requests next to the accounts and offers the team methods the
demo console uses (`teamQueue`, `teamCustomer`, `teamReview`, `teamSetReferral`, `teamSetReward`).
The Invite screen's `demoNote` says all this.

### 7. An invited account deleted after it counted still counts

Before it counted, deleting the invited account deletes the referral. After it counted, the row
stays with `invitee_id = null`, shown as "Deleted account" without a name: the inviter did the
work, rewards are one-off, deleting a fake changes nothing for a farmer, and what remains no longer
identifies anyone, except as a hash of the mailbox that keeps the same mailbox from counting twice
for this inviter (§2). A **suspended** invited account was not counting, so deleting it deletes its
referral too (`referrals_forget`); otherwise deleting a fake the team had suspended would make it
count again and could trigger a reward. Deleting the inviter deletes their referrals, rewards and
requests.

### 8. Privacy (GDPR)

- The invitee is told at sign-up what the inviter will see. The inviter sees page names and
  states, never an email. The checks store yes/no signals, a sha256 hash of the normalised mailbox
  (for as long as the referral exists) and the opening sign-in's network (IPv4 address or IPv6 /64,
  cleared after 7 days by the hourly job). No device ids or fingerprints. Neither value is shown to
  the inviter or the team, and neither is in the export (they are abuse-prevention data about
  the invited account, not the inviter's).
- The data export (Art. 15/20) contains the program: own code, counts, rewards, all own
  verification requests (`my_verification_requests`), who invited the account, and the invited
  people as `{ status, at }` **without names** (other people's data).
- Nothing is stored in the visitor's browser before sign-up (§ 25 TDDDG not engaged). Creator
  pages are untouched: no cookie, no third-party request.

**For the privacy-policy author** (the policy is on the launch checklist,
[ADR 0028](0028-admin-console.md)), a new section "Einladungsprogramm / Invite program" must say:

1. **Purpose:** attributing a new account to the person whose link it used, counting invites,
   giving rewards, reviewing verification requests, preventing abuse.
2. **Data:** the inviter's code; the link between inviter and invited account, its state and dates;
   the invited account's page name (shown to the inviter) and the inviter's page name (shown to the
   invited person); rewards; verification requests (up to 3 profile links and a note).
3. **Abuse checks (automated):** at the first sign-in, data from the existing 30-day security log is
   compared between inviter and invited account (IP address or network, the random device id, the
   browser signature), and the email addresses (normalised mailbox, throwaway domain list). The
   result is stored as yes/no flags; in addition, a hash of the normalised mailbox (so one mailbox
   counts once per inviter) and the network of the first sign-in (IP address or IPv6 /64, deleted
   after 7 days).
4. **No solely automated decision with legal or similarly significant effect (Art. 22):** the check
   only decides whether an invite counts towards a voluntary reward; doubtful cases are reviewed by
   a person; anyone can ask for a human review of any decision.
5. **Legal bases:** inviter Art. 6(1)(b) (the program terms); invited person Art. 6(1)(f)
   (crediting the person whose link they followed, preventing abuse; informed on the sign-up page);
   verification Art. 6(1)(b), at the creator's request.
6. **No cookies, no device storage before sign-up:** the code is part of the address.
7. **Recipients:** the inviter sees only page names and states; the Linkyo team sees more for review,
   including the yes/no flags; processors as for accounts (Supabase in Frankfurt, Vercel).
8. **Retention:** referral records exist while the inviter's account exists; an invited account
   deleted after it counted leaves a count with only the mailbox hash, one that never counted (or
   was suspended) leaves nothing; the stored network is deleted 7 days after the invite was
   settled; sign-in data stays at 30 days; verification requests go with the account.
9. **Rights:** the export as above; erasure by deleting the account.

Draft paragraph (de), from the design, without the page credit that is not built:

> **Einladungsprogramm.** Lädst du andere über deinen persönlichen Link ein, verknüpfen wir das neue
> Konto mit deinem, zählen bestätigte Anmeldungen und vergeben Belohnungen (Art. 6 Abs. 1 lit. b
> DSGVO). Wer eingeladen wurde, sieht beim Registrieren den Seitennamen der einladenden Person; diese
> sieht den Seitennamen und den Stand, nie die E-Mail-Adresse (Art. 6 Abs. 1 lit. f DSGVO).
>
> Um Missbrauch zu verhindern, vergleichen wir bei der ersten Anmeldung automatisch Daten aus dem
> 30-Tage-Sicherheitsprotokoll (IP-Adresse, Geräte-ID, Browser-Signatur) und die E-Mail-Adresse
> beider Konten. Gespeichert werden das Ergebnis als Ja/Nein-Merkmal, ein Hashwert des Postfachs
> (damit ein Postfach pro einladender Person nur einmal zählt) und für 7 Tage das Netz der ersten
> Anmeldung (IP-Adresse bzw. IPv6-Präfix). Zweifelsfälle prüft ein
> Mensch; jede Entscheidung kannst du von uns überprüfen lassen. Der Code steht nur in der Adresse;
> vor der Registrierung speichern wir nichts auf deinem Gerät.
>
> Die Daten bestehen, solange das einladende Konto besteht. Wird ein eingeladenes Konto gelöscht,
> entfernen wir die Verknüpfung zur Person; es bleiben ein Zähler und der Hashwert des Postfachs.
> Anfragen zur Verifizierung
> (Profil-Links, Notiz) löschen wir mit dem Konto.

The English version is the same text translated; `/ar` follows the policy's general Arabic version.
The program terms shown in the app (`app.invite.terms.*`) are drafts for legal review before launch.

### 9. What is deliberately not built

- **The "Made with Linkyo" credit carrying the code, and its switch.** No real creator page is
  public yet (`public_page()` is unused; `/p/*` is examples only), so only the creator would see
  it. It returns with public pages and then needs a `referral_credit` column, a `creditHref`
  through the four renderers and `public_page().ref`.
- **The FAQ block** (it repeats the rules, the sheet lead and the terms), **"New" badges** on
  milestones, **a Rewards pane** in the console.
- **A "Start review" / `in_review` claim step.** The team is small; add it if two reviewers collide.
- **Replacing `admin_customers()` or `public_page()`.** Avoided as drift risk; the console reads
  rewards from `admin_referral_queue()`.
- **An invite story picture, a two-sided reward, emails on new invites, leaderboards and cash
  payouts:** no mail pipeline beyond auth, no Pro yet, and privacy, tax and legal weight.
- **Carrying `ref` past the sign-up page.** A visitor who wanders off loses the attribution; that is
  the price of storing nothing before sign-up. A later option is carrying `ref` through the
  marketing calls to action in the URL.

**Consequences.**
- New: `supabase/migrations/20261121120000_referrals.sql` (tables `referrals`, `rewards`,
  `verification_requests`, `disposable_domains`; `profiles.referral_code`; the functions above;
  the hourly job) and `supabase/tests/referrals.test.sql`.
- `handle_new_user` is replaced in a new migration; the existing `access.test.sql` sign-up
  assertions and the new pgTAP sign-up cases catch drift.
- Both account stores implement `referrals()`, `requestVerification()` and `referralInviter()`;
  `features/referrals/team.ts` gives the console `useReferralQueue`, `useCustomerReferrals` and
  `referralTeam` for real accounts and the demo.

## Measured

Filled in by the WP2 build (local stack, Chromium); the integration fills in screenshots and the
full suites.

| What | Result |
|---|---|
| pgTAP (`pnpm db:reset && pnpm db:test`) | 243 assertions pass: `access.test.sql` 76 (unchanged, so `handle_new_user` kept its behaviour), `referrals.test.sql` 167 |
| `pnpm db:lint` (plpgsql_check, level warning) | 0 issues |
| `pnpm db:types` twice | no diff on the second run |
| Unit tests (`pnpm test --force`) | web 194 in 30 files (the rules test 9, 3 of them the SQL mirror; the demo store 21, 10 of them the program), tokens 52, config 79, blocks 41; all pass |
| `GET /en/i/abcdefgh` | 307, `Location: /en/signup?ref=abcdefgh`, no `Set-Cookie`; `/en/i/short` → `/en/signup`; `/i/abcdefgh` with `Accept-Language: ar` → `/ar/i/abcdefgh`, no `Set-Cookie` |
| Sign-up with a known code | one textbox; the invited line 48 px tall (at 393 × 852 at y 243); no horizontal scroll at 393 and 1244 px in de, en and ar, light and dark; axe 0 violations in en and ar, light and dark |
| Demo e2e | `referral-signup.spec.ts` 9 of 9; with `app.spec.ts` and `admin.spec.ts` on desktop and phone, 95 passed, 2 skipped by design (a phone-only and a desktop-only test) |
| Real-account e2e (`E2E_SUPABASE=1`, local stack) | 12 of 12: the 11 existing tests and the new one (a friend in a second browser counts, `my_referrals()` for the inviter says 1, the owner removes it with `admin_set_referral`, the count drops to 0 and the log has `referral.revoke`) |
| **Review fixes** (repeat mailbox, network on the row, suspended-then-deleted, rewards column grant, ref must match, ref sent before the lookup answers, own review in the demo, unbiased SQL codes): pgTAP | 278 assertions pass: `access.test.sql` 76, `referrals.test.sql` 202 (35 new: 2,000 codes on the alphabet and all 31 symbols drawn; a pending row confirmed without or with another code is dropped, the hourly job drops what no browser confirmed; a repeat mailbox after deletion is `rejected` / `repeat` and counts for another inviter; the cluster still holds after the first two invitees were deleted; IPv6 kept as /64, IPv4 as the address, cleared after 7 days; a suspended then deleted invitee doesn't count and gives no reward; a customer cannot select `revoke_reason`, `revoked_by` or `*` from `rewards`). One assertion changed meaning: the hourly job now drops a pending row the routes missed instead of settling it. The visitor's `rewards` read now fails with 42501 instead of returning no rows |
| Review fixes: `db:lint`, `db:types` | 0 issues; no diff on the second run |
| Review fixes: unit (`pnpm test --force`) | web 210 in 32 files (the demo store 23, 2 new: repeat and own review; the rules test 9, its SQL mirror also checks the redraw at 248), tokens 52, config 79, blocks 41 |
| Review fixes: real-account e2e | 13 of 13: the invite test now goes through the UI (the inviter's `/de/app/invite` shows "Zählt", the owner removes it in the customer's Invites tab, the inviter's screen shows "Zählt nicht"), plus a new one (a sign-up code someone else asked for with their code: the owner signs in from the sign-in page and the pending invite is gone). By hand: the emailed sign-up link carries `&ref=<code>` and settles the invite through `/api/auth/confirm` (`qualified`, `emailLink: true`) |
| Review fixes: demo e2e | `referral-signup`, `invite-app`, `admin`, `app` on desktop and phone: 124 passed, 2 skipped by design, 0 failed |
| `/api/auth/verify`, median of 10 local runs, without → with the settle call | first sign-in of an invited account: 45 ms → 65 ms and 70 ms (two runs), +20 to +25 ms; sign-in of an account nobody invited: 29 ms → 39 ms and 50 ms, +10 to +21 ms. Below the 50 ms budget |
