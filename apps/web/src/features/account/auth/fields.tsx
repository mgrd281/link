"use client";

import { Icon } from "@linkyo/ui";
import { CircleAlert } from "lucide-react";

export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" tabIndex={-1} className="flex items-start gap-2 rounded-md border border-danger-strong bg-danger-subtle p-3 text-small text-fg focus-visible:focus-ring">
      <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0 text-danger-strong" />
      {message}
    </p>
  );
}

/** "or" divider between social sign-in and email. */
export function OrDivider({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-3 text-caption text-fg-tertiary before:flex-1 before:border-t before:border-line after:flex-1 after:border-t after:border-line">{label}</p>
  );
}
