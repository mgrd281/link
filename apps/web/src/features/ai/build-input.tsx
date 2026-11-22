"use client";

import { detectLink, PLATFORMS, type Platform } from "@linkyo/blocks";
import { Button, cn, Icon, IconButton } from "@linkyo/ui";
import { ChevronDown, ChevronUp, CircleAlert, Globe, ImagePlus, Link2, Plus, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, type Ref } from "react";

import { SelectField, TextInput } from "@/features/app/form";
import { ImageError, pickFiles, type PreparedImage } from "@/features/app/images";
import { mediaSizes, PlatformGlyph } from "@/features/directions/shared/creator-kit";

import { photoColors, type PhotoColors } from "./photo-colors";
import type { AiQuota } from "./quota";
import { ABOUT_MAX, SOURCES_MAX } from "./request";
import { sourceChip, splitSources, type SourceChip } from "./source-lines";

/** Everything the owner gave for a draft; kept when they start again ("New draft" keeps the inputs). */
export interface BuildInputs {
  /** The sources as typed, in order (up to five). */
  sources: string[];
  /** Typed into the source field but not added yet (added when the draft starts). */
  pending: string;
  /** Links pasted one per line (Linktree and co, which we may not read). */
  pasted: string;
  pasteOpen: boolean;
  about: string;
  name: string;
  photo: { prepared: PreparedImage; colors: PhotoColors } | null;
  pageLocale: "de" | "en" | "ar";
}

export const emptyInputs = (pageLocale: BuildInputs["pageLocale"], link?: string): BuildInputs => ({
  sources: link ? splitSources(link).slice(0, SOURCES_MAX) : [],
  pending: "",
  pasted: "",
  pasteOpen: false,
  about: "",
  name: "",
  photo: null,
  pageLocale,
});

export interface BuildErrors {
  sources?: "invalid" | "limit" | undefined;
  about?: boolean | undefined;
}

/**
 * Adds what is in the source field as chips. Answers the new inputs and, when something could not be
 * added, why ("invalid": not an address; "limit": five already).
 */
export function addSources(inputs: BuildInputs, text: string): { inputs: BuildInputs; error: BuildErrors["sources"] } {
  const parts = splitSources(text);
  if (parts.length === 0) return { inputs: { ...inputs, pending: "" }, error: undefined };
  const known = new Set(inputs.sources.map((source) => source.toLowerCase()));
  const added: string[] = [];
  let error: BuildErrors["sources"];
  let pasteOnly = false;
  for (const part of parts) {
    if (known.has(part.toLowerCase())) continue;
    const chip = sourceChip(part);
    if (!chip) {
      error = "invalid";
      continue;
    }
    if (inputs.sources.length + added.length >= SOURCES_MAX) {
      error = "limit";
      break;
    }
    known.add(part.toLowerCase());
    added.push(chip.input);
    pasteOnly ||= chip.pasteOnly;
  }
  return {
    inputs: { ...inputs, sources: [...inputs.sources, ...added], pending: error === "invalid" ? text : "", pasteOpen: inputs.pasteOpen || pasteOnly },
    error,
  };
}

/** The glyph of a source: the platform's own mark, a globe for a website, a link otherwise. */
function SourceGlyph({ chip }: { chip: SourceChip }) {
  if (chip.kind === "website") return <Icon icon={Globe} size="md" />;
  const platform = detectLink(chip.url)?.platform;
  if (chip.kind !== "linkinbio" && chip.kind !== "linktree" && platform && (PLATFORMS as readonly string[]).includes(platform)) {
    return <PlatformGlyph platform={platform as Platform} size="md" />;
  }
  return <Icon icon={Link2} size="md" />;
}

function SourceField({ inputs, onChange, error, onError }: { inputs: BuildInputs; onChange: (inputs: BuildInputs) => void; error: BuildErrors["sources"]; onError: (error: BuildErrors["sources"]) => void }) {
  const t = useTranslations("app.ai");
  const id = useId();
  const chips = inputs.sources.map(sourceChip).filter((chip): chip is SourceChip => chip !== null);
  const full = chips.length >= SOURCES_MAX;
  const add = () => {
    const result = addSources(inputs, inputs.pending);
    onChange(result.inputs);
    onError(result.error);
  };
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-1 gap-1">
        <label htmlFor={id} className="text-body font-semibold">
          {t("input.sources.label")}
        </label>
        <p id={`${id}-hint`} className="text-small text-fg-secondary">
          {t("input.sources.hint")}
        </p>
      </div>
      {chips.length > 0 ? (
        <ul aria-label={t("input.sources.label")} className="grid grid-cols-1 gap-2">
          {chips.map((chip) => (
            <li key={chip.input} data-source-chip={chip.kind} className="grid grid-cols-1 gap-1 rounded-lg border border-line bg-surface py-2 ps-3 pe-1">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-control-sm shrink-0 place-items-center rounded-md bg-canvas-muted text-fg">
                  <SourceGlyph chip={chip} />
                </span>
                <bdi dir="ltr" className="min-w-0 flex-1 truncate text-start text-body font-medium">
                  {chip.label}
                </bdi>
                <IconButton
                  icon={X}
                  label={t("input.sources.remove", { source: chip.label })}
                  onClick={() => {
                    onChange({ ...inputs, sources: inputs.sources.filter((source) => source !== chip.input) });
                    onError(undefined);
                  }}
                />
              </div>
              <p className="ps-12 pe-3 text-small text-fg-secondary">{t(`platform.${chip.line}`)}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {full ? null : (
        <div className="flex items-start gap-2">
          <input
            id={id}
            type="url"
            inputMode="url"
            dir="ltr"
            autoCapitalize="none"
            autoComplete="url"
            spellCheck={false}
            maxLength={300}
            placeholder={t("input.sources.placeholder")}
            value={inputs.pending}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            aria-invalid={error === "invalid" ? true : undefined}
            onChange={(event) => {
              onChange({ ...inputs, pending: event.target.value });
              if (error) onError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
            className={cn(
              "h-control-lg min-w-0 flex-1 rounded-md border px-4 text-start text-body text-fg outline-none transition-[border-color] duration-micro ease-standard placeholder:text-fg-tertiary focus-visible:focus-field lg:pointer-fine:h-control-md lg:pointer-fine:px-3",
              error === "invalid" ? "border-danger-strong bg-danger-subtle [--color-focus:var(--color-danger-strong)]" : "border-line-input bg-surface-elevated hover:border-fg-tertiary focus-visible:border-focus",
            )}
          />
          <Button variant="tinted" size="lg" icon={Plus} onClick={add} className="lg:pointer-fine:h-control-md">
            {t("input.sources.add")}
          </Button>
        </div>
      )}
      {/* Present from the start, so a message that appears after "Add" is read out. */}
      <div aria-live="polite" className="empty:hidden">
        {error ? (
          <p id={`${id}-error`} className="flex items-start gap-2 text-small text-danger-strong">
            <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
            {t(`input.sources.${error}`)}
          </p>
        ) : full ? (
          <p className="text-small text-fg-secondary">{t("input.sources.limit")}</p>
        ) : null}
      </div>
    </div>
  );
}

/** A plain text area, outlined like the dashboard's fields, with its own hint, error and counter. */
function AboutField({ value, onValue, error, fieldRef }: { value: string; onValue: (value: string) => void; error: boolean; fieldRef?: Ref<HTMLTextAreaElement> | undefined }) {
  const t = useTranslations("app.ai.input.about");
  const id = useId();
  return (
    <div className="grid grid-cols-1 gap-2">
      <label htmlFor={id} className="text-body font-semibold">
        {t("label")}
      </label>
      <textarea
        id={id}
        ref={fieldRef}
        rows={3}
        value={value}
        maxLength={ABOUT_MAX}
        dir={value ? "auto" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint ${id}-count`}
        onChange={(event) => onValue(event.target.value)}
        className={cn(
          "min-h-24 resize-y rounded-md border px-4 py-3 text-start text-body text-fg outline-none transition-[border-color,background-color] duration-micro ease-standard placeholder:text-fg-tertiary focus-visible:focus-field lg:pointer-fine:px-3 lg:pointer-fine:py-2",
          error ? "border-danger-strong bg-danger-subtle [--color-focus:var(--color-danger-strong)]" : "border-line-input bg-surface-elevated hover:border-fg-tertiary focus-visible:border-focus",
        )}
      />
      <div className="flex items-start justify-between gap-3 text-small">
        <p id={`${id}-hint`} className={error ? "flex items-start gap-2 text-danger-strong" : "text-fg-secondary"}>
          {error ? <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" /> : null}
          {error ? t("required") : t("hint")}
        </p>
        <p id={`${id}-count`} className="shrink-0 text-caption text-fg-secondary tabular-nums">
          {t("count", { count: value.length })}
        </p>
      </div>
    </div>
  );
}

function PhotoField({ photo, onPhoto }: { photo: BuildInputs["photo"]; onPhoto: (photo: BuildInputs["photo"]) => void }) {
  const t = useTranslations("app.ai.input.photo");
  const tErrors = useTranslations("app.form.imageErrors");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const id = useId();
  const choose = async () => {
    const [file] = await pickFiles();
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      onPhoto(await photoColors(file));
    } catch (error) {
      setProblem(tErrors(error instanceof ImageError ? error.reason : "decode"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-1 gap-2" role="group" aria-labelledby={id}>
      <p id={id} className="text-body font-semibold">
        {t("label")}
      </p>
      {photo ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="relative size-avatar-md shrink-0 overflow-hidden rounded-full border border-line">
            <Image src={photo.prepared.src} alt="" fill sizes={mediaSizes.thumb} unoptimized className="object-cover" />
          </span>
          {/* The two colours the draft will use (the AI never sees the photo itself). */}
          <span aria-hidden className="flex items-center gap-1">
            <span className="size-6 rounded-full border border-line" style={{ background: photo.colors.vibrant }} />
            <span className="size-6 rounded-full border border-line" style={{ background: photo.colors.dominant }} />
          </span>
          <Button variant="ghost" size="sm" loading={busy} onClick={() => void choose()}>
            {t("change")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onPhoto(null)}>
            {t("remove")}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" icon={ImagePlus} loading={busy} className="justify-self-start" onClick={() => void choose()}>
          {t("add")}
        </Button>
      )}
      <p className={cn("text-small", problem ? "text-danger-strong" : "text-fg-secondary")}>{problem ?? t("hint")}</p>
    </div>
  );
}

/** The quota line under the form: what the next draft costs, said before it starts. */
export function QuotaLine({ quota, id }: { quota: AiQuota | null; id?: string | undefined }) {
  const t = useTranslations("app.ai.quota");
  const format = useFormatter();
  if (!quota) return null;
  const resets = quota.resetsAt ? t("resets", { date: format.dateTime(new Date(quota.resetsAt), { day: "numeric", month: "long" }) }) : null;
  const text = quota.plan === "free" ? (quota.left > 0 ? t("free") : t("used")) : [t("left", { count: quota.left }), quota.left === 0 ? resets : null].filter(Boolean).join(" ");
  return (
    <p id={id} data-quota-line className="flex items-start gap-2 text-small font-medium">
      <Icon icon={Sparkles} size="sm" className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

/**
 * The build screen's form: the owner's links (each with the honest line of what we can read there),
 * links to paste, one sentence about them, an optional name and photo (colours only), the page's
 * language, and what we send where. Phone first, one column.
 */
export function BuildInput({
  inputs,
  onChange,
  errors,
  onErrors,
  aboutRef,
}: {
  inputs: BuildInputs;
  onChange: (inputs: BuildInputs) => void;
  errors: BuildErrors;
  onErrors: (errors: BuildErrors) => void;
  aboutRef?: Ref<HTMLTextAreaElement> | undefined;
}) {
  const t = useTranslations("app.ai");
  const pasteId = useId();
  const chips = inputs.sources.map(sourceChip).filter((chip): chip is SourceChip => chip !== null);
  const linktree = chips.some((chip) => chip.pasteOnly);
  return (
    <div className="grid grid-cols-1 gap-8">
      <SourceField inputs={inputs} onChange={onChange} error={errors.sources} onError={(sources) => onErrors({ ...errors, sources })} />

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          aria-expanded={inputs.pasteOpen}
          aria-controls={pasteId}
          onClick={() => onChange({ ...inputs, pasteOpen: !inputs.pasteOpen })}
          className="inline-flex min-h-touch-target items-center gap-2 justify-self-start rounded-sm text-body font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring"
        >
          {t("input.paste.label")}
          <Icon icon={inputs.pasteOpen ? ChevronUp : ChevronDown} size="sm" />
        </button>
        <div id={pasteId} hidden={!inputs.pasteOpen} className="grid grid-cols-1 gap-2">
          {linktree ? <p className="text-small font-medium">{t("platform.linktree")}</p> : null}
          <label htmlFor={`${pasteId}-field`} className="sr-only">
            {t("input.paste.label")}
          </label>
          <textarea
            id={`${pasteId}-field`}
            rows={4}
            dir="ltr"
            value={inputs.pasted}
            placeholder="https://"
            aria-describedby={`${pasteId}-hint`}
            onChange={(event) => onChange({ ...inputs, pasted: event.target.value })}
            className="resize-y rounded-md border border-line-input bg-surface-elevated px-4 py-3 text-start text-body text-fg outline-none transition-[border-color] duration-micro ease-standard placeholder:text-fg-tertiary hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-field lg:pointer-fine:px-3 lg:pointer-fine:py-2"
          />
          <p id={`${pasteId}-hint`} className="text-small text-fg-secondary">
            {t("input.paste.hint")}
          </p>
        </div>
      </div>

      <AboutField
        value={inputs.about}
        onValue={(about) => {
          onChange({ ...inputs, about });
          if (errors.about && about.trim()) onErrors({ ...errors, about: false });
        }}
        error={errors.about === true}
        fieldRef={aboutRef}
      />

      <TextInput label={t("input.name.label")} value={inputs.name} onValue={(name) => onChange({ ...inputs, name })} maxLength={60} autoComplete="name" live={false} />

      <PhotoField photo={inputs.photo} onPhoto={(photo) => onChange({ ...inputs, photo })} />

      <SelectField
        label={t("input.language.label")}
        value={inputs.pageLocale}
        onValue={(pageLocale) => onChange({ ...inputs, pageLocale })}
        options={[
          { value: "de", label: "Deutsch" },
          { value: "en", label: "English" },
          { value: "ar", label: "العربية" },
        ]}
      />

      <div className="grid grid-cols-1 gap-2 rounded-lg border border-line bg-surface p-4 text-small text-fg-secondary">
        <p className="font-medium text-fg">{t("input.own")}</p>
        <p>{t("input.privacy")}</p>
      </div>
    </div>
  );
}
