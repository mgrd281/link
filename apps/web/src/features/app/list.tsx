"use client";

import { cn, Icon } from "@linkyo/ui";
import { ChevronRight, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

import { Link } from "@/i18n/navigation";

/*
 * Grouped lists for the dashboard, as in iOS Settings: a small group header, a white group of rows
 * with inset hairlines between them, and an optional footer note. One row anatomy everywhere: a 32 px
 * icon tile, the title (and a subtitle), a value, then a chevron when the row leads somewhere.
 */

/** The hairline between rows, inset to the text (past the tile when there is one). */
const separator = (inset: boolean) =>
  cn(
    "relative not-first:before:absolute not-first:before:top-0 not-first:before:end-0 not-first:before:border-t not-first:before:border-line",
    inset ? "not-first:before:start-16" : "not-first:before:start-4",
  );

const rowBox = "flex w-full min-h-control-lg items-center gap-4 px-4 py-2 text-start lg:pointer-fine:min-h-touch-target";

/**
 * The 32 px icon tile that leads a row: tinted, red for a dangerous action, green once a step is
 * done (Home's checklist, the Invite milestones).
 */
export function Tile({ icon, tone = "default", done = false }: { icon: LucideIcon; tone?: "default" | "danger"; done?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-control-sm shrink-0 place-items-center rounded-sm",
        done ? "bg-success-subtle text-success-strong" : tone === "danger" ? "bg-danger-subtle text-danger-strong" : "bg-tinted text-tinted-fg",
      )}
    >
      <Icon icon={icon} size="sm" />
    </span>
  );
}

export interface ListGroupProps {
  title?: string;
  titleId?: string;
  headingLevel?: 2 | 3;
  /** Next to the group header, e.g. a count or a badge. */
  trailing?: ReactNode;
  /** A note under the group. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ListGroup({ title, titleId, headingLevel = 2, trailing, footer, className, children }: ListGroupProps) {
  const autoId = useId();
  const headingId = titleId ?? autoId;
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section aria-labelledby={title ? headingId : undefined} className={cn("grid gap-2", className)}>
      {title || trailing ? (
        <div className="flex items-baseline justify-between gap-3 px-4">
          {title ? (
            // With a known id the heading is a jump target of the section panel, so it can take focus.
            <Heading id={headingId} tabIndex={titleId ? -1 : undefined} className="text-small font-semibold text-fg-secondary outline-none">
              {title}
            </Heading>
          ) : null}
          {trailing}
        </div>
      ) : null}
      {/* Safari (VoiceOver) drops the list semantics of a <ul> without bullets unless the role is set. */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above */}
      <ul role="list" className="overflow-hidden rounded-lg bg-group lg:border lg:border-line">
        {children}
      </ul>
      {footer ? <p className="px-4 text-small font-regular text-fg-secondary">{footer}</p> : null}
    </section>
  );
}

interface ListRowCommon {
  icon?: LucideIcon;
  /** Instead of an icon tile, e.g. an avatar (32 px wide, so the hairline still meets the text). */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Wraps the subtitle in <bdi> with this direction (addresses and emails: "ltr"; names: "auto"). */
  subtitleDir?: "ltr" | "auto";
  /** Lets a subtitle that is a sentence (not a value) wrap instead of being cut off on phones. */
  subtitleWrap?: boolean;
  /** The current value, at the end of the row. */
  value?: ReactNode;
  /** "chevron", "none" or any element; defaults to a chevron when the row leads somewhere, nothing otherwise. */
  accessory?: ReactNode;
  tone?: "default" | "danger";
  /** A finished step: a success tile and a struck-through title. */
  done?: boolean;
  className?: string;
}

export type ListRowProps = ListRowCommon &
  ({ href: string; onClick?: never } | { onClick: () => void; href?: never } | { href?: never; onClick?: never });

/**
 * One row: a link (`href`), a button (`onClick`) or plain content. The whole row is the target. The
 * subtitle and value sit inside it, so they are part of its name ("Seitenadresse linkyo.app/mila"),
 * as VoiceOver reads a Settings cell.
 */
export function ListRow(props: ListRowProps) {
  const { icon, leading, title, subtitle, subtitleDir, subtitleWrap = false, value, accessory, tone = "default", done = false, className } = props;
  const interactive = props.href !== undefined || props.onClick !== undefined;
  const end = accessory === undefined ? (interactive ? "chevron" : "none") : accessory;

  const content = (
    <>
      {icon ? <Tile icon={icon} tone={tone} done={done} /> : leading}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn("text-body leading-snug", tone === "danger" && "text-danger-strong", done && "text-fg-secondary line-through")}>{title}</span>
        {subtitle ? (
          <span className={cn(subtitleWrap ? "text-pretty" : "truncate", "text-small font-regular text-fg-secondary")}>{subtitleDir ? <bdi dir={subtitleDir}>{subtitle}</bdi> : subtitle}</span>
        ) : null}
      </span>
      {value ? <span className="min-w-0 shrink truncate text-small text-fg-secondary">{value}</span> : null}
      {end === "chevron" ? <Icon icon={ChevronRight} size="sm" className="text-fg-tertiary rtl:-scale-x-100" /> : end === "none" ? null : end}
    </>
  );

  const control = cn(
    rowBox,
    "transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-field",
  );

  return (
    <li className={cn(separator(Boolean(icon ?? leading)), className)}>
      {props.href !== undefined ? (
        <Link href={props.href} className={control}>
          {content}
        </Link>
      ) : props.onClick !== undefined ? (
        <button type="button" onClick={props.onClick} className={control}>
          {content}
        </button>
      ) : (
        <div className={rowBox}>{content}</div>
      )}
    </li>
  );
}

/**
 * A row that picks one value with the platform's own picker (the wheel on iOS, a menu on the Mac):
 * a real, invisible <select> covers the row, and the row shows the current choice.
 */
export function PickerRow<T extends string>({
  icon,
  label,
  value,
  options,
  onValue,
}: {
  icon?: LucideIcon;
  label: string;
  value: T;
  /** `lang`: the option's own language (e.g. "ar" for "العربية"), so it is read in that voice. */
  options: readonly { value: T; label: string; lang?: string }[];
  onValue: (value: T) => void;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <li className={separator(Boolean(icon))}>
      <label
        className={cn(
          "relative flex w-full min-h-control-lg items-center gap-4 px-4 py-2 lg:pointer-fine:min-h-touch-target",
          "transition-colors duration-micro hover:bg-hover has-[select:focus-visible]:focus-field",
        )}
      >
        {icon ? <Tile icon={icon} /> : null}
        <span className="min-w-0 flex-1 text-body leading-snug">{label}</span>
        <span aria-hidden lang={current?.lang} className="min-w-0 shrink truncate text-small text-fg-secondary">
          {current?.label}
        </span>
        <Icon icon={ChevronsUpDown} size="sm" className="text-fg-tertiary" />
        {/* 16 px text: iOS zooms into a smaller select when it is focused. */}
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onValue(event.target.value as T)}
          className="absolute inset-0 cursor-pointer appearance-none text-body opacity-0"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} lang={option.lang}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}

/** A row whose control (a Segmented) sits beside the label on wide screens and under it on phones. */
export function SegmentedRow({ icon, label, children }: { icon?: LucideIcon; label: string; children: ReactNode }) {
  return (
    <li className={cn(separator(Boolean(icon)), "flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between")}>
      <span className="flex min-w-0 items-center gap-4">
        {icon ? <Tile icon={icon} /> : null}
        <span className="text-body leading-snug">{label}</span>
      </span>
      {children}
    </li>
  );
}

/** A form inside the dashboard's grouped look: a small header, the fields on a white group, a footer note. */
export function FieldGroup({
  id,
  title,
  titleId,
  description,
  footer,
  children,
}: {
  id?: string;
  title?: string;
  titleId?: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const autoId = useId();
  const headingId = titleId ?? autoId;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className="grid gap-2">
      {title ? (
        <h2 id={headingId} className="px-4 text-small font-semibold text-fg-secondary">
          {title}
        </h2>
      ) : null}
      <div className="grid gap-5 rounded-lg bg-group p-4 lg:border lg:border-line lg:p-6">
        {description ? <p className="text-small font-regular text-fg-secondary">{description}</p> : null}
        {children}
      </div>
      {footer ? <p className="px-4 text-small font-regular text-fg-secondary">{footer}</p> : null}
    </section>
  );
}

/**
 * The end of a form: an optional status, then the buttons, quiet one first and primary last (pass
 * `<Button size="md">`: 40 px with a mouse; here they grow to 48 px on touch screens). On phones they
 * fill the width and stack with the primary on top, as in the confirm dialog; on wider screens they
 * sit in a row at the end, the primary last.
 */
export function FormActions({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-line pt-4 sm:flex sm:items-center sm:justify-between">
      {status !== undefined ? <p className="text-small text-fg-secondary">{status}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:ms-auto sm:flex-row pointer-coarse:*:h-control-lg max-sm:*:w-full">{children}</div>
    </div>
  );
}
