"use client";

import { hasImage, normalizeUrl } from "@linkyo/blocks";
import { Button, cn, Icon, IconButton, Switch, TextField, toast, type TextFieldProps } from "@linkyo/ui";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode, type TextareaHTMLAttributes } from "react";

import { remoteImageProps, resolveMedia } from "@/features/directions/shared/media";

import { ImageError, pickFiles, prepareImage, type ImageKind } from "./images";

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

export function TextInput({ value, onValue, ...props }: TextProps) {
  return <TextField {...props} value={value} onChange={(event) => onValue(event.target.value)} />;
}

/** URLs: typed with or without https://, cleaned up when the field is left. */
export function UrlInput({ value, onValue, ...props }: TextProps) {
  return (
    <TextField
      icon={Link2}
      {...props}
      ltr
      type="url"
      inputMode="url"
      autoCapitalize="none"
      spellCheck={false}
      placeholder={props.placeholder ?? "https://"}
      value={value}
      onChange={(event) => onValue(event.target.value)}
      onBlur={() => {
        const trimmed = value.trim();
        if (!trimmed || /^(?:https?|mailto|tel):/i.test(trimmed)) return;
        const url = normalizeUrl(trimmed);
        if (url) onValue(url.toString());
      }}
    />
  );
}

export function TextArea({
  label,
  value,
  onValue,
  max,
  hint,
  error,
  rows = 3,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & { label: string; value: string; onValue: (value: string) => void; max: number; hint?: string | undefined; error?: string | undefined }) {
  const id = useId();
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-small text-fg">
          {label}
        </label>
        <span className={cn("text-caption tabular-nums", value.length > max ? "text-danger-strong" : "text-fg-tertiary")} aria-hidden>
          {value.length}/{max}
        </span>
      </div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={max}
        onChange={(event) => onValue(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-hint` : undefined}
        className={cn(
          "min-h-control-xl resize-y rounded-md border border-line-input bg-surface-elevated px-3 py-2 text-body text-fg outline-none transition-[border-color,box-shadow] duration-micro",
          "hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-ring placeholder:text-fg-tertiary",
          error && "border-danger-strong",
        )}
        {...props}
      />
      {error || hint ? (
        <p id={`${id}-hint`} className={cn("text-small", error ? "text-danger-strong" : "text-fg-secondary")}>
          {error ?? hint}
        </p>
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
      <select
        id={id}
        value={value}
        onChange={(event) => onValue(event.target.value as T)}
        className="h-control-md rounded-md border border-line-input bg-surface-elevated px-3 text-body text-fg outline-none hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
      <Switch id={id} checked={checked} onCheckedChange={onChecked} disabled={disabled} />
    </div>
  );
}

/** Pick → resize in the browser → preview. Shows a calm tile when there is no picture yet. */
export function ImageInput({
  label,
  image,
  onImage,
  kind = "photo",
  shape = "square",
  withAlt = true,
  error,
}: {
  label: string;
  image: { src: string; alt: string; tone?: "light" | "dark" | undefined } | undefined;
  onImage: (image: { src: string; alt: string; tone?: "light" | "dark" | undefined } | undefined) => void;
  kind?: ImageKind;
  shape?: "square" | "round" | "wide";
  withAlt?: boolean;
  error?: string | undefined;
}) {
  const t = useTranslations("app.form");
  const [busy, setBusy] = useState(false);
  const present = hasImage(image);
  const choose = async () => {
    const [file] = await pickFiles();
    if (!file) return;
    setBusy(true);
    try {
      const prepared = await prepareImage(file, kind);
      onImage({ src: prepared.src, alt: image?.alt ?? "", tone: prepared.tone });
    } catch (problem) {
      toast({ title: t(`imageErrors.${problem instanceof ImageError ? problem.reason : "decode"}`), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  const resolved = present ? resolveMedia(image.src) : null;
  return (
    <div className="grid grid-cols-1 gap-3">
      <p className="text-small text-fg">{label}</p>
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden border border-line bg-canvas-muted text-fg-tertiary",
            shape === "round" ? "size-avatar-xl rounded-full" : shape === "wide" ? "aspect-video w-32 rounded-md" : "size-avatar-xl rounded-md",
            error && "border-danger-strong",
          )}
        >
          {resolved ? <Image src={resolved} alt="" fill sizes="10vw" className={kind === "logo" ? "object-contain p-2" : "object-cover"} {...remoteImageProps(resolved)} /> : <Icon icon={ImagePlus} size="lg" />}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={ImagePlus} loading={busy} onClick={() => void choose()}>
            {present ? t("replace") : t("upload")}
          </Button>
          {present ? (
            <Button size="sm" variant="destructive" icon={Trash2} onClick={() => onImage(undefined)}>
              {t("removeImage")}
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-small text-danger-strong">{error}</p> : null}
      {withAlt && present ? (
        <TextInput label={t("alt")} hint={t("altHint")} value={image.alt} onValue={(alt) => onImage({ ...image, alt })} maxLength={300} />
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
