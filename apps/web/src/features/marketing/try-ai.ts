import { RECORDINGS, type RecordingLocale } from "@/features/ai/recordings";
import { aiTryPublic } from "@/lib/flags";

/**
 * Whether the playground's AI tab shows in a language (ADR 0051): only when it is switched on
 * (NEXT_PUBLIC_AI_TRY) and a real recording of the AI exists in that language, so a visitor never
 * watches test data or an unlabelled run. Phase 1 has no recording, so the tab does not show.
 */
export function tryAiTab(locale: string): boolean {
  return aiTryPublic && RECORDINGS[locale as RecordingLocale]?.kind === "real";
}

/**
 * Whether the AI tab can show in any language of this build. Without it the playground never reads
 * the AI run's words, so they stay out of the website's messages (`CLIENT_NAMESPACES.site`).
 */
export const TRY_AI_ANY: boolean = (["de", "en", "ar"] as const).some(tryAiTab);
