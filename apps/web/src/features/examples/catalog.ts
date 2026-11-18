import type { Page } from "@linkyo/blocks";

import { CATALOG_A } from "./catalog-a";
import { CATALOG_B } from "./catalog-b";

/** Every example page by its address (the look of each lives in looks.ts). Server only. */
export const EXAMPLES: Record<string, Page> = { ...CATALOG_A, ...CATALOG_B };
