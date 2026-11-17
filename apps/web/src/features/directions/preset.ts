import { creatorTokens, type CreatorPresetId } from "@linkyo/tokens";

export const isCreatorPreset = (value: string | undefined): value is CreatorPresetId => !!value && value in creatorTokens.presets;
