import type { ReactNode } from "react";

import { AdminShell } from "@/features/admin/shell";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
