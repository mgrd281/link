import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NOINDEX } from "@/lib/seo";

/** Design directions are prototypes, not for search. */
export const metadata: Metadata = { robots: NOINDEX };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
