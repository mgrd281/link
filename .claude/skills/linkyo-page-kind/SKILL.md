---
name: linkyo-page-kind
description: Add or change a page kind in Linkyo's welcome flow ("What describes you best?"), with its starter template, first social profiles and tailored questions. Use when asked to support a new type of user (e.g. affiliate, online retailer, developer, coach) or to change what new users are asked.
---

# Linkyo page kinds (welcome flow)

The first welcome step asks which kind of page someone is making. The kind picks a starter template,
the first social profiles, and a few questions that turn into blocks. See ADR 0018 and 0021.

## Files

| What | Where |
|---|---|
| Kinds, order, starters, questions | `features/app/kinds.ts`: `KINDS`, `STARTERS`, `StarterField`, `SOCIAL_PREFIX`, `starterBlocks()` |
| Icons | `features/app/welcome-screen.tsx`, `KIND_ICONS` (lucide) or a platform glyph |
| Text fields vs switches | `TEXT_FIELDS` in `welcome-screen.tsx` (anything not listed there is a switch) |
| Texts | `src/messages/{de,en,ar}.json`: `app.welcome.kinds.<kind>.{label,description,name,taglineHint,links,linksHint,extras}`, `app.welcome.fields.<field>.{label,hint}`, `app.welcome.platforms.<platform>` |
| Gallery "Use this template" | `?kind=<kind>&look=<id>` is read by `features/account/auth/signup-form.tsx` |
| Steps per kind | `welcomeSteps(kind)` in `kinds.ts`: `PORTFOLIO_KINDS` (designer, photographer, developer, engineer, freelancer) get kind, you, look, proof, action, done; every other kind gets kind, you, look, links, done |
| Portfolio steps | `features/app/welcome-portfolio.tsx` (the work rows, the done list); the contact step is `reach-input.tsx` inside `welcome-screen.tsx` |
| Tests | `features/app/kinds.test.ts`, `e2e/app.spec.ts`, `e2e/portfolio-welcome-app.spec.ts` |

## Steps

1. Add the kind to `KINDS`. Order matters: creators first, then online business, local business and
   careers.
2. Add its `STARTERS` entry:
   - `theme` (template, pairing, button style or shape);
   - `socials` (handles asked for, most important first; add a `SOCIAL_PREFIX` if missing);
   - `fields` (questions);
   - `logoFirst`.
3. For a new question, extend `StarterField`, handle it in `starterBlocks()`, and give generated links
   an `icon` (`map`, `shop`, `calendar`, `globe`, `book`, `file` …).
4. Write the texts in all three languages. Arabic should be natural, not word-for-word.
5. Add an icon in `KIND_ICONS`.
6. Add a unit test showing that the starter's blocks are valid (`blockSchema.safeParse`).
7. A portfolio kind: add it to `PORTFOLIO_KINDS`. Its fields are `["proof", "action"]` (plus `cv` for
   developers and engineers): the proof rows become projects under `titleKeys(kind).work`, the action
   becomes the contact block, last. The look step leads with `lookOrder(kind)` (the starter, then
   `suggestedTemplates(kind)`: the templates whose tokens name the kind in `leadFor` first, then those
   naming it in `suggestFor`, in token order). Today the look step starts with: photographer →
   Werkbogen, Leuchttisch, Folio …; developer → Tiefdruck, Logbuch, Signal …; engineer → Tiefdruck,
   Logbuch …; designer lists Grundriss after Werkbogen, Atelier, Folio and Tiefdruck (`kinds.test.ts`
   pins these). There is no architect kind: architects choose `designer`.
8. A new kind that should see a portfolio template: name the kind in that template's `suggestFor` (and
   `leadFor` if it should come first) in `tokens.json`, regenerate the tokens, and update the expected
   orders in `kinds.test.ts`. A gallery example person for the kind lives in the `portfolio` category
   (see linkyo-portfolio).

## Rules

- Affiliate links must be labelled. Only kinds with the `affiliate` field may set `affiliate: true`
  on pasted links.
- Every question is optional, and the flow can be skipped.
- `starterFields(kind, { newsletter: accountStore.demo })`: real accounts are never asked for a newsletter.
- The step that makes the page marks the account welcomed (`onboarded`), so a second run cannot add a
  second set of blocks. Nothing typed is dropped quietly: a started row or an address without its
  button's words is pointed out at its field.

## Check

```bash
cd apps/web && npx vitest run src/features/app && npx eslint src && npx tsc --noEmit -p .
```
