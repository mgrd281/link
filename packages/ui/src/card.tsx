import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "./lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/** Surface + hairline border + radius lg. Flat: Linkyo uses no shadows (brand §6, ADR 0037). */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-line bg-surface text-fg",
        interactive && "transition-[border-color] duration-standard ease-standard hover:border-line-strong",
        className,
      )}
      {...props}
    />
  );
});
