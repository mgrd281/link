"use client";

import { Button, Icon } from "@linkyo/ui";
import { CircleAlert, CircleCheck, Import } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import type { FoundLink } from "./import-links";

/** `paste`: a service that forbids reading (Linktree); `robots`: the page asks programs not to read it. */
type ImportError = "unsupported" | "notFound" | "empty" | "failed" | "paste" | "robots";
type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; profiles: number; links: number } | { kind: "error"; error: ImportError };

/** Reads another link-in-bio page through our server and hands its links over. */
export function useImport({ onLinks }: { onLinks: (links: FoundLink[]) => { profiles: number; links: number } }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const run = async () => {
    if (!url.trim()) {
      setState({ kind: "error", error: "unsupported" });
      return;
    }
    setState({ kind: "busy" });
    try {
      const response = await fetch("/api/import-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const result = (await response.json()) as { ok: true; links: FoundLink[] } | { ok: false; error: ImportError };
      if (!result.ok) {
        setState({ kind: "error", error: result.error });
        return;
      }
      setState({ kind: "done", ...onLinks(result.links) });
    } catch {
      setState({ kind: "error", error: "failed" });
    }
  };
  return { url, setUrl, state, run };
}

/**
 * "Coming from Linktree & co.?": one paste brings the profiles and links over; they land in the
 * fields below, where they can be checked before the page is made. A Linktree address is never read
 * (Linktree forbids it): the box says so and `onPasteOnly` lets the screen take the person to the
 * field where they paste their links.
 */
export function ImportBox({ importer, onPasteOnly }: { importer: ReturnType<typeof useImport>; onPasteOnly?: () => void }) {
  const t = useTranslations("app.welcome.import");
  const id = useId();
  const { url, setUrl, state, run } = importer;
  const pasteOnly = useRef(onPasteOnly);
  useEffect(() => {
    pasteOnly.current = onPasteOnly;
  });
  // Once per answer (a new state object), not on every render of the screen around it.
  useEffect(() => {
    if (state.kind === "error" && state.error === "paste") pasteOnly.current?.();
  }, [state]);
  return (
    <section aria-labelledby={`${id}-title`} className="grid grid-cols-1 gap-3 rounded-xl bg-canvas-muted p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-control-md shrink-0 place-items-center rounded-lg bg-primary text-primary-fg">
          <Icon icon={Import} size="md" />
        </span>
        <div className="grid gap-1">
          <h2 id={`${id}-title`} className="text-body font-semibold">
            {t("title")}
          </h2>
          <p className="text-small text-fg-secondary">{t("lead")}</p>
        </div>
      </div>
      <label htmlFor={id} className="sr-only">
        {t("label")}
      </label>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void run();
            }
          }}
          dir="ltr"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("placeholder")}
          aria-describedby={`${id}-status`}
          className="h-control-lg min-w-0 rounded-md border border-line-input bg-surface-elevated px-3 text-body outline-none placeholder:text-fg-tertiary focus-visible:border-focus focus-visible:focus-ring sm:flex-1"
        />
        <Button type="button" variant="primary" size="lg" loading={state.kind === "busy"} onClick={() => void run()}>
          {t("button")}
        </Button>
      </div>
      <p id={`${id}-status`} role="status" className="text-small">
        {state.kind === "done" ? (
          <span className="flex items-start gap-2 text-success-strong">
            <Icon icon={CircleCheck} size="sm" className="mt-0.5 shrink-0" />
            {t("done", { profiles: state.profiles, links: state.links })}
          </span>
        ) : state.kind === "error" ? (
          <span className="flex items-start gap-2 text-danger-strong">
            <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
            {t(`errors.${state.error}`)}
          </span>
        ) : (
          <span className="text-fg-secondary">{t("hint")}</span>
        )}
      </p>
    </section>
  );
}
