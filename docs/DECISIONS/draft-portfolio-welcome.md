# draft — A portfolio-aware welcome flow, and the portfolio kinds' starters

**Status.** Proposed (Stage 2, WP2.2, 2026-11-24). The integrator gives it its number.

**Context.** Portfolio v1 gave Linkyo project blocks, project pages, a contact block and two
wide-canvas templates (Werkbogen and Tiefdruck), but the welcome flow still treated every new account
as a link-in-bio page. A photographer was asked for a website, a booking link and an e-mail address and
ended on an empty page with music copy ("Put the link in your Instagram and TikTok bio"); the
`app.welcome.portfolio.*` messages were written but unused (audit P-03). Designers, developers and
engineers started on 560 px link-in-bio templates (Atelier, Nocturne, Daylight; P-04, decision G2 open).
Smaller gaps in the same screen: the newsletter switch made a block that real accounts never show
(D-07), pill buttons sat inside a card (D-14), the links step's profile fields had no platform glyph
(D-18), the kind grid mixed solid logos at icon-lg with outline icons and showed Streamer as the Twitch
logo (S-02), and the website field rendered an empty hint (E-08).

**Decision.**

1. **Six steps for the portfolio kinds.** `PORTFOLIO_KINDS` (designer, photographer, developer,
   engineer, freelancer) go through Typ · Du · Look · Arbeit · Kontakt · Fertig; every other kind keeps
   the five steps with links (`welcomeSteps(kind)` in `features/app/kinds.ts`). Their starters ask
   `proof` and `action` instead of `website`, `booking` and `email`; developers and engineers keep `cv`.
   - **Arbeit:** three pieces of work, each a title and one sentence; designers and photographers may
     add a cover (prepared by `images.ts` as in the editor, with its description field). Every piece is
     optional; a started one needs its title and its sentence (`proofProblem`), and "Weiter" says so
     at the field instead of dropping what was typed.
   - **Kontakt:** the reach field of the editor (`reach-input.tsx`, unchanged): the way, the address
     built by code, the button's words with presets in the page's language. Then the profiles (now with
     their platform glyph), the CV for developers and engineers, and the optional links field. The
     Linktree import box stays in the link-in-bio flow only: a portfolio starts from its work.
   - **The page it makes** (`starterBlocks`): profiles on top, the kind's work title
     (`titleKeys(kind).work`: "Arbeiten", "Projekte") over the projects (addresses from `slugFor`, never
     one the page already uses; Arabic titles get "projekt-n"/"project-n"), pasted links after them
     (repository links stay repository cards), and the contact block last (`app.portfolio.contact.closing`,
     its button from the reach field; a CV joins its other ways). A page that already has a contact
     block keeps it as the only one. Nothing is made from an empty answer: no title over no work.
   - **Fertig** speaks of a portfolio ("Setz den Link in deine E-Mail-Signatur und auf LinkedIn") and
     lists exactly what was made ("3 Projekte", the button's words), counted from the blocks.
2. **Starters (lead decision G2, reversible).** Designers, photographers and freelancers start on
   Werkbogen; developers and engineers on Tiefdruck. Only `STARTERS` changes: existing pages keep their
   look, and anyone can pick another one on the next step or later in Design. To undo, set the three
   `theme` values back (designer `atelier`/editorial, developer `nocturne`/tech/outline, engineer
   `daylight`/tech) and update `kinds.test.ts`. v8's default without a founder answer was the opposite
   (designer and developer keep Atelier and Nocturne); the founder may override this at any time.
3. **The look step leads with the kind.** The picker gets `order = lookOrder(kind)`: the starter, then
   the templates whose tokens name the kind in `suggestFor`, then every other look. A template added
   in Stage 3 that names a kind appears there without code.
4. **Small fixes in the same screen.** Real accounts are not asked for a newsletter (`starterFields`,
   the same rule as the Add sheet), and no newsletter block is made for them. Pills only in the flow's
   footer: the done step's two buttons moved into it; buttons in the card stay rounded. Platform kinds
   show their logo at icon-md, outline kinds their icon at icon-lg, both in the same 40 px tile;
   Streamer is a gamepad. A field whose hint is empty renders no hint. With six steps on a phone the
   filled bar marks a done step (the check mark returns from `sm`), so every label stays whole.

**Consequences.**

- A designer or photographer who signs up types nine fields (name, three titles, three sentences, one
  address and, if they like, the button's words) and gets a filled portfolio: three projects, a contact
  button, the right template.
- Real mode needs no database change: the flow writes the page through the same table update as every
  edit (proved against the Supabase stand-in, `E2E_STUB=1`, in `e2e/portfolio-welcome-app.spec.ts`).
- The editor's empty state for portfolio kinds ("Füg dein erstes Projekt hinzu") belongs to WP2.4
  (`editor-screen.tsx`); the `linkyo-page-kind` skill should name the two steps (open issue for the
  integrator; this work package does not own the skill).
- Freelancers keep the Laptop glyph in the kind grid: BriefcaseBusiness is already "Arbeit & Business",
  and two tiles with one glyph would read as one kind.
