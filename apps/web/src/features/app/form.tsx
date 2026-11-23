"use client";

import { hasImage, normalizeUrl } from "@linkyo/blocks";
import { Button, cn, Icon, IconButton, Switch, TextField, type TextFieldProps } from "@linkyo/ui";
import { ArrowDown, ArrowUp, ChevronDown, CircleAlert, ImagePlus, Link2, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode, type TextareaHTMLAttributes } from "react";

import { remoteImageProps, resolveMedia } from "@/features/directions/shared/media";

import { ImageError, pickFiles, prepareAndStore, storedImage, type ImageKind } from "./images";
import { useMediaOwner } from "./media-owner";

import { haptic } from "@/lib/haptics";

/** A form section with a small heading (forms read top to bottom, one column — brand §5). */
export function FormSection({ title, description, children, className }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("grid min-w-0 grid-cols-1 gap-4", className)}>
      {title ? (
        <legend className="mb-4 grid gap-1">
          <span className="text-body font-semibold">{title}</span>
          {description ? <span className="text-small text-fg-secondary">{description}</span> : null}
        </legend>
      ) : null}
      {children}
    </fieldset>
  );
}

type TextProps = Omit<TextFieldProps, "value" | "onChange"> & { value: string; onValue: (value: string) => void };

/**
 * Dashboard fields are outlined (a 3:1 frame, WCAG 1.4.11), 48 px on touch screens and 40 px with a
 * mouse on wide screens, with 16 px text so iOS does not zoom in. Their message is a polite live
 * region from the start, so an error that appears later is read out. Callers can still ask for another look.
 */
export function TextInput({ value, onValue, variant = "outline", size = "auto", live = true, ...props }: TextProps) {
  return <TextField {...props} variant={variant} size={size} live={live} value={value} onChange={(event) => onValue(event.target.value)} />;
}

/** URLs: typed with or without https://, cleaned up when the field is left. */
export function UrlInput({ value, onValue, variant = "outline", size = "auto", live = true, onBlur, ...props }: TextProps) {
  return (
    <TextField
      icon={Link2}
      {...props}
      variant={variant}
      size={size}
      live={live}
      ltr
      type="url"
      inputMode="url"
      autoCapitalize="none"
      spellCheck={false}
      placeholder={props.placeholder ?? "https://"}
      value={value}
      onChange={(event) => onValue(event.target.value)}
      onBlur={(event) => {
        const trimmed = value.trim();
        if (trimmed && !/^(?:https?|mailto|tel):/i.test(trimmed)) {
          const url = normalizeUrl(trimmed);
          if (url) onValue(url.toString());
        }
        onBlur?.(event);
      }}
    />
  );
}

/** Rows a text area shows: what is written plus an empty line, between `rows` and eight (then it scrolls). */
const MAX_ROWS = 8;

export function TextArea({
  label,
  value,
  onValue,
  max,
  hint,
  error,
  live = true,
  rows = 3,
  count = false,
  mono = false,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "className"> & {
  label: string;
  value: string;
  onValue: (value: string) => void;
  max: number;
  hint?: string | undefined;
  error?: string | undefined;
  /** Keep the message mounted (a polite live region) even with no hint or error, as `TextField` does. */
  live?: boolean | undefined;
  /** Show the count from the first character, where the limit is part of the task ("in one sentence"). */
  count?: boolean | undefined;
  /** Code: the monospace face, left to right in every language, no wrapping of long lines. */
  mono?: boolean | undefined;
}) {
  const t = useTranslations("app.form");
  const id = useId();
  const messageId = `${id}-message`;
  const hasMessage = live || hint !== undefined || error !== undefined;
  const lines = value.split("\n").length;
  const full = value.length >= max;
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-small text-fg">
          {label}
        </label>
        {/* The count only shows near the limit; the limit itself is read out below. */}
        {value.length >= max * 0.8 || (count && value.length > 0) ? (
          <span className={cn("text-caption tabular-nums", full ? "text-danger-strong" : "text-fg-tertiary")} aria-hidden>
            {value.length}/{max}
          </span>
        ) : null}
      </div>
      <textarea
        id={id}
        rows={Math.min(MAX_ROWS, Math.max(rows, lines + 1))}
        value={value}
        maxLength={max}
        onChange={(event) => onValue(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        // Text runs in its own direction (a German bio on an Arabic page reads left to right); an empty
        // field follows the page, so the placeholder and the caret start on the page's side.
        dir={mono ? "ltr" : value ? "auto" : undefined}
        wrap={mono ? "off" : undefined}
        spellCheck={mono ? false : undefined}
        className={cn(
          // Outlined like the text fields above it (see TextInput); it grows with its text instead of a resize handle.
          "resize-none rounded-md border px-4 py-3 text-start text-body text-fg outline-none transition-[border-color,background-color] duration-micro ease-standard lg:pointer-fine:px-3 lg:pointer-fine:py-2",
          mono && "font-mono text-small",
          "focus-visible:focus-field placeholder:text-fg-tertiary",
          error
            ? "border-danger-strong bg-danger-subtle focus-visible:border-danger-strong [--color-focus:var(--color-danger-strong)]"
            : "border-line-input bg-surface-elevated hover:border-fg-tertiary focus-visible:border-focus",
        )}
        {...props}
      />
      {hasMessage ? (
        <div id={messageId} aria-live="polite" className="text-small empty:-mt-2">
          {error ? (
            <span className="flex items-start gap-2 text-danger-strong">
              <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
              {error}
            </span>
          ) : hint ? (
            <span className="block font-regular text-fg-secondary">{hint}</span>
          ) : null}
          {full ? <span className="sr-only">{t("limit")}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onValue,
  options,
  className,
}: {
  label: string;
  value: T;
  onValue: (value: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("grid grid-cols-1 gap-2", className)}>
      <label htmlFor={id} className="text-small text-fg">
        {label}
      </label>
      {/* The real select (the system's own list on iOS and macOS), framed like a text field, with our chevron. */}
      <div className="relative grid">
        <select
          id={id}
          value={value}
          onChange={(event) => onValue(event.target.value as T)}
          className="h-control-lg min-w-0 appearance-none rounded-md border border-line-input bg-surface-elevated ps-4 pe-10 text-body text-fg outline-none transition-[border-color,background-color] duration-micro ease-standard hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-field lg:pointer-fine:h-control-md lg:pointer-fine:ps-3"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon icon={ChevronDown} size="sm" className="pointer-events-none absolute inset-y-0 end-3 my-auto text-fg-tertiary" />
      </div>
    </div>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onChecked,
  disabled = false,
}: {
  label: string;
  description?: string | undefined;
  checked: boolean;
  onChecked: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-line bg-surface p-3">
      <label htmlFor={id} className="grid grid-cols-1 gap-0.5">
        <span className="text-small font-medium">{label}</span>
        {description ? <span className="text-caption text-fg-secondary">{description}</span> : null}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(value) => {
          haptic();
          onChecked(value);
        }}
        disabled={disabled}
      />
    </div>
  );
}

/** A picture as a page keeps it: address, description, focal point, tone and measured size. */
export interface ImageValue {
  src: string;
  alt: string;
  tone?: "light" | "dark" | undefined;
  focal?: [number, number] | undefined;
  w?: number | undefined;
  h?: number | undefined;
}

/**
 * Pick → resize in the browser → preview. Shows a calm tile when there is no picture yet. A new
 * picture keeps its measured size (`w`/`h`), so pages can reserve its space; its focal point starts
 * over (it belonged to the picture before).
 */
export function ImageInput({
  label,
  image,
  onImage,
  kind = "photo",
  shape = "square",
  withAlt = true,
  error,
  hint,
  altId,
  altLabel,
  altHint,
}: {
  label: string;
  image: ImageValue | undefined;
  onImage: (image: ImageValue | undefined) => void;
  kind?: ImageKind;
  shape?: "square" | "round" | "wide";
  withAlt?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
  /** The description field's id, for a form that leads the owner to it ("describe your picture"). */
  altId?: string | undefined;
  /** The description field's own words, where the form says more than "Image description". */
  altLabel?: string | undefined;
  altHint?: string | undefined;
}) {
  const t = useTranslations("app.form");
  const [busy, setBusy] = useState(false);
  // A picture that could not be used (wrong type, too big): said under the field, where it was chosen.
  const [problem, setProblem] = useState<ImageError["reason"] | "decode" | null>(null);
  const present = hasImage(image);
  const owner = useMediaOwner();
  const choose = async () => {
    const [file] = await pickFiles();
    if (!file) return;
    setBusy(true);
    try {
      const prepared = await prepareAndStore(file, kind, owner);
      setProblem(null);
      onImage(storedImage(prepared, image?.alt ?? ""));
    } catch (reason) {
      setProblem(reason instanceof ImageError ? reason.reason : "decode");
    } finally {
      setBusy(false);
    }
  };
  const resolved = present ? resolveMedia(image.src) : null;
  const messageId = useId();
  const message = problem ? t(`imageErrors.${problem}`) : error;
  return (
    <div className="grid grid-cols-1 gap-3">
      <p className="text-small text-fg">{label}</p>
      <div className="flex items-center gap-4">
        {/* The picture itself is a big target for a tap or a click, as in iOS Contacts' "Add Photo". The
            button beside it is the one control for the keyboard and screen readers, and says what it does. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => void choose()}
          disabled={busy}
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden border border-line bg-canvas-muted text-fg-tertiary",
            "transition-[background-color,scale] duration-micro ease-standard hover:bg-hover active:scale-pressed motion-reduce:active:scale-none disabled:pointer-events-none",
            shape === "round" ? "size-avatar-xl rounded-full" : shape === "wide" ? "aspect-video w-32 rounded-md" : "size-avatar-xl rounded-md",
            message && "border-danger-strong",
          )}
        >
          {resolved ? <Image src={resolved} alt="" fill sizes="10vw" className={kind === "logo" ? "object-contain p-2" : "object-cover"} {...remoteImageProps(resolved)} /> : <Icon icon={ImagePlus} size="lg" />}
        </button>
        <div className="flex flex-wrap gap-2">
          {/* The visible word ("Upload") starts the name ("Upload Profile photo"), so voice control finds it. */}
          <Button
            variant="tinted"
            size="sm"
            icon={ImagePlus}
            loading={busy}
            onClick={() => void choose()}
            aria-label={present ? t("replaceNamed", { label }) : t("uploadNamed", { label })}
            aria-describedby={message ? messageId : undefined}
          >
            {present ? t("replace") : t("upload")}
          </Button>
          {present ? (
            <Button
              size="sm"
              variant="destructive"
              icon={Trash2}
              onClick={() => {
                setProblem(null);
                onImage(undefined);
              }}
            >
              {t("removeImage")}
            </Button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="text-small font-regular text-fg-secondary">{hint}</p> : null}
      {message ? (
        <p key={problem ? "problem" : "error"} id={messageId} role={problem ? "alert" : undefined} className="flex items-start gap-2 text-small text-danger-strong">
          <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
          {message}
        </p>
      ) : null}
      {withAlt && present ? (
        <TextInput id={altId} label={altLabel ?? t("alt")} hint={altHint ?? t("altHint")} value={image.alt} onValue={(alt) => onImage({ ...image, alt })} maxLength={300} />
      ) : null}
    </div>
  );
}

/** Repeating items (shows, platform links, partners): add, reorder, remove — each with a clear name. */
export function Repeater<T>({
  items,
  onItems,
  render,
  make,
  itemLabel,
  addLabel,
  max,
  min = 0,
}: {
  items: T[];
  onItems: (items: T[]) => void;
  render: (item: T, update: (item: T) => void, index: number) => ReactNode;
  make: () => T;
  itemLabel: (item: T, index: number) => string;
  addLabel: string;
  max: number;
  min?: number;
}) {
  const t = useTranslations("app.form");
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(index + delta, 0, item);
    onItems(next);
  };
  return (
    <div className="grid grid-cols-1 gap-3">
      <ol className="grid grid-cols-1 gap-3">
        {items.map((item, index) => {
          const name = itemLabel(item, index);
          return (
            <li key={index} className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-1">
                <p className="min-w-0 flex-1 truncate text-small font-semibold">{name}</p>
                <IconButton icon={ArrowUp} size="sm" label={t("moveUp", { name })} disabled={index === 0} onClick={() => move(index, -1)} />
                <IconButton icon={ArrowDown} size="sm" label={t("moveDown", { name })} disabled={index === items.length - 1} onClick={() => move(index, 1)} />
                <IconButton
                  icon={Trash2}
                  size="sm"
                  label={t("removeItem", { name })}
                  disabled={items.length <= min}
                  onClick={() => onItems(items.filter((_, i) => i !== index))}
                  className="text-danger-strong"
                />
              </div>
              {render(item, (next) => onItems(items.map((candidate, i) => (i === index ? next : candidate))), index)}
            </li>
          );
        })}
      </ol>
      {items.length < max ? (
        <Button icon={Plus} onClick={() => onItems([...items, make()])} className="justify-self-start">
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
