import { tokens } from "@linkyo/tokens";
import { composite, contrastRatio } from "@linkyo/tokens/creator";
import { Badge, Logo, LogoSymbol, LogoWordmark } from "@linkyo/ui";
import { useTranslations } from "next-intl";

import { Section, Specimen, SubSection } from "./section";

const hex = (value: string) => value.toUpperCase();

/** Resolve a token color that may carry alpha (#RRGGBBAA) over a background. */
function flatten(color: string, background: string): string {
  if (color.length === 9) return composite(color.slice(0, 7), Number.parseInt(color.slice(7), 16) / 255, background);
  return color;
}

function Swatch({ name, value, hint }: { name: string; value: string; hint?: string }) {
  return (
    <figure className="grid gap-2">
      <div className="h-16 rounded-md border border-line" style={{ backgroundColor: value }} />
      <figcaption className="grid">
        <span className="text-small font-medium">{name}</span>
        <span className="font-mono text-caption text-fg-tertiary">{hex(value)}</span>
        {hint ? <span className="text-caption text-fg-secondary">{hint}</span> : null}
      </figcaption>
    </figure>
  );
}

export function BrandSection() {
  const t = useTranslations("design.brand");
  return (
    <Section id="brand" index="01" title={t("title")} description={t("description")}>
      <SubSection title={t("lockups")} note={t("lockupsNote")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen label={t("horizontal")}>
            <Logo className="h-10" />
          </Specimen>
          <Specimen label={t("symbolWordmark")}>
            <LogoSymbol className="h-12" />
            <LogoWordmark className="h-8" />
          </Specimen>
          <div className="flex min-h-24 items-center justify-center gap-8 rounded-lg bg-ink p-5 text-paper">
            <Logo className="h-8 text-paper" />
          </div>
          <div className="flex min-h-24 items-center justify-center gap-8 rounded-lg bg-primary p-5 text-paper">
            <Logo className="h-8 text-paper" />
          </div>
        </div>
      </SubSection>
      <SubSection title={t("appIcon")} note={t("appIconNote")}>
        <div className="flex flex-wrap items-end gap-6">
          {[
            { key: "light", bg: "bg-linear-to-br from-teal-700 to-teal-600", fg: "text-paper" },
            { key: "dark", bg: "bg-ink", fg: "text-teal-350" },
            { key: "tinted", bg: "bg-night-50", fg: "text-paper" },
          ].map((icon) => (
            <figure key={icon.key} className="grid justify-items-center gap-2">
              <div className={`grid size-avatar-2xl place-items-center rounded-xl ${icon.bg}`}>
                <LogoSymbol className={`size-avatar-lg ${icon.fg}`} />
              </div>
              <figcaption className="text-caption text-fg-secondary">{t(`icon.${icon.key}`)}</figcaption>
            </figure>
          ))}
          <figure className="grid justify-items-center gap-2">
            <div className="flex items-end gap-3">
              <LogoSymbol className="size-icon-sm" />
              <LogoSymbol className="size-icon-md" />
              <LogoSymbol className="size-icon-lg" />
              <LogoSymbol className="size-avatar-md" />
            </div>
            <figcaption className="text-caption text-fg-secondary">{t("minSize")}</figcaption>
          </figure>
        </div>
      </SubSection>
    </Section>
  );
}

const SCALES = ["teal", "gray", "night", "success", "warning", "danger", "lime"] as const;
const ROLES = [
  "canvas",
  "canvasMuted",
  "surface",
  "surfaceElevated",
  "fg",
  "fgSecondary",
  "fgTertiary",
  "primary",
  "link",
  "focus",
  "lineInput",
  "spark",
  "successStrong",
  "warningStrong",
  "dangerStrong",
] as const;
const TEXT_ROLES = new Set(["fg", "fgSecondary", "fgTertiary", "link", "successStrong", "warningStrong", "dangerStrong"]);

export function ColorSection() {
  const t = useTranslations("design.color");
  const s = tokens.semantic;
  return (
    <Section id="color" index="02" title={t("title")} description={t("description")}>
      <SubSection title={t("anchors")}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Swatch name="Ink" value={tokens.color.ink} hint={t("inkHint")} />
          <Swatch name="Paper" value={tokens.color.paper} hint={t("paperHint")} />
          <Swatch name="Linkyo Teal" value={tokens.color.teal["700"]} hint={t("violetHint")} />
          <Swatch name="Spark" value={tokens.color.lime["400"]} hint={t("sparkHint")} />
        </div>
      </SubSection>
      <SubSection title={t("scales")} note={t("scalesNote")}>
        <div className="grid gap-6">
          {SCALES.map((scale) => (
            <div key={scale} className="grid gap-2">
              <p className="text-small font-medium capitalize">{scale}</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-13">
                {Object.entries(tokens.color[scale]).map(([step, value]) => (
                  <figure key={step} className="grid gap-1">
                    <div className="h-10 rounded-sm border border-line" style={{ backgroundColor: value }} />
                    <figcaption className="grid">
                      <span className="text-caption font-medium">{step}</span>
                      <span className="font-mono text-caption text-fg-tertiary">{hex(value)}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SubSection>
      <SubSection title={t("roles")} note={t("rolesNote")}>
        <div className="overflow-x-auto rounded-lg border border-line" role="region" aria-label={t("roles")} tabIndex={0}>
          <table className="w-full min-w-prose text-start text-small">
            <caption className="sr-only">{t("roles")}</caption>
            <thead className="bg-canvas-muted text-fg-secondary">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {t("role")}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {t("light")}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {t("dark")}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {t("contrast")}
                </th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => {
                const value = s[role];
                const isText = TEXT_ROLES.has(role);
                const lightRatio = contrastRatio(flatten(value.light, s.surface.light), s.surface.light);
                const darkRatio = contrastRatio(flatten(value.dark, s.surface.dark), s.surface.dark);
                const min = isText ? 4.5 : 3;
                const showRatio = isText || role === "focus" || role === "lineInput" || role === "primary";
                return (
                  <tr key={role} className="border-t border-line">
                    <th scope="row" className="px-4 py-3 text-start font-mono text-caption font-regular">
                      {role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}
                    </th>
                    {[value.light, value.dark].map((v, i) => (
                      <td key={i} className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className={i === 0 ? "rounded-sm bg-paper p-1" : "rounded-sm bg-ink p-1"}>
                            <span
                              className="block size-icon-md rounded-xs border border-line"
                              style={{ backgroundColor: v }}
                            />
                          </span>
                          <span className="font-mono text-caption text-fg-secondary">{hex(v)}</span>
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {showRatio ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="font-mono text-caption">
                            {lightRatio.toFixed(1)} / {darkRatio.toFixed(1)}
                          </span>
                          <Badge size="sm" tone={lightRatio >= min && darkRatio >= min ? "success" : "danger"}>
                            {isText ? "AA 4.5" : "AA 3:1"}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-caption text-fg-tertiary">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SubSection>
    </Section>
  );
}

const TYPE_STEPS = ["display-xl", "display", "h1", "h2", "h3", "body-lg", "body", "small", "caption"] as const;
const typeClass: Record<(typeof TYPE_STEPS)[number], string> = {
  "display-xl": "text-display-xl",
  display: "text-display",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  "body-lg": "text-body-lg",
  body: "text-body",
  small: "text-small",
  caption: "text-caption",
};

export function TypeSection() {
  const t = useTranslations("design.type");
  const oneLiner = useTranslations("brand")("oneLiner");
  return (
    <Section id="type" index="03" title={t("title")} description={t("description")}>
      <SubSection title={t("scale")}>
        <div className="grid divide-y divide-line rounded-lg border border-line bg-surface">
          {TYPE_STEPS.map((step) => {
            const style = tokens.text[step.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as keyof typeof tokens.text];
            return (
              <div key={step} className="grid gap-2 p-5 md:grid-cols-4 md:items-baseline md:gap-6">
                <p className="font-mono text-caption text-fg-tertiary">
                  {step} · {style.fontSize}/{style.lineHeight} · {style.fontWeight}
                </p>
                <p className={`${typeClass[step]} min-w-0 break-words md:col-span-3`}>{oneLiner}</p>
              </div>
            );
          })}
        </div>
      </SubSection>
      <SubSection title={t("families")} note={t("familiesNote")}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-3 rounded-lg border border-line bg-surface p-5">
            <p className="text-display font-sans">Aa</p>
            <p className="text-small font-medium">Geist Sans</p>
            <p className="text-caption text-fg-secondary">{t("geist")}</p>
          </div>
          <div className="grid gap-3 rounded-lg border border-line bg-surface p-5">
            <p className="text-display font-mono">0→9</p>
            <p className="text-small font-medium">Geist Mono</p>
            <p className="text-caption text-fg-secondary">{t("geistMono")}</p>
          </div>
          <div className="grid gap-3 rounded-lg border border-line bg-surface p-5" lang="ar" dir="rtl">
            <p className="font-arabic text-display">رابط</p>
            <p className="font-arabic text-small font-medium">IBM Plex Sans Arabic</p>
            <p className="font-arabic text-caption text-fg-secondary">رابط واحد. لكل ما تصنعه.</p>
          </div>
        </div>
      </SubSection>
    </Section>
  );
}

export function LayoutSection() {
  const t = useTranslations("design.layout");
  const spacing = Object.entries(tokens.spacing)
    .filter(([key]) => /^\d/.test(key))
    .sort(([, a], [, b]) => a - b);
  return (
    <Section id="layout" index="04" title={t("title")} description={t("description")}>
      <SubSection title={t("spacing")} note={t("spacingNote")}>
        <div className="grid gap-2">
          {spacing.map(([key, value]) => (
            <div key={key} className="flex items-center gap-4">
              <span className="w-12 shrink-0 font-mono text-caption text-fg-tertiary">{key.replace("_", ".")}</span>
              <span className="w-12 shrink-0 font-mono text-caption">{value}</span>
              <span className="h-4 rounded-xs bg-primary" style={{ inlineSize: `var(--spacing-${key})` }} />
            </div>
          ))}
        </div>
      </SubSection>
      <SubSection title={t("radius")}>
        <div className="flex flex-wrap gap-4">
          {(Object.entries(tokens.radius) as [string, number][]).map(([key, value]) => (
            <figure key={key} className="grid justify-items-center gap-2">
              <div
                className="size-avatar-lg border border-line-strong bg-surface"
                style={{ borderRadius: `var(--radius-${key})` }}
              />
              <figcaption className="font-mono text-caption text-fg-secondary">
                {key} · {value}
              </figcaption>
            </figure>
          ))}
        </div>
      </SubSection>
      <SubSection title={t("depth")} note={t("depthNote")}>
        {/* No shadows (ADR 0037): the three ways a surface stands apart. */}
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="grid h-32 place-items-center rounded-lg border border-line bg-surface">
            <span className="font-mono text-small">border-line</span>
          </div>
          <div className="grid h-32 place-items-center rounded-lg border border-line-strong bg-surface">
            <span className="font-mono text-small">border-line-strong</span>
          </div>
          <div className="grid h-32 place-items-center rounded-lg bg-canvas-muted p-4">
            <span className="grid size-full place-items-center rounded-md bg-surface font-mono text-small">canvas-muted · surface</span>
          </div>
        </div>
      </SubSection>
      <SubSection title={t("grid")} note={t("gridNote")}>
        <div className="grid gap-3 rounded-lg border border-line bg-surface p-5 font-mono text-caption text-fg-secondary sm:grid-cols-2 lg:grid-cols-4">
          <p>creator · {tokens.layout.creator}</p>
          <p>sidebar · {tokens.layout.sidebar}</p>
          <p>content · {tokens.layout.content}</p>
          <p>preview · {tokens.layout.preview}</p>
          <p>gutter · {tokens.spacing.creatorGutter}</p>
          <p>touch · {tokens.size.touchTarget}</p>
          <p>xl · {tokens.breakpoint.xl}</p>
          <p>prose · {tokens.layout.prose}</p>
        </div>
      </SubSection>
    </Section>
  );
}
