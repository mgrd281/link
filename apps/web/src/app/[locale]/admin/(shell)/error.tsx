"use client";

import { ShellError } from "@/features/errors/shell-screens";

/**
 * A screen in the team area failed to render. Only that screen is replaced: the navigation stays, so
 * every other view is still one tap away.
 */
export default function AdminShellError({ retry }: { error: unknown; retry: () => void }) {
  return <ShellError retry={retry} />;
}
