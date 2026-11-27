import type { BlockOf } from "@linkyo/blocks";
import { contactStatus, linkLabelKey } from "@linkyo/blocks/project";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, Check, Download, FileText, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { LinkIconGlyph } from "../shared/link-icons";
import type { DocumentLink } from "./laufbahn-bar";
import { inkButton, inkFilled, StatusPill } from "./laufbahn-hero";
import { linkDestination } from "./sections";
import { ShareActionIsland } from "./share-island";
import { pageSide } from "./styles";

type Contact = BlockOf<"contact">;
type ContactLink = NonNullable<Contact["links"]>[number];

/** The icon of each kind of contact link. */
const ICONS = { email: "mail", phone: "phone", whatsapp: "chat", calendar: "calendar", cv: "file", link: "link" } as const;

/** A row of the band: an icon, the label quiet over its value, and where it leads (an arrow, or a download). */
const rowClass =
  "group flex min-h-control-xl w-full min-w-0 items-center gap-4 rounded-xs py-2 text-start font-semibold text-white focus-visible:focus-ring-inverse";
const valueClass = "min-w-0 break-words transition-colors duration-micro group-hover:lb-ink-muted motion-reduce:transition-none";

function Row({ icon, label, value, trail, ltr = false }: { icon: ReactNode; label: string | null; value: string; trail: "arrow" | "download" | null; ltr?: boolean }): ReactNode {
  return (
    <>
      <span aria-hidden className="grid size-control-md shrink-0 place-items-center rounded-full bg-hover-inverse">
        {icon}
      </span>
      <span className="grid min-w-0 flex-1">
        {label ? <span className="text-small font-regular lb-ink-muted">{label}</span> : null}
        {ltr ? (
          <bdi dir="ltr" className={cn(valueClass, "justify-self-start")}>
            {value}
          </bdi>
        ) : (
          <span dir="auto" className={cn(pageSide, valueClass)}>
            {value}
          </span>
        )}
      </span>
      {trail === "arrow" ? <Icon icon={ArrowUpRight} size="sm" className="shrink-0 lb-ink-muted rtl:-scale-x-100" /> : null}
      {trail === "download" ? <Icon icon={Download} size="sm" className="shrink-0 lb-ink-muted" /> : null}
    </>
  );
}

/**
 * The closing Kontakt band (ADR 0069 round 6): ink from edge to edge, as the head is. The owner's
 * availability, the closing line set large, their sentence and the one primary action in white; then
 * one list of ways to reach them (e-mail and telephone with their addresses, the other links), the
 * documents as downloads and "Share this page"; then the page's footer in the band's tone. Links are
 * in the body's colour, semibold, each with an icon, and never underlined; focus shows the white ring.
 * On the wide canvas what the owner says stands on seven columns and the list on the last five.
 */
export function LaufbahnContact({
  contact,
  now,
  documents,
  shareTitle,
  footer,
  rtl = false,
}: {
  contact: Contact;
  now: Date;
  /** The documents the page offers (useDocumentLinks). */
  documents: readonly DocumentLink[];
  /** The page's title for the share sheet (the owner's name). */
  shareTitle: string;
  /** The page's footer, in the band's tone. */
  footer: ReactNode;
  /** An Arabic page: the status's Latin runs (dates) in the template's Latin face. */
  rtl?: boolean | undefined;
}): ReactNode {
  const t = useTranslations("creator");
  const id = useId();
  const status = contactStatus(contact, now);
  const links = contact.links ?? [];
  const urls = [contact.primary.url, ...links.map((link) => link.url)];
  const email = urls.find((url) => url.toLowerCase().startsWith("mailto:"));
  const phone = urls.find((url) => url.toLowerCase().startsWith("tel:"));
  // The other links in the owner's order: the first e-mail and the first number have their own rows.
  const others = links.filter((link) => link.url !== email && link.url !== phone && !(link.kind === "cv" && documents.some((document) => document.own)));
  const label = (link: ContactLink): string => {
    if (link.label?.trim()) return link.label;
    switch (link.kind) {
      case "email":
        return t("portfolio.contactEmail");
      case "phone":
        return t("portfolio.contactPhone");
      case "whatsapp":
        return t("portfolio.contactWhatsapp");
      case "calendar":
        return t("portfolio.contactCalendar");
      case "cv":
        return t("portfolio.cv");
      case "link":
        return t(`portfolio.${linkLabelKey(link.url)}`);
    }
  };
  return (
    <div data-block={contact.id} data-lb-contact className="lb-ground text-white">
      <section
        aria-labelledby={id}
        className="grid gap-6 px-creator-gutter pt-12 pb-10 @prose:mx-auto @prose:max-w-prose @prose:px-0 @work:box-content @work:max-w-work @work:grid-cols-12 @work:items-end @work:gap-x-6 @work:px-creator-gutter @work:pt-24 @work:pb-16"
      >
        <div className="grid min-w-0 justify-items-start gap-6 @work:col-span-7">
          {status ? <StatusPill text={status} rtl={rtl} /> : null}
          <div className="grid min-w-0 gap-3">
            <h2 id={id} dir="auto" className={cn(pageSide, "font-creator-display text-h1 leading-tight font-bold tracking-display text-balance break-words rtl:leading-snug rtl:tracking-normal @work:text-display")}>
              {contact.title}
            </h2>
            {contact.text ? (
              <p dir="auto" className={cn(pageSide, "max-w-prose text-body-lg text-pretty lb-ink-muted")}>
                {contact.text}
              </p>
            ) : null}
          </div>
          <a href={contact.primary.url} className={cn(inkButton, inkFilled, "min-h-control-xl w-full @prose:w-auto")}>
            {contact.primary.icon ? <LinkIconGlyph icon={contact.primary.icon} size="md" className="shrink-0" /> : null}
            {/* The page's one primary action is never cut: a long label wraps. */}
            <span dir="auto" className="min-w-0 text-balance break-words">
              {contact.primary.label}
            </span>
          </a>
          {contact.steps?.length ? (
            <div className="grid w-full gap-3">
              <h3 className="text-small font-semibold lb-ink-muted">{t("portfolio.steps")}</h3>
              <ol className="grid grid-cols-1 gap-3">
                {contact.steps.map((step, index) => (
                  <li key={step} className="flex min-w-0 items-baseline gap-3">
                    {/* The list itself counts; the figure is its look. */}
                    <span aria-hidden className="text-caption font-semibold tabular-nums lb-ink-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span dir="auto" className={cn(pageSide, "min-w-0 text-body")}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
        <ul className="grid min-w-0 border-t border-hover-inverse pt-4 @work:col-span-5 @work:col-start-8">
          {email ? (
            <li>
              <a href={email} className={rowClass}>
                <Row icon={<LinkIconGlyph icon="mail" size="sm" />} label={t("laufbahn.email")} value={linkDestination(email)} trail="arrow" ltr />
              </a>
            </li>
          ) : null}
          {phone ? (
            <li>
              <a href={phone} className={rowClass}>
                <Row icon={<LinkIconGlyph icon="phone" size="sm" />} label={t("laufbahn.phone")} value={linkDestination(phone)} trail="arrow" ltr />
              </a>
            </li>
          ) : null}
          {others.map((link) => (
            <li key={`${link.kind}-${link.url}`}>
              <a href={link.url} className={rowClass}>
                <Row
                  icon={<LinkIconGlyph icon={ICONS[link.kind]} size="sm" />}
                  label={link.kind === "whatsapp" ? null : linkDestination(link.url)}
                  value={label(link)}
                  trail="arrow"
                />
              </a>
            </li>
          ))}
          {documents.map((document) => (
            <li key={document.href}>
              <a href={document.href} download={document.filename} data-app-download={document.own ? undefined : ""} aria-label={document.own ? undefined : document.rowName} className={rowClass}>
                <Row
                  icon={<Icon icon={FileText} size="sm" />}
                  label={null}
                  value={document.row}
                  trail={document.own ? "arrow" : "download"}
                />
              </a>
            </li>
          ))}
          <li>
            <ShareActionIsland
              title={shareTitle}
              label={t("laufbahn.sharePage")}
              className={cn(
                rowClass,
                "[&>span:last-child]:min-w-0 [&>span:last-child]:flex-1 [&>span:last-child]:transition-colors [&>span:last-child]:duration-micro hover:[&>span:last-child]:lb-ink-muted motion-reduce:[&>span:last-child]:transition-none",
              )}
              icons={{
                share: (
                  <span aria-hidden className="grid size-control-md shrink-0 place-items-center rounded-full bg-hover-inverse">
                    <Icon icon={Share} size="sm" />
                  </span>
                ),
                copied: (
                  <span aria-hidden className="grid size-control-md shrink-0 place-items-center rounded-full bg-hover-inverse">
                    <Icon icon={Check} size="sm" className="motion-safe:animate-pop-in" />
                  </span>
                ),
              }}
            />
          </li>
        </ul>
      </section>
      {footer}
    </div>
  );
}
