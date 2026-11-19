"use client";

import { detectMany } from "@linkyo/blocks";
import { Button, cn, Icon, Logo } from "@linkyo/ui";
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  BriefcaseBusiness,
  Check,
  CodeXml,
  DraftingCompass,
  Feather,
  GraduationCap,
  Megaphone,
  Mic,
  Music,
  Newspaper,
  Palette,
  PartyPopper,
  Presentation,
  Scale,
  ShoppingBag,
  Sparkles,
  Store,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { accountStore } from "@/features/account/store";
import { TemplatePicker } from "@/features/directions/poster/template-picker";
import { PlatformGlyph } from "@/features/directions/shared/creator-kit";
import { useRouter } from "@/i18n/navigation";

import { SwitchRow, TextArea, TextInput } from "./form";
import { ImportBox, useImport } from "./import-box";
import { sortImported } from "./import-links";
import { isKind, KINDS, SOCIAL_PREFIX, STARTERS, starterBlocks, type CreatorKind, type SocialPlatform, type StarterField } from "./kinds";
import { PhonePreview, PreviewButton } from "./preview";
import { ProfileFields, useProfileDraft } from "./profile-form";
import { QrButton, ShareButtons } from "./share-tools";
import { useSite } from "./site-context";

const STEPS = ["kind", "you", "look", "links", "done"] as const;
type Step = (typeof STEPS)[number];

const KIND_ICONS: Partial<Record<CreatorKind, LucideIcon>> = {
  podcast: Mic,
  affiliate: BadgePercent,
  marketing: Megaphone,
  coach: Presentation,
  developer: CodeXml,
  designer: Palette,
  writer: Feather,
  journalist: Newspaper,
  business: BriefcaseBusiness,
  shop: Store,
  store: ShoppingBag,
  engineer: DraftingCompass,
  lawyer: Scale,
  student: GraduationCap,
  warehouse: Warehouse,
  music: Music,
  other: Sparkles,
};

function KindIcon({ kind }: { kind: CreatorKind }): ReactNode {
  if (kind === "tiktok" || kind === "instagram" || kind === "youtube") return <PlatformGlyph platform={kind} size="lg" />;
  if (kind === "streamer") return <PlatformGlyph platform="twitch" size="lg" />;
  const icon = KIND_ICONS[kind];
  return icon ? <Icon icon={icon} size="lg" /> : null;
}

/** Text fields per question (switches are rendered as switch rows). */
const TEXT_FIELDS: Partial<Record<StarterField, { multiline?: boolean; type?: "url" | "tel" | "email" }>> = {
  address: {},
  phone: { type: "tel" },
  hours: { multiline: true },
  shopUrl: { type: "url" },
  website: { type: "url" },
  booking: { type: "url" },
  email: { type: "email" },
  book: { type: "url" },
  cv: { type: "url" },
};

/**
 * Welcome: five short steps from an empty account to a page worth sharing, with the page building
 * itself in the phone next to the form. It starts with what the page is for (TikTok, shop, writer …):
 * that picks a fitting template and the few questions that matter. Every step can be skipped.
 */
export function WelcomeScreen() {
  const t = useTranslations("app.welcome");
  const tTypes = useTranslations("dashboard.types");
  const router = useRouter();
  const tKinds = useTranslations("app.welcome.kinds");
  const tFields = useTranslations("app.welcome.fields");
  const tBlocks = useTranslations("app.welcome.blocks");
  const { doc, dispatch, account, site, enrich } = useSite();
  const [step, setStep] = useState<Step>("kind");
  const profile = useProfileDraft();
  const [kind, setKind] = useState<CreatorKind | null>(isKind(site.kind) ? site.kind : null);
  const starter = STARTERS[kind ?? "other"];
  const [handles, setHandles] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [values, setValues] = useState<Partial<Record<StarterField, string>>>({});
  const [switches, setSwitches] = useState<Partial<Record<StarterField, boolean>>>({});
  const [links, setLinks] = useState("");
  const index = STEPS.indexOf(step);
  const importer = useImport({
    onLinks: (found) => {
      const sorted = sortImported(found, starter.socials, handles);
      setHandles((current) => ({ ...current, ...sorted.handles }));
      const pasted = new Set(links.split(/\s+/).filter(Boolean));
      const added = sorted.links.filter((url) => !pasted.has(url));
      setLinks((current) => [current.trim(), ...added].filter(Boolean).join("\n"));
      return { profiles: Object.keys(sorted.handles).length, links: added.length };
    },
  });
  // Moving between steps puts focus on the new step's title (after it is on screen).
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (moved) document.getElementById("welcome-step")?.focus();
  }, [moved, step]);
  const detected = useMemo(() => detectMany(links), [links]);
  const labels = useMemo(() => ({ video: tTypes("video"), music: tTypes("music"), event: tTypes("events") }), [tTypes]);

  const finish = (to: "/app" | "/app/editor" | "/app/preview") => {
    accountStore.updateSite((site) => ({ ...site, onboarded: true }));
    router.replace(to);
  };

  /** Picking a kind applies its template right away (the phone shows it) and remembers the choice. */
  const choose = (next: CreatorKind) => {
    setKind(next);
    dispatch({ type: "theme", theme: STARTERS[next].theme });
    accountStore.updateSite((current) => ({ ...current, kind: next }));
  };

  const next = () => {
    if (step === "you" && !profile.save(t("nameRequired"))) return;
    if (step === "links") {
      const blocks = starterBlocks(
        { kind: kind ?? "other", handles, values, switches, links },
        {
          directions: (address) => tBlocks("directions", { address }),
          call: tBlocks("call"),
          hours: tBlocks("hours"),
          shop: tBlocks("shop"),
          website: tBlocks("website"),
          booking: tBlocks("booking"),
          contact: tBlocks("contact"),
          book: tBlocks("book"),
          cv: tBlocks("cv"),
          newsletter: tBlocks("newsletter"),
          liveTitle: tBlocks("liveTitle"),
          detection: labels,
          artist: doc.profile.displayName,
        },
      ).filter((block) => block.type !== "socials" || !doc.blocks.some((existing) => existing.type === "socials"));
      blocks.forEach((block, i) => dispatch({ type: "add", block, index: i }));
      // Songs and videos get their real title and picture a moment later.
      enrich(blocks);
    }
    const following = STEPS[index + 1];
    if (following) {
      setStep(following);
      setMoved(true);
    }
  };
  const back = () => {
    const previous = STEPS[index - 1];
    if (previous) {
      setStep(previous);
      setMoved(true);
    }
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas text-fg xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-4 px-5 pt-4 md:px-10">
          <Logo className="h-6" title="Linkyo" />
          <div className="ms-auto flex items-center gap-2">
            <PreviewButton className="xl:hidden" />
            {step !== "done" ? (
              <Button variant="ghost" onClick={() => finish("/app")}>
                {t("skip")}
              </Button>
            ) : null}
          </div>
        </header>

        <main id="main" className="mx-auto grid w-full max-w-prose flex-1 grid-cols-1 content-start gap-8 px-5 pt-8 pb-32 md:px-10">
          <ol aria-label={t("progress")} className="grid grid-cols-5 gap-2">
            {STEPS.map((key, i) => (
              <li key={key} className="grid grid-cols-1 gap-2">
                <span aria-hidden className={cn("h-1 rounded-full transition-colors duration-standard", i <= index ? "bg-primary" : "bg-line-strong")} />
                <span className={cn("flex items-center gap-1 text-caption font-medium", i === index ? "text-fg" : "text-fg-tertiary")} aria-current={i === index ? "step" : undefined}>
                  {i < index ? <Icon icon={Check} size="sm" className="text-success-strong" /> : null}
                  {t(`steps.${key}.short`)}
                </span>
              </li>
            ))}
          </ol>

          <div className="grid grid-cols-1 gap-2">
            <p className="text-small font-medium text-fg-secondary">{t("stepOf", { n: index + 1, total: STEPS.length })}</p>
            <h1 id="welcome-step" tabIndex={-1} className="text-h1 tracking-tight outline-none">
              {t(`steps.${step}.title`, { name: doc.profile.displayName })}
            </h1>
            <p className="text-body text-fg-secondary">{t(`steps.${step}.lead`)}</p>
          </div>

          {step === "kind" ? (
            <fieldset className="grid min-w-0 grid-cols-1 gap-3">
              <legend className="sr-only">{t("steps.kind.title")}</legend>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {KINDS.map((option) => (
                  <label
                    key={option}
                    className={cn(
                      "relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors duration-micro has-[:focus-visible]:focus-ring hover:bg-hover sm:p-4",
                      kind === option ? "border-focus bg-selected" : "border-line bg-surface",
                    )}
                  >
                    <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => choose(option)} className="sr-only" />
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("grid size-control-lg place-items-center rounded-md", kind === option ? "bg-surface-elevated text-selected-fg" : "bg-canvas-muted text-fg")}>
                        <KindIcon kind={option} />
                      </span>
                      {kind === option ? <Icon icon={Check} size="md" className="text-link" /> : null}
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <span className="text-body font-semibold">{tKinds(`${option}.label`)}</span>
                      <span className="text-caption text-fg-secondary">{tKinds(`${option}.description`)}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-small text-fg-tertiary">{t("kindLater")}</p>
            </fieldset>
          ) : null}

          {step === "you" ? (
            <ProfileFields
              profile={profile.profile}
              onChange={profile.change}
              errors={profile.errors}
              nameLabel={tKinds(`${kind ?? "other"}.name`)}
              taglineHint={tKinds(`${kind ?? "other"}.taglineHint`)}
            />
          ) : null}

          {step === "look" ? (
            <div className="grid grid-cols-1 gap-3">
              <TemplatePicker value={doc.theme.template} profile={doc.profile} onChange={(template) => dispatch({ type: "theme", theme: { template } })} />
              {kind && doc.theme.template === STARTERS[kind].theme.template ? (
                <p className="flex items-center gap-2 text-small font-medium text-link">
                  <Icon icon={Sparkles} size="sm" />
                  {t("lookSuggested", { kind: tKinds(`${kind}.label`) })}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "links" ? (
            <div className="grid grid-cols-1 gap-6">
              <ImportBox importer={importer} />
              <fieldset className="grid min-w-0 grid-cols-1 gap-3">
                <legend className="mb-3 text-body font-semibold">{t("socials")}</legend>
                {starter.socials.map((platform) => (
                  <label key={platform} className="grid grid-cols-1 gap-2">
                    <span className="text-small">{t(`platforms.${platform}`)}</span>
                    <span dir="ltr" className="flex h-control-lg items-center rounded-md border border-line-input bg-surface-elevated px-3 focus-within:border-focus focus-within:focus-ring">
                      <span className="shrink-0 text-fg-tertiary select-none">{SOCIAL_PREFIX[platform]}</span>
                      <input
                        value={handles[platform] ?? ""}
                        onChange={(event) => setHandles((current) => ({ ...current, [platform]: event.target.value }))}
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode={platform === "whatsapp" ? "tel" : undefined}
                        className="h-full min-w-0 flex-1 bg-transparent text-body outline-none"
                      />
                    </span>
                  </label>
                ))}
              </fieldset>
              {starter.fields.length ? (
                <fieldset className="grid min-w-0 grid-cols-1 gap-4">
                  <legend className="mb-3 text-body font-semibold">{tKinds(`${kind ?? "other"}.extras`)}</legend>
                  {starter.fields.map((field) => {
                    const spec = TEXT_FIELDS[field];
                    if (!spec) {
                      return (
                        <SwitchRow
                          key={field}
                          label={tFields(`${field}.label`)}
                          description={tFields(`${field}.hint`)}
                          checked={switches[field] ?? false}
                          onChecked={(checked) => setSwitches((current) => ({ ...current, [field]: checked }))}
                        />
                      );
                    }
                    if (spec.multiline) {
                      return (
                        <TextArea
                          key={field}
                          label={tFields(`${field}.label`)}
                          hint={tFields(`${field}.hint`)}
                          value={values[field] ?? ""}
                          onValue={(value) => setValues((current) => ({ ...current, [field]: value }))}
                          max={600}
                          rows={3}
                        />
                      );
                    }
                    return (
                      <TextInput
                        key={field}
                        label={tFields(`${field}.label`)}
                        hint={tFields(`${field}.hint`)}
                        value={values[field] ?? ""}
                        onValue={(value) => setValues((current) => ({ ...current, [field]: value }))}
                        type={spec.type}
                        ltr={spec.type !== undefined}
                        inputMode={spec.type}
                        autoCapitalize={spec.type ? "none" : undefined}
                        spellCheck={spec.type ? false : undefined}
                        maxLength={field === "address" ? 100 : 200}
                      />
                    );
                  })}
                </fieldset>
              ) : null}
              <div className="grid grid-cols-1 gap-2">
                <TextArea
                  label={tKinds(`${kind ?? "other"}.links`)}
                  hint={tKinds(`${kind ?? "other"}.linksHint`)}
                  value={links}
                  onValue={setLinks}
                  max={2000}
                  rows={4}
                  dir="ltr"
                  placeholder="https://"
                />
                {detected.length ? (
                  <ul className="flex flex-wrap gap-2" aria-label={t("found")}>
                    {detected.map((detection) => (
                      <li key={detection.url} className="inline-flex h-control-sm items-center gap-2 rounded-full bg-selected px-3 text-small text-selected-fg">
                        <Icon icon={Check} size="sm" />
                        {tTypes(detection.type === "shorts" ? "link" : detection.type)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="grid grid-cols-1 gap-6">
              <div className="grid justify-items-start gap-4 rounded-xl border border-line bg-surface p-5 shadow-e1">
                <span className="grid size-control-xl place-items-center rounded-full bg-success-subtle text-success-strong">
                  <Icon icon={PartyPopper} size="lg" />
                </span>
                <p dir="ltr" className="text-h3 font-semibold">
                  linkyo.app/<span className="text-link">{account.username}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <ShareButtons username={account.username} compact />
                  <QrButton username={account.username} compact />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="primary" size="xl" onClick={() => finish("/app/editor")}>
                  {t("toEditor")}
                </Button>
                <Button size="xl" onClick={() => finish("/app")}>
                  {t("toDashboard")}
                </Button>
              </div>
            </div>
          ) : null}
        </main>

        {step !== "done" ? (
          <footer className="layer-sticky sticky bottom-0 border-t border-line bg-canvas px-5 pt-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))] md:px-10">
            <div className="mx-auto flex max-w-prose items-center gap-2">
              {index > 0 ? (
                <Button variant="ghost" size="lg" icon={ArrowLeft} onClick={back} className="[&_svg]:rtl:-scale-x-100">
                  {t("back")}
                </Button>
              ) : null}
              <Button variant="primary" size="xl" className="ms-auto min-w-0 flex-1 sm:flex-none" onClick={next} trailing={<Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />}>
                {step === "links" ? t("finish") : t("continue")}
              </Button>
            </div>
          </footer>
        ) : null}
      </div>

      <aside aria-label={t("previewLabel")} className="sticky top-0 hidden h-dvh w-preview box-content border-s border-line bg-canvas-muted p-6 xl:grid">
        <PhonePreview className="h-full" />
      </aside>
    </div>
  );
}
