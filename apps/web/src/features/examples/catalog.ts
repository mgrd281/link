import type { Page } from "@linkyo/blocks";

import { CATALOG_A } from "./catalog-a";
import { CATALOG_B } from "./catalog-b";
import { CATALOG_C } from "./catalog-c";
import { CATALOG_D } from "./catalog-d";
import { CATALOG_E } from "./catalog-e";

/** Every example page by its address (the look of each lives in looks.ts). Server only. */
export const EXAMPLES: Record<string, Page> = { ...CATALOG_D, ...CATALOG_E, ...CATALOG_A, ...CATALOG_B, ...CATALOG_C };
