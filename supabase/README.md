# Supabase (EU · Frankfurt)

Created in Phase 1. This folder will hold:

- `config.toml` — local stack config (`supabase init`), project ref in `eu-central-1`.
- `migrations/` — SQL migrations. Every table ships with Row-Level Security **in the same migration**, plus a pgTAP test in `tests/`.
- `functions/` — Edge Functions (Deno): link metadata fetch (smart detect), feed refresh (YouTube RSS, Twitch, RSS), image variants on upload, Stripe/StoreKit webhooks.
- `seed.sql` — the Phase 0 sample creators for local development.

See `docs/ARCHITECTURE.md` §4 for the data model and RLS rules.
