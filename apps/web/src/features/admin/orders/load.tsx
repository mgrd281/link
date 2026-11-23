"use client";

import { Button, Icon } from "@linkyo/ui";
import { CircleAlert, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A read of the team console that may fail. A failed read is its own state: it is never shown as an
 * empty list ("no orders", "no open requests") or as "not found", because the team would then
 * believe nothing is waiting while withdrawals with a statutory deadline are.
 */
export type Loaded<T> = { status: "loading" } | { status: "failed" } | { status: "ready"; data: T };

/** How a read ended: its answer, or that it failed. */
export async function settle<T>(read: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { status: "ready", data: await read() };
  } catch {
    return { status: "failed" };
  }
}

/** Reads again whenever `key` changes or `reload` is called; `reload` shows the skeleton first. */
export function useLoad<T>(read: () => Promise<T>, key: string): { state: Loaded<T>; reload: () => void; refresh: () => Promise<void> } {
  const [answer, setAnswer] = useState<{ key: string; state: Loaded<T> } | null>(null);
  const [version, setVersion] = useState(0);
  const latest = useRef(read);
  useEffect(() => {
    latest.current = read;
  });
  const token = `${key}#${String(version)}`;
  useEffect(() => {
    let cancelled = false;
    void settle(() => latest.current()).then((state) => {
      if (!cancelled) setAnswer({ key: token, state });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);
  const reload = useCallback(() => setVersion((current) => current + 1), []);
  // Reads again in place (after an action of this screen): what is shown stays until the answer is in.
  const refresh = useCallback(async () => {
    const state = await settle(() => latest.current());
    setAnswer((current) => (current ? { key: current.key, state } : current));
  }, []);
  // Another list (a filter) or a retry: the skeleton, not the previous answer. An in-place refresh keeps its key.
  const state: Loaded<T> = answer?.key === token ? answer.state : { status: "loading" };
  return { state, reload, refresh };
}

/** "This view could not be loaded", with the way out: load it again. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("app.crash");
  return (
    <div role="alert" data-load-failed className="grid justify-items-start gap-3 rounded-lg border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-small font-medium">
        <Icon icon={CircleAlert} size="sm" className="shrink-0 text-danger-strong" />
        {t("title")}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <Icon icon={RotateCw} size="sm" />
        {t("retry")}
      </Button>
    </div>
  );
}
