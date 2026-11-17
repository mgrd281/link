import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "./lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: "flat" | "e1" | "e2";
  interactive?: boolean;
}

/** Surface + hairline border + radius lg (brand §6: prefer borders + subtle shadow). */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = "e1", interactive = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-line bg-surface text-fg",
        elevation === "e1" && "shadow-e1",
        elevation === "e2" && "shadow-e2",
        interactive && "transition-[box-shadow,border-color] duration-standard ease-standard hover:border-line-strong hover:shadow-e2",
        className,
      )}
      {...props}
    />
  );
});
