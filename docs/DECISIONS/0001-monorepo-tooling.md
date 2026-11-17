# 0001 — Monorepo tooling

**Context.** One repo for web, iOS, shared tokens/schemas, Supabase. Versions checked 2026-11-17.

**Decision.** pnpm 10 workspaces + catalogs (one version per dependency) + Turborepo 2. Node 22 LTS.
TypeScript **6.0** (not 7.0): typescript-eslint 8.73 supports `<6.1`; TS 7 (native) lacks the JS API that typed linting needs.
ESLint **9.39** (not 10): `eslint-plugin-jsx-a11y` supports ESLint ≤ 9. Conventional commits enforced by commitlint
(lefthook locally, CI on PRs). Internal packages are "just-in-time" TypeScript (transpiled by Next), except
`@linkyo/tokens`, which has a build step for generated outputs.

**Consequences.** Upgrade TS/ESLint together when the lint ecosystem supports TS 7 / ESLint 10 (Renovate PR).
