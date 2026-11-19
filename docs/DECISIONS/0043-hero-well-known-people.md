# 0043 — The hero shows well-known people (as labelled concept pages) and a jewellery house

**Context.** After 0042 the founder looked at the deck again and asked for more:
- "foreign people, famous and very beautiful";
- no sneaker page;
- "something 100 % luxurious and 100 % modern".

Linkyo has no well-known customers yet. What exists are the unofficial concept pages of well-known people
(0020), which the founder already chose to list in the template gallery.

**Advice given (unchanged from 0019 and 0020).** Using a well-known person's name or picture to advertise a
product without their consent is unlawful in Germany (KUG § 22, general right of personality). The homepage hero
is advertising in the narrowest sense, so the risk here is higher than in the gallery. The person or their
management can demand removal and a licence fee.

**Decision (founder's, 19 Nov 2026).** The hero deck shows three pages:
- **Taylor Swift** (music), black: concept page.
- **Cristiano Ronaldo** (football), red: concept page. His look changes to the vivid ruby of Portugal's shirt.
- **Lumen Atelier** (jewellery), emerald and gold: our own fictional example. It is rewritten as a fine-jewellery
  house with a gold necklace as its picture, numbered editions and private appointments. It replaces the sneaker
  shop.

**What keeps it honest.**
- **Chip.** The chip above a concept page reads "Konzept · Taylor Swift", never an address. An address would
  suggest she has a page.
- **Picture.** The picture itself shows the page's own "Konzept · name" badge.
- **Note.** A note under the tabs says: "Concept pages are unofficial: this is how a Linkyo page could look. We are
  not affiliated with the people shown."
- **Pages.** The concept pages stay as 0020 defines them:
  - unofficial, never verified and `noindex`;
  - free-licensed, credited photos;
  - facts from checked sources.
- **Languages.** Concept pages exist in three languages, so the deck links to, and shows, the visitor's own
  (`CONCEPT_SHOTS`, six pictures).

**To undo.** Replace the two `concept` entries of `STACK` in `features/marketing/hero.tsx` with example pages
(for instance `lou-ferreira` and `noah-sarkis`). The note disappears by itself.

**Status.** Applied. Tests:
- the chip says "Concept · Taylor Swift" and links to the concept page in the visitor's language;
- the note is shown;
- our own example shows its address;
- the deck's clock, tabs and Arabic mirroring as in 0042.
