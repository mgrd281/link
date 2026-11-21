import { tokens } from "@linkyo/tokens";
import type { Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/features/app/shell";

/** Safari's bars and the status bar take the dashboard's grey ground, not white (ADR 0062). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: tokens.semantic.canvasMuted.console.light },
    { media: "(prefers-color-scheme: dark)", color: tokens.semantic.canvasMuted.console.dark },
  ],
};

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
