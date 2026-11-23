"use client";

import { Button, Icon } from "@linkyo/ui";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

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

  const commit = (pieces: readonly string[]) => {
    if (pieces.length > 0) onValues(addChips(values, pieces, max, maxLength));
  };
  const confirm = () => {
    commit([text]);
    setText("");
  };
  const move = (index: number, delta: number) => {
    const next = [...values];
    const [chip] = next.splice(index, 1);
    if (chip === undefined) return;
    next.splice(index + delta, 0, chip);
    onValues(next);
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
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {values.map((value, index) => (
            <li key={value} className="flex min-w-0 max-w-full items-center rounded-full border border-line-strong bg-surface ps-3">
              <span dir="auto" className="min-w-0 truncate text-small font-medium">
                {value}
              </span>
              {movable && index > 0 ? (
                <ChipButton label={tForm("moveUp", { name: value })} onClick={() => move(index, -1)}>
                  <Icon icon={ChevronLeft} size="sm" className="rtl:-scale-x-100" />
                </ChipButton>
              ) : null}
              {movable && index < values.length - 1 ? (
                <ChipButton label={tForm("moveDown", { name: value })} onClick={() => move(index, 1)}>
                  <Icon icon={ChevronRight} size="sm" className="rtl:-scale-x-100" />
                </ChipButton>
              ) : null}
              <ChipButton label={t("removeChip", { label: value })} onClick={() => onValues(values.filter((_, i) => i !== index))}>
                <Icon icon={X} size="sm" />
              </ChipButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A 44 px target around a small mark, inside a chip. */
function ChipButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-touch-target shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring"
    >
      {children}
    </button>
  );
}
