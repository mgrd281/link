"use client";

import { Button, Icon } from "@linkyo/ui";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { TextInput } from "./form";

/** What ends a chip while typing: commas and semicolons, Latin and Arabic, and line breaks. */
const SEPARATORS = /[,،;؛\n\r]/;

/**
 * Typed text as finished chips and the rest still being typed. Everything before the last separator
 * is done; what follows it stays in the field. Empty pieces are dropped.
 */
export function splitChips(text: string): { done: string[]; rest: string } {
  const parts = text.split(SEPARATORS);
  const rest = parts.pop() ?? "";
  return { done: parts.map((part) => part.trim()).filter(Boolean), rest };
}

/** Adds chips to a list: trimmed, cut to `maxLength`, no duplicates (case-insensitive), at most `max`. */
export function addChips(values: readonly string[], added: readonly string[], max: number, maxLength: number): string[] {
  const next = [...values];
  for (const raw of added) {
    const chip = raw.trim().slice(0, maxLength).trim();
    if (!chip || next.length >= max || next.some((value) => value.toLocaleLowerCase() === chip.toLocaleLowerCase())) continue;
    next.push(chip);
  }
  return next;
}

/**
 * A short list typed as chips (a project's topics, a tools list). The field turns what is typed into
 * chips on a comma (also the Arabic "،"), a semicolon or a line break, read from the input itself:
 * several Android keyboards send no key event for a comma. Enter, leaving the field and the visible
 * "Add" button confirm the rest. Each chip can be moved and removed with its own buttons.
 */
export function ChipsInput({
  label,
  hint,
  values,
  onValues,
  max,
  maxLength,
  movable = false,
  error,
}: {
  label: string;
  hint?: string | undefined;
  values: readonly string[];
  onValues: (values: string[]) => void;
  max: number;
  maxLength: number;
  /** Chips can be moved forward and back (an ordered list, such as tools). */
  movable?: boolean;
  error?: string | undefined;
}) {
  const t = useTranslations("app.portfolio");
  const tForm = useTranslations("app.form");
  const id = useId();
  const [text, setText] = useState("");
  const full = values.length >= max;
  // A chip's button that removed it, or moved it to an end where that button is gone, would leave
  // focus nowhere: it goes to the same kind of button on the chip now at that place (else the field).
  const list = useRef<HTMLUListElement>(null);
  const refocus = useRef<{ index: number; prefer: ChipAction[] } | null>(null);
  useLayoutEffect(() => {
    const target = refocus.current;
    refocus.current = null;
    if (!target) return;
    const item = list.current?.children[target.index];
    const button = target.prefer.map((action) => item?.querySelector<HTMLElement>(`[data-chip-action="${action}"]`)).find((found) => found);
    (button ?? document.getElementById(id))?.focus();
  }, [values, id]);

  // Only a list that really grew is handed on: leaving an empty field changes nothing (and so does
  // not mark the sheet as changed).
  const commit = (pieces: readonly string[]) => {
    const next = addChips(values, pieces, max, maxLength);
    if (next.length > values.length) onValues(next);
  };
  const confirm = () => {
    if (text.trim()) commit([text]);
    setText("");
  };
  const move = (index: number, delta: number) => {
    const next = [...values];
    const [chip] = next.splice(index, 1);
    if (chip === undefined) return;
    next.splice(index + delta, 0, chip);
    refocus.current = { index: index + delta, prefer: delta < 0 ? ["back", "forward"] : ["forward", "back"] };
    onValues(next);
  };
  const remove = (index: number) => {
    refocus.current = { index: Math.min(index, values.length - 2), prefer: ["remove"] };
    onValues(values.filter((_, i) => i !== index));
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <TextInput
        id={id}
        label={label}
        hint={hint}
        error={error}
        value={text}
        disabled={full}
        maxLength={maxLength * 4}
        enterKeyHint="done"
        onValue={(value) => {
          const { done, rest } = splitChips(value);
          commit(done);
          setText(rest);
        }}
        onKeyDown={(event) => {
          // Enter adds the chip instead of saving the whole form.
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            confirm();
          }
        }}
        onBlur={confirm}
      />
      <Button type="button" size="lg" icon={Plus} disabled={full || !text.trim()} onClick={confirm} className="justify-self-start">
        {t("addChip")}
      </Button>
      {values.length > 0 ? (
        <ul ref={list} aria-label={label} className="flex flex-wrap gap-2">
          {values.map((value, index) => (
            <li key={value} className="flex min-w-0 max-w-full items-center rounded-full border border-line-strong bg-surface ps-3">
              <span dir="auto" className="min-w-0 truncate text-small font-medium">
                {value}
              </span>
              {movable && index > 0 ? (
                <ChipButton action="back" label={tForm("moveUp", { name: value })} onClick={() => move(index, -1)}>
                  <Icon icon={ChevronLeft} size="sm" />
                </ChipButton>
              ) : null}
              {movable && index < values.length - 1 ? (
                <ChipButton action="forward" label={tForm("moveDown", { name: value })} onClick={() => move(index, 1)}>
                  <Icon icon={ChevronRight} size="sm" />
                </ChipButton>
              ) : null}
              <ChipButton action="remove" label={t("removeChip", { label: value })} onClick={() => remove(index)}>
                <Icon icon={X} size="sm" />
              </ChipButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type ChipAction = "back" | "forward" | "remove";

/** A 44 px target around a small mark, inside a chip. */
function ChipButton({ action, label, onClick, children }: { action: ChipAction; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      data-chip-action={action}
      aria-label={label}
      onClick={onClick}
      className="grid size-touch-target shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring"
    >
      {children}
    </button>
  );
}
