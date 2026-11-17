"use client";

import { profileSchema } from "@linkyo/blocks";
import { Button, cn, Icon } from "@linkyo/ui";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

type State = { kind: "idle" } | { kind: "ok"; name: string } | { kind: "invalid" };

/**
 * Claim your address. Validates exactly like sign-up (profile username rules), then continues to
 * sign-up with the address already filled in, where availability is checked.
 */
export function ClaimForm({ id, className }: { id: string; className?: string }) {
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
      <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-line-strong bg-surface p-2 shadow-e2 transition-colors duration-micro has-[input:focus-visible]:border-focus has-[input:focus-visible]:focus-ring sm:flex-row sm:items-center">
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
        <Button type="submit" variant="primary" size="lg" className="rounded-lg" trailing={<Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />}>
          {t("cta")}
        </Button>
      </div>
      <p id={messageId} role="status" className={cn("flex items-start gap-2 ps-1 text-small", state.kind === "invalid" ? "text-danger-strong" : "text-fg-secondary")}>
        {state.kind === "ok" ? (
          <>
            <Icon icon={CircleCheck} size="sm" className="mt-0.5 shrink-0 text-success-strong" />
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
