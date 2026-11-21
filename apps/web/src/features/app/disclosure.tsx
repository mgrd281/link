"use client";

import { cn, Icon } from "@linkyo/ui";
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/**
 * "Show more": a quiet link-coloured button that opens the content below it. The content's height
 * grows from 0 (grid rows 0fr → 1fr), so what follows moves smoothly; with reduced motion it opens at
 * once. Closed, the content is inert: hidden from screen readers and out of the Tab order.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  triggerClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <div className={cn("grid", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex min-h-control-md items-center gap-2 justify-self-start rounded-sm text-small font-semibold text-link",
          "transition-colors duration-micro hover:text-fg focus-visible:focus-ring",
          triggerClassName,
        )}
      >
        {summary}
        <Icon
          icon={ChevronDown}
          size="sm"
          className={cn("transition-transform duration-standard ease-emphasized motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      <div
        id={contentId}
        data-open={open ? "" : undefined}
        className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-standard ease-emphasized motion-reduce:transition-none data-[open]:grid-rows-[1fr]"
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          {children}
        </div>
      </div>
    </div>
  );
}
