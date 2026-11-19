# 0039 — Sign-up like the pages people know: the logo, one field, one button

**Context.** The founder put our sign-up page next to a competitor's and asked for the same calm page. Ours had more
on it:
- a language switch and a light/dark switch at the top ("only on the homepage");
- two framed fields with labels and a rules line (address and email);
- an arrow button labelled "Weiter".

**Decision.**

- **The frame.** Only the logo at the top. Language and light/dark live on the homepage; the language comes along in
  the address (`/de/signup`, `/en/signup`, `/ar/signup`). The form column is wider (560 px) and the heading larger
  (`display-sm` from tablets).
- **One field.**
  - Sign-up asks for the email only: a soft teal-50 field without a frame (TextField `variant="filled"`), with the
    label for screen readers and "E-Mail" as the visible placeholder.
  - Then a full-width "Registrieren" button, the terms line, "ODER", "Weiter mit Google", and "Schon ein Konto?
    Anmelden".
  - Sign-in looks the same.
  - Everything is our own wording and our own brand (Linkyo Teal, our example pages on the right).
- **The page address moves out of the way.**
  - Claimed on the homepage (`?name=`): it comes along as one quiet line ("linkyo.app/mila-aurel ist frei · Ändern").
    "Ändern" opens the field. A taken or reserved name opens it with the reason.
  - Prepared pages (invite): the line says "reserved for you", without "Ändern".
  - Nothing claimed: the account gets a neutral address (`page-` + 6 random characters, never taken from the email,
    which stays private). In the welcome flow's "Who's behind the page?" step, the address field fills itself from
    the name as it is typed ("Mila Aurel" → `mila-aurel`), with the live availability check. Changing it there saves
    it (`changeUsername`). Skipping keeps the neutral address, which can be changed in Settings.
- **The 6-digit code** keeps its boxes at the earlier width.

**Status.** Applied. Tests:
- sign-up with only the email, then the address from the name in the welcome flow, with no language switch on the
  page;
- the claimed address line;
- a reserved name opens the field;
- the invite line;
- every earlier sign-up, code, admin and template flow, updated to the one-field form.
