/**
 * @linkyo/api-client — typed client for web and iOS.
 *
 * Phase 1 generates this from `openapi.yaml` (Supabase Edge Functions + PostgREST views):
 *   - TypeScript: openapi-typescript → `src/generated/schema.ts` + a thin fetch wrapper
 *   - Swift: swift-openapi-generator → `apps/ios/Packages/LinkyoAPI`
 * Until then it only exports the shared API version so both platforms pin the same contract.
 */
export const API_VERSION = "v1" as const;
export type ApiVersion = typeof API_VERSION;
