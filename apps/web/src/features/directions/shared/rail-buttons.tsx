import { Icon } from "@linkyo/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RailButtonsIsland } from "./rail-buttons-island";

export { cardStep, railEdges } from "./rail-math";

/**
 * Back and on for a row of project cards (P-02): the island (`./rail-buttons-island.tsx`) with its
 * chevrons drawn here, on the server for a public page, so the visitor's browser loads no icon kit
 * for them (ADR 0008). `Icon` mirrors the chevrons in Arabic; never add `rtl:-scale-x-100`.
 */
export function RailButtons() {
  return <RailButtonsIsland back={<Icon icon={ChevronLeft} size="md" />} on={<Icon icon={ChevronRight} size="md" />} />;
}
