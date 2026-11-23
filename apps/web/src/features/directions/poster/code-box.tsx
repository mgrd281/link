import type { BlockOf } from "@linkyo/blocks";
import { tintCode, type CodeTone, type CodeToken } from "@linkyo/blocks/project";
import { cn } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { CopyButton } from "../shared/copy-button";

type Code = NonNullable<BlockOf<"project">["code"]>;

/** Quiet toning: comments step back, strings take the page's accent text colour. Nothing else is coloured. */
const TONE: Record<CodeTone, string | undefined> = {
  plain: undefined,
  comment: "text-creator-fg-muted",
  string: "text-creator-accent-text",
};

/** The sample's tokens, line by line (a comment or string that runs over lines is split at each line end). */
export function codeLines(text: string, lang?: string): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const token of tintCode(text, lang)) {
    token.text.split("\n").forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines.at(-1)?.push({ text: part, tone: token.tone });
    });
  }
  return lines;
}

/**
 * A project's code sample: the file name as a caption, the lines numbered (a counter in a
 * pseudo-element, so the numbers are never copied), comments and strings toned, the copy button.
 * Code reads left to right on every page, Arabic included. A long line scrolls inside the box (a
 * focusable, named region, so a keyboard can scroll it too); the page itself never scrolls sideways.
 * The text in the box is exactly the owner's sample.
 */
export function CodeBox({ code, className }: { code: Code; className?: string | undefined }): ReactNode {
  const t = useTranslations("creator");
  const lines = codeLines(code.text, code.lang);
  const region = code.file ? t("portfolio.codeRegion", { file: code.file }) : t("portfolio.codeRegionPlain");
  return (
    <figure dir="ltr" data-code-box className={cn("grid min-w-0 grid-cols-1 overflow-hidden rounded-creator-card bg-creator-surface-2", className)}>
      <figcaption className="flex min-h-touch-target min-w-0 items-center justify-between gap-2 border-b border-creator-line ps-4 pe-1">
        <span className="min-w-0 truncate font-mono text-caption text-creator-fg-muted">{code.file ?? t("portfolio.codeSample")}</span>
        <CopyButton
          value={code.text}
          label={t("portfolio.copyCodeSample")}
          className="grid size-touch-target shrink-0 place-items-center rounded-md text-creator-fg hover:bg-creator-line"
        />
      </figcaption>
      <div role="region" aria-label={region} tabIndex={0} dir="ltr" className="min-w-0 overflow-x-auto rounded-b-creator-card focus-visible:focus-ring">
        <pre dir="ltr" className="w-max min-w-full p-4 font-mono text-small leading-normal">
          <code data-code className="poster-code-lines">
            {lines.map((line, index) => (
              // A line is its place in the sample (lines have no other identity); the line break
              // between two lines is real text, so the box's text is exactly the sample.
              <Fragment key={index}>
                <span data-line>
                  {line.map((token, at) => (
                    <span key={at} className={TONE[token.tone]}>
                      {token.text}
                    </span>
                  ))}
                </span>
                {index < lines.length - 1 ? "\n" : null}
              </Fragment>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
}
