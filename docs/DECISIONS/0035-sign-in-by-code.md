# 0035 — Sign-in by email code, a new sign-up screen, and moving over from Linktree & co.

**Context.** The founder shared the sign-up flow of another link-in-bio product (screenshots and a recording):
- email only, then a 6-digit code (with a one-click link in the email);
- the page name, then the profiles, plus a field to switch over from Linktree;
- beside the form, a tilted wall of example pages that slowly drifts.

We take the pattern, with our own design, words and pictures.

**Decision.**

1. **No passwords.** Signing up and signing in both send a 6-digit code by email, valid 10 minutes, together
   with a one-click link.
   - **Sign-up asks for two things:** the page address (already filled in from the homepage) and the
     email. The code comes next, and a correct code lands in the welcome flow.
   - **Sign-in asks for the email**, then the code.
   - **Same answer for unknown addresses.** Sign-in says the same whether or not the address has an
     account, and no email goes to an address without one (no account enumeration).
   - **Wrong codes are logged** in the security log, and 8 failures in 15 minutes make the address
     wait. Five wrong tries end a code in the demo; Supabase limits verification attempts per IP.
   - **Resend and change email.** A new code can be sent after 30 seconds, and only the newest code
     works. "Use a different email" goes back with what was typed.
   - **Old links still work.** `/forgot` and `/reset-password` lead to sign-in. Settings now say
     there is no password to remember or leak.
2. **Real accounts (Supabase).**
   - `/api/auth/code` checks a sign-up (blocked address, name, prepared page), then calls
     `signInWithOtp`. New accounts carry `{ username, locale, invite, start }` as metadata, which
     the existing `handle_new_user` trigger checks.
   - `/api/auth/verify` checks the code, refuses suspended accounts, makes the first page
     (`ensureFirstSite`: the prepared page or a starter) and writes the security log.
   - The emailed link (`/api/auth/confirm`) does the same.
   - The emails (`confirmation.html` for new accounts, `magic_link.html` for returning ones) show
     the code large, with the code in the subject.
   - No schema change.
3. **Demo (no Supabase).** The same flow; no email is sent, so the code is shown on screen.
4. **The screen.**
   - The form sits on white with a large heading and a light teal field fill.
   - On wide screens the other half is a tilted wall of our 14 example pages in six columns,
     drifting in opposite directions. Hover or the pause button stops it (WCAG 2.2.2), it stays
     still with reduced motion, and it is mirrored in Arabic.
   - The code is one real input (`autocomplete="one-time-code"`, paste and phone suggestions
     work) drawn as six boxes. It submits by itself at six digits; digits stay left to right in
     Arabic.
   - Google sign-in stays visible as "at launch". Apple waits for the app.
5. **Moving over from Linktree & co.** The welcome flow's links step has one field for the
   current page.
   - `/api/import-links` fetches only listed link-in-bio services (Linktree, Beacons, bio.link,
     lnk.bio, solo.to, Carrd, …), also after redirects. It reads their page data or anchors and
     stores nothing.
   - Found profiles fill the profile fields, never over what was typed. Everything else is added
     to the links field, where it is checked before the page is made.

**Consequences.**
- **Custom SMTP is required before launch.** Every sign-in now sends an email, so the
  built-in Supabase mailer (a few emails per hour) is not enough (docs/SETUP_ACCOUNTS.md row 5).
- **Hosted settings to set:** OTP length 6, expiry 600 s, 30 s between emails, and both templates
  (docs/SUPABASE_SETUP.md).

**Status.** Applied.
- Unit tests: demo store codes; import parsing.
- E2E (demo): code step, wrong code, other email, sign back in, old links, unknown email, import
  field.
- Real accounts against local Supabase, codes read from Mailpit: sign-up, wrong code logged,
  one-click link, no email for unknown addresses, suspended and blocked, deletion, team console.
