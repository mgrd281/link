# @linkyo/api-client

Typed API client shared by web (TypeScript) and iOS (Swift).

- **Source of truth:** `openapi.yaml` (added in Phase 1 with the first Edge Functions).
- **TypeScript:** generated with `openapi-typescript`; a small fetch wrapper adds auth (Supabase JWT), retries and typed errors.
- **Swift:** generated with Apple's `swift-openapi-generator` into `apps/ios/Packages/LinkyoAPI`.
- Block payloads reuse `@linkyo/blocks` Zod schemas (exported to JSON Schema for the OpenAPI spec), so editor, renderer, API and iOS validate the same shapes.
