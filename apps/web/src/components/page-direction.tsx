"use client";

import { Direction } from "radix-ui";
import type { ReactNode } from "react";

/**
 * Radix components (toggle groups, menus, tooltips) follow the page's direction: in Arabic the first
 * option sits on the right and the arrow keys move right to left. The root layout's only provider:
 * tooltips and toasts are provided where they are used (`./providers.tsx`), so pages without them,
 * the example creator pages above all, load neither (ADR 0008).
 */
export function PageDirection({ dir, children }: { dir: "ltr" | "rtl"; children: ReactNode }) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
