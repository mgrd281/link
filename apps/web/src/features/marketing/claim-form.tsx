"use client";

import { profileSchema } from "@linkyo/blocks";
import { Button, cn, Icon } from "@linkyo/ui";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

type State = { kind: "idle" } | { kind: "ok"; name: string } | { kind: "invalid" };

/** The arrow leans forward when the button is hovered (mirrored in Arabic). */
const ARROW = "transition-transform duration-micro group-hover/button:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover/button:-translate-x-0.5";

/**
 * Claim your address. Validates exactly like sign-up (profile username rules), then continues to
 * sign-up with the address already filled in, where availability is checked.
 * `tone="brand"` is for a Linkyo Teal surface: white button with teal text, white messages.
 */
export function ClaimForm({ id, className, tone = "default" }: { id: string; className?: string; tone?: "default" | "brand" }) {
  const t = useTranslations("marketing.claim");
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const router = useRouter();
  const messageId = `${id}-message`;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const name = value.trim().toLowerCase();
        if (profileSchema.shape.username.safeParse(name).success) {
          setState({ kind: "ok", name });
          router.push(`/signup?name=${encodeURIComponent(name)}`);
        } else setState({ kind: "invalid" });
      }}
      className={cn("grid min-w-0 grid-cols-1 gap-3", className)}
    >
      <label htmlFor={id} className="sr-only">
        {t("label")}
      </label>
      <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-transparent bg-canvas-muted p-2 transition-colors duration-micro has-[input:focus-visible]:border-focus has-[input:focus-visible]:focus-ring sm:flex-row sm:items-center">
        <div dir="ltr" className="flex min-w-0 flex-1 items-center ps-3">
          <span className="shrink-0 text-body-lg text-fg-tertiary">{t("prefix")}</span>
          <input
            id={id}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (state.kind !== "idle") setState({ kind: "idle" });
            }}
            placeholder={t("placeholder")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="url"
            aria-describedby={messageId}
            aria-invalid={state.kind === "invalid" || undefined}
            className="h-control-lg min-w-0 flex-1 bg-transparent text-body-lg font-medium text-fg outline-none placeholder:text-fg-tertiary"
          />
        </div>
        <Button type="submit" variant="primary" size="lg" className={cn("rounded-lg", tone === "brand" && "bg-primary-fg text-primary shadow-e2 hover:bg-primary-fg active:bg-primary-fg")} trailing={<Icon icon={ArrowRight} size="md" className={ARROW} />}>
          {t("cta")}
        </Button>
      </div>
      <p id={messageId} role="status" className={cn("flex items-start gap-2 ps-1 text-small", tone === "brand" ? "text-primary-fg" : state.kind === "invalid" ? "text-danger-strong" : "text-fg-secondary")}>
        {state.kind === "ok" ? (
          <>
            <Icon icon={CircleCheck} size="sm" className={cn("mt-0.5 shrink-0", tone === "default" && "text-success-strong")} />
            <span>{t("ok", { name: state.name })}</span>
          </>
        ) : state.kind === "invalid" ? (
          <>
            <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
            {t("invalid")}
          </>
        ) : (
          t("hint")
        )}
      </p>
    </form>
  );
}
