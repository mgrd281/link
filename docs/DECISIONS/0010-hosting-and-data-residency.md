# 0010 — Hosting and data residency

**Proposal.** Vercel Pro (functions + ISR cache in `fra1`, global CDN; wildcard + custom domains via Domains API) and
Supabase Pro in `eu-central-1`; Scaleway TEM (Paris) for email; Sentry EU; PostHog EU Cloud; Mux for video (no EU
storage pinning — alternatives Cloudflare Stream / Bunny Stream (EU company) priced in COSTS.md §3).
US processors are covered by DPAs + SCCs and named in the privacy policy. All personal data at rest stays in the EU
except Mux video files and provider account metadata.

**Open for founder decision.** Bunny Stream instead of Mux (EU-native, bandwidth-priced) and Cloudflare R2 (EU
jurisdiction) for media once egress grows — see the cost levers in `COSTS.md §5`.
