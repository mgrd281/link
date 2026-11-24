"use client";

import { detectMany, slugWord, type BlockOf } from "@linkyo/blocks";
import { TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { Badge, Button, cn, Icon, Logo, Skeleton, TextField, toast } from "@linkyo/ui";
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  BriefcaseBusiness,
  Camera,
  Check,
  CircleCheck,
  CodeXml,
  DraftingCompass,
  Feather,
  Footprints,
  Gamepad2,
  GraduationCap,
  Laptop,
  Lightbulb,
  Megaphone,
  Mic,
  Music,
  Newspaper,
  Palette,
  PartyPopper,
  Presentation,
  Scale,
  Shapes,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { clearTryDraft, readTryDraft } from "@/features/account/try-draft";
import { useUsernameStatus } from "@/features/account/auth/shared";
import { accountStore } from "@/features/account/store";
import type { AuthError } from "@/features/account/types";
import { isProvisionalUsername, nameFromUsername, suggestUsername } from "@/features/account/username";
import { useAiQuota } from "@/features/ai/quota";
import { takeAppliedDraft } from "@/features/ai/use-ai-run";
import { TemplatePicker } from "@/features/directions/poster/template-picker";
import { PlatformGlyph } from "@/features/directions/shared/creator-kit";
import { useRouter } from "@/i18n/navigation";
import { CREATOR_DOMAIN } from "@/lib/page-url";

import { SwitchRow, TextArea, TextInput } from "./form";
import { ImportBox, useImport } from "./import-box";
import { changeAddress } from "@/features/creator/refresh";

import { sortImported } from "./import-links";
import {
  isKind,
  isPortfolioKind,
  KINDS,
  lookOrder,
  proofProblem,
  SOCIAL_PREFIX,
  STARTERS,
  starterBlocks,
  starterFields,
  titleKeys,
  welcomeSteps,
  type CreatorKind,
  type ProofRow,
  type SocialPlatform,
  type StarterField,
  type WelcomeStep,
} from "./kinds";
import { PhonePreview, PreviewButton } from "./preview";
import { ProfileFields, useProfileDraft } from "./profile-form";
import { ReachInput, type ReachValue } from "./reach-input";
import { QrButton, ShareButtons } from "./share-tools";
import { useSite } from "./site-context";
import { asksForCovers, emptyProof, PortfolioMade, proofField, ProofStep, type Made } from "./welcome-portfolio";

/** The steps every kind shares, each with its own title and lead (`app.welcome.steps.*`). */
type SharedStep = Exclude<WelcomeStep, "proof" | "action">;

/** Progress labels: six for portfolio kinds, five for everyone else (class names stay whole for Tailwind). */
const PROGRESS_COLUMNS: Record<number, string> = { 5: "grid-cols-5", 6: "grid-cols-6" };

const KIND_ICONS: Partial<Record<CreatorKind, LucideIcon>> = {
  podcast: Mic,
  affiliate: BadgePercent,
  marketing: Megaphone,
  coach: Presentation,
  apps: Smartphone,
  developer: CodeXml,
  designer: Palette,
  photographer: Camera,
  freelancer: Laptop,
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
  // A streamer is not only on Twitch: the kind gets an outline glyph, not a platform's logo.
  streamer: Gamepad2,
  other: Shapes,
};

/**
 * Brand logos only for the platform kinds, drawn a step smaller (icon-md) than the outline icons
 * (icon-lg) in the same tile: a solid logo carries more weight, so both read alike.
 */
function KindIcon({ kind }: { kind: CreatorKind }): ReactNode {
  if (kind === "tiktok" || kind === "instagram" || kind === "youtube") return <PlatformGlyph platform={kind} size="md" />;
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
 * Portfolio kinds (designer, photographer, developer, engineer, freelancer) get six: instead of links
 * they are asked for three pieces of work and one way to reach them, and end on a filled portfolio.
 */
export function WelcomeScreen() {
  const t = useTranslations("app.welcome");
  const tTypes = useTranslations("dashboard.types");
  const router = useRouter();
  const tKinds = useTranslations("app.welcome.kinds");
  const tFields = useTranslations("app.welcome.fields");
  const tBlocks = useTranslations("app.welcome.blocks");
  const tPortfolio = useTranslations("app.portfolio");
  const tApp = useTranslations("app");
  const tAi = useTranslations("app.ai");
  const { doc, dispatch, account, site, enrich, latest } = useSite();
  const params = useSearchParams();
  // Back from an AI draft that was used: only the "you" step is left (name and address).
  const fromAi = params.get("from") === "ai";
  // "Continue without AI" lands here: straight into the five steps.
  const manual = params.get("manual") === "1";
  const ai = useAiQuota({ account: account.id });
  // Step 0, "How do you want to start?": only while the AI is on for this account.
  const [started, setStarted] = useState(false);
  const [start, setStart] = useState<"ai" | "manual">("ai");
  const asking = !fromAi && !manual && !started;
  const showStart = asking && ai.enabled;
  const waitingForAi = asking && ai.status === "loading";
  const [step, setStep] = useState<WelcomeStep>(fromAi ? "you" : "kind");
  const profile = useProfileDraft();
  const tAuth = useTranslations("auth");
  const [address, setAddress] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<AuthError | null>(null);
  // People who did not claim an address get a neutral one at sign-up; here it follows their name.
  const provisional = isProvisionalUsername(account.username);
  const addressValue = (address ?? (provisional ? suggestUsername(profile.profile.displayName) : account.username)).trim().toLowerCase();
  const addressStatus = useUsernameStatus(addressValue, account.username);
  const addressProblem = addressError ?? (addressValue.length >= 3 && addressStatus && addressStatus !== "ok" && addressStatus !== "checking" ? addressStatus : null);
  // A name that is still the address is only a placeholder: a neutral address leaves the field empty
  // (the address then follows what they type), a chosen one becomes a name ("mila-aurel" → "Mila Aurel").
  const named = useRef(false);
  useEffect(() => {
    if (named.current) return;
    named.current = true;
    if (profile.profile.displayName !== account.username) return;
    profile.change({ ...profile.profile, displayName: provisional ? "" : nameFromUsername(account.username) });
  }, [profile, account.username, provisional]);
  const [kind, setKind] = useState<CreatorKind | null>(isKind(site.kind) ? site.kind : null);
  const starter = STARTERS[kind ?? "other"];
  const steps = welcomeSteps(kind);
  const portfolio = kind !== null && isPortfolioKind(kind);
  // Real accounts have no newsletter yet: the switch is not offered (as in the Add sheet).
  const fields = starterFields(kind ?? "other", { newsletter: accountStore.demo });
  // The questions asked as fields of their own (the work and the contact are steps of their own).
  const extras = fields.filter((field) => field !== "proof" && field !== "action");
  const [handles, setHandles] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [values, setValues] = useState<Partial<Record<StarterField, string>>>({});
  const [switches, setSwitches] = useState<Partial<Record<StarterField, boolean>>>({});
  // Portfolio kinds: three pieces of work, then the page's one button.
  const [proof, setProof] = useState<ProofRow[]>(emptyProof);
  const [proofProblems, setProofProblems] = useState<("title" | "summary" | null)[]>([]);
  const [reach, setReach] = useState<ReachValue>({ label: "", url: "" });
  // The button's words, when an address was typed and its words were cleared (no button without them).
  const [reachLabelError, setReachLabelError] = useState<string | undefined>(undefined);
  // What the flow put on the page, for the done step's honest list.
  const [made, setMade] = useState<Made | null>(null);
  // Coming from the homepage playground: its links wait in the links step, its look stays.
  const [tried] = useState(readTryDraft);
  const [links, setLinks] = useState(() => tried?.links.join("\n") ?? "");
  const index = Math.max(0, steps.indexOf(step));
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
  // The playground's draft is used once: its photo and line go onto the page, and its whole look
  // (also for sign-ups that did not pass through the email form, like Google).
  useEffect(() => {
    if (!tried) return;
    clearTryDraft();
    // An AI draft that was just used already has its look and words.
    if (fromAi) return;
    if (tried.theme) dispatch({ type: "theme", theme: tried.theme });
    const patch = {
      ...(tried.photo ? { avatar: { src: tried.photo.src, alt: "", tone: tried.photo.tone } } : {}),
      ...(tried.tagline ? { tagline: tried.tagline } : {}),
    };
    if (Object.keys(patch).length > 0) dispatch({ type: "profile", patch });
  }, [tried, dispatch, fromAi]);
  // A link typed into the homepage's AI field skips the choice: the build screen starts from it.
  useEffect(() => {
    if (asking && ai.enabled && tried?.aiLink) router.replace(`/app/build?link=${encodeURIComponent(tried.aiLink)}`);
  }, [asking, ai.enabled, tried, router]);
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
    // A look chosen in the playground is kept; otherwise the kind brings its own.
    if (!tried) dispatch({ type: "theme", theme: STARTERS[next].theme });
    accountStore.updateSite((current) => ({ ...current, kind: next }));
  };

  const next = async () => {
    if (step === "you") {
      if (addressProblem) {
        document.getElementById("welcome-address")?.focus();
        return;
      }
      if (!profile.save(t("nameRequired"))) return;
      if (addressValue && addressValue !== account.username) {
        // Like the address screen in Settings: the cached page at the old address is dropped at once.
        const result = await changeAddress(addressValue, account.username, (value) => accountStore.changeUsername(value));
        if (!result.ok) {
          setAddressError(result.error);
          document.getElementById("welcome-address")?.focus();
          return;
        }
      }
      if (fromAi) {
        // The draft's page goes public now, under the address just picked; Undo brings back the page
        // as it was before the draft (one step, or the whole page after more changes).
        const handoff = takeAppliedDraft();
        finish("/app");
        toast({
          title: tAi("applied"),
          tone: "success",
          action: {
            label: tApp("undo"),
            onAction: () => dispatch(handoff && latest() !== handoff.applied ? { type: "replace", doc: handoff.before } : { type: "undo" }),
          },
        });
        return;
      }
    }
    if (step === "proof") {
      // A started piece of work needs its title and its sentence; the first gap gets the focus.
      const problems = proof.map(proofProblem);
      setProofProblems(problems);
      const first = problems.findIndex((problem) => problem !== null);
      const problem = problems[first];
      if (problem) {
        proofField(first, problem)?.focus();
        return;
      }
    }
    if (step === "action") {
      // An address typed that leads nowhere is not dropped quietly: the field says why (reach-input).
      const typed = document.querySelector<HTMLInputElement>("#welcome-reach [id$='-address']");
      if (typed && typed.value.trim() !== "" && !reach.url) {
        typed.focus();
        return;
      }
      // A good address with its words cleared would make no button (starterBlocks needs both): asked for.
      if (reach.url && reach.label.trim() === "") {
        setReachLabelError(tApp("errors.required"));
        document.querySelector<HTMLInputElement>("#welcome-reach [id$='-label']")?.focus();
        return;
      }
    }
    // The last step with questions makes the page.
    if (step === steps[steps.length - 2]) {
      const who = kind ?? "other";
      const blocks = starterBlocks(
        {
          kind: who,
          handles,
          values,
          switches,
          links,
          proof,
          // A page has one contact block: one that is already there stays the only one.
          reach: doc.blocks.some((block) => block.type === "contact") ? undefined : reach,
          taken: doc.blocks.flatMap((block) => (block.type === "project" ? [block.slug, ...(block.was ?? [])] : [])),
          slugWord: slugWord(doc.profile.locale),
          newsletter: accountStore.demo,
        },
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
          work: tPortfolio(titleKeys(who).work),
          closing: tPortfolio("contact.closing"),
        },
      ).filter((block) => block.type !== "socials" || !doc.blocks.some((existing) => existing.type === "socials"));
      const contact = blocks.find((block): block is BlockOf<"contact"> => block.type === "contact");
      blocks.filter((block) => block !== contact).forEach((block, i) => dispatch({ type: "add", block, index: i }));
      // The contact block closes the page, below anything that was there before.
      if (contact) dispatch({ type: "add", block: contact });
      // The starter page is not a fresh addition: the editor opens without a highlight.
      dispatch({ type: "select", id: null });
      // Songs and videos get their real title and picture a moment later.
      enrich(blocks);
      setMade({ projects: blocks.filter((block) => block.type === "project").length, contact: contact?.primary.label ?? null });
    }
    const following = steps[index + 1];
    if (following) {
      setStep(following);
      setMoved(true);
    }
  };
  const back = () => {
    const previous = steps[index - 1];
    if (previous) {
      setStep(previous);
      setMoved(true);
    }
  };

  // The step's title and lead: the shared steps have their own; a portfolio's work, contact and
  // done steps use the portfolio's words.
  const name = doc.profile.displayName;
  const shared = (key: SharedStep) => ({ title: t(`steps.${key}.title`, { name }), lead: t(`steps.${key}.lead`, { designs: TEMPLATE_IDS.length }) as ReactNode });
  const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
  const heading =
    step === "proof"
      ? { title: t("portfolio.proofTitle"), lead: t(kind && asksForCovers(kind) ? "portfolio.proofLeadVisual" : "portfolio.proofLead") }
      : step === "action"
        ? { title: t("portfolio.actionTitle"), lead: t("portfolio.actionLead") }
        : step === "done" && portfolio
          ? { title: t("portfolio.doneTitle", { name }), lead: t.rich("portfolio.doneLead", { bdi }) }
          : shared(step);

  // Shared by the links step and a portfolio's contact step.
  const socialsFieldset = (
    <fieldset className="grid min-w-0 grid-cols-1 gap-3">
      <legend className="mb-3 text-body font-semibold">{t("socials")}</legend>
      {starter.socials.map((platform) => (
        <label key={platform} className="grid grid-cols-1 gap-2">
          <span className="text-small">{t(`platforms.${platform}`)}</span>
          <span dir="ltr" className="flex h-control-lg items-center gap-2 rounded-md border border-line-input bg-surface-elevated px-3 focus-within:border-focus focus-within:focus-field">
            {/* The platform's glyph leads its field, as in the Add sheet and the editor. */}
            <PlatformGlyph platform={platform} size="sm" className="text-fg-secondary" />
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
  );
  const extrasFieldset = extras.length ? (
    <fieldset className="grid min-w-0 grid-cols-1 gap-4">
      <legend className="mb-3 text-body font-semibold">{tKinds(`${kind ?? "other"}.extras`)}</legend>
      {extras.map((field) => {
        const spec = TEXT_FIELDS[field];
        // A hint with no words (the website's) is not rendered at all.
        const hint = tFields(`${field}.hint`) || undefined;
        if (!spec) {
          return (
            <SwitchRow
              key={field}
              label={tFields(`${field}.label`)}
              description={hint}
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
              hint={hint}
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
            hint={hint}
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
  ) : null;
  const linksField = (
    // The links field: Linktree's "paste your links" answer brings focus here.
    <div id="welcome-links" className="grid grid-cols-1 gap-2">
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
  );

  return (
    // data-console="frame": the welcome flow is part of the dashboard, black and grey (ADR 0062).
    <div data-console="frame" className="grid min-h-dvh grid-cols-1 bg-canvas text-fg xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-4 px-5 pt-4 md:px-10">
          <Logo className="h-6" title="Linkyo" tone="mono" />
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
          {showStart ? (
            // Step 0: with AI from the owner's links, or the five steps by hand.
            <fieldset className="grid min-w-0 grid-cols-1 gap-6">
              <legend className="sr-only">{t("start.label")}</legend>
              <h1 id="welcome-step" tabIndex={-1} className="text-h1 tracking-tight outline-none rtl:tracking-normal">
                {t("start.title")}
              </h1>
              <div className="grid grid-cols-1 gap-3">
                {(["ai", "manual"] as const).map((option) => (
                  <label
                    key={option}
                    className={cn(
                      "relative flex min-w-0 cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors duration-micro has-[:focus-visible]:focus-ring hover:bg-hover sm:p-5",
                      start === option ? "border-focus bg-selected" : "border-line bg-surface",
                    )}
                  >
                    <input type="radio" name="welcome-start" value={option} checked={start === option} onChange={() => setStart(option)} className="sr-only" />
                    <span className={cn("grid size-control-lg shrink-0 place-items-center rounded-md", start === option ? "bg-surface-elevated text-selected-fg" : "bg-canvas-muted text-fg")}>
                      <Icon icon={option === "ai" ? Sparkles : Footprints} size="md" />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-body-lg font-semibold">{t(`start.${option}.title`)}</span>
                        {option === "ai" ? <Badge size="sm">{t("start.ai.badge")}</Badge> : null}
                      </span>
                      <span className="text-small text-fg-secondary">{t(`start.${option}.body`)}</span>
                      {option === "ai" && ai.quota?.plan === "free" && ai.quota.left > 0 ? (
                        <span className="flex items-center gap-1 text-small font-medium">
                          <Icon icon={Check} size="sm" />
                          {t("start.ai.free")}
                        </span>
                      ) : null}
                    </span>
                    {start === option ? <Icon icon={Check} size="md" className="shrink-0 text-link" /> : null}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : waitingForAi ? (
            <div aria-hidden className="grid grid-cols-1 gap-3">
              <Skeleton className="h-10 w-2/3 rounded-md" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : (
            <>
          {fromAi ? null : (
          <ol aria-label={t("progress")} className={cn("grid gap-2", PROGRESS_COLUMNS[steps.length])}>
            {steps.map((key, i) => (
              <li key={key} className="grid grid-cols-1 gap-2">
                <span aria-hidden className={cn("h-1 rounded-full transition-colors duration-standard", i <= index ? "bg-primary" : "bg-line-strong")} />
                <span className={cn("flex items-center gap-1 text-caption font-medium", i === index ? "text-fg" : "text-fg-tertiary")} aria-current={i === index ? "step" : undefined}>
                  {/* Six labels share a phone's width: there the filled bar alone marks a step as done. */}
                  {i < index ? <Icon icon={Check} size="sm" className={cn("text-success-strong", steps.length > 5 && "max-sm:hidden")} /> : null}
                  {t(`steps.${key}.short`)}
                </span>
              </li>
            ))}
          </ol>
          )}

          <div className="grid grid-cols-1 gap-2">
            {fromAi ? (
              <p className="flex items-start gap-2 text-small font-medium">
                <Icon icon={Sparkles} size="sm" className="mt-0.5 shrink-0" />
                {t("fromAi.lead")}
              </p>
            ) : (
              <p className="text-small font-medium text-fg-secondary">{t("stepOf", { n: index + 1, total: steps.length })}</p>
            )}
            <h1 id="welcome-step" tabIndex={-1} className="text-h1 tracking-tight outline-none">
              {heading.title}
            </h1>
            {/* The look step counts the designs from the tokens, so the sentence never goes stale. */}
            <p className="text-body text-fg-secondary">{heading.lead}</p>
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
                      <span className={cn("grid size-control-md place-items-center rounded-md", kind === option ? "bg-surface-elevated text-selected-fg" : "bg-canvas-muted text-fg")}>
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
            <div className="grid grid-cols-1 gap-5">
              <ProfileFields
                profile={profile.profile}
                onChange={profile.change}
                errors={profile.errors}
                onCheck={profile.check}
                nameLabel={tKinds(`${kind ?? "other"}.name`)}
                taglineHint={tKinds(`${kind ?? "other"}.taglineHint`)}
                withLanguage
              />
              {/* The page address: the one claimed at sign-up, or one that follows the name. */}
              <TextField
                id="welcome-address"
                label={t("address.label")}
                size="auto"
                live
                ltr
                leading={`${CREATOR_DOMAIN}/`}
                value={addressValue}
                onChange={(event) => {
                  setAddress(event.target.value.toLowerCase());
                  setAddressError(null);
                }}
                autoCapitalize="none"
                spellCheck={false}
                maxLength={30}
                error={addressProblem ? tAuth(`errors.${addressProblem}`) : undefined}
                hint={
                  (addressValue === account.username && !provisional) || addressStatus === "ok" ? (
                    <span className="flex items-center gap-2 text-success-strong">
                      <Icon icon={CircleCheck} size="sm" />
                      {addressValue === account.username ? t("address.yours", { name: addressValue }) : tAuth("fields.usernameOk", { name: addressValue })}
                    </span>
                  ) : (
                    t("address.hint")
                  )
                }
              />
            </div>
          ) : null}

          {step === "look" ? (
            <div className="grid grid-cols-1 gap-3">
              {/* The kind's starter first, then the looks the tokens suggest for it, then every other look. */}
              <TemplatePicker
                value={doc.theme.template}
                profile={doc.profile}
                order={kind ? lookOrder(kind) : undefined}
                onChange={(template) => dispatch({ type: "theme", theme: { template } })}
              />
              {kind && doc.theme.template === STARTERS[kind].theme.template ? (
                <p className="flex items-center gap-2 text-small font-medium text-link">
                  <Icon icon={Lightbulb} size="sm" />
                  {t("lookSuggested", { kind: tKinds(`${kind}.label`) })}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "links" ? (
            <div className="grid grid-cols-1 gap-6">
              <ImportBox importer={importer} onPasteOnly={() => document.querySelector<HTMLElement>("#welcome-links textarea")?.focus()} />
              {socialsFieldset}
              {extrasFieldset}
              {linksField}
            </div>
          ) : null}

          {step === "proof" && kind ? (
            <ProofStep
              kind={kind}
              rows={proof}
              onRows={(rows) => {
                setProof(rows);
                // A gap that was filled in stops being pointed out.
                setProofProblems((current) => current.map((problem, i) => (problem && rows[i] && proofProblem(rows[i]) === null ? null : problem)));
              }}
              problems={proofProblems}
              real={!accountStore.demo}
            />
          ) : null}

          {step === "action" && kind ? (
            <div className="grid grid-cols-1 gap-6">
              {/* The page's one button: its way, its address and its words, in the page's language. */}
              {/* The welcome's column is narrower than the editor's sheet: the four ways stay in two rows,
                  so "Buchungslink" is never broken inside the word. */}
              <div id="welcome-reach" className="sm:[&_[role=radiogroup]]:grid-cols-2">
                <ReachInput
                  value={reach}
                  onValue={(value) => {
                    setReach(value);
                    if (value.label.trim() !== "") setReachLabelError(undefined);
                  }}
                  kind={kind}
                  locale={doc.profile.locale}
                  labels={{ address: t("portfolio.actionAddress"), label: t("portfolio.actionLabel") }}
                  errors={{ label: reachLabelError }}
                />
              </div>
              {extrasFieldset}
              {socialsFieldset}
              {linksField}
            </div>
          ) : null}

          {step === "done" ? (
            <div className="grid justify-items-start gap-4 rounded-xl border border-line bg-surface p-5">
              <span className="grid size-control-xl place-items-center rounded-full bg-success-subtle text-success-strong">
                <Icon icon={PartyPopper} size="lg" />
              </span>
              <p dir="ltr" className="text-h3 font-semibold">
                <span className="text-fg-secondary">{CREATOR_DOMAIN}/</span>
                {account.username}
              </p>
              {portfolio && made ? <PortfolioMade made={made} /> : null}
              <div className="flex flex-wrap gap-2">
                <ShareButtons username={account.username} compact />
                <QrButton username={account.username} compact />
              </div>
            </div>
          ) : null}
            </>
          )}
        </main>

        {!waitingForAi ? (
          // The bar's buttons line up with the step above: the same width and inner padding as <main>.
          <footer className="layer-sticky sticky bottom-0 border-t border-line bg-canvas px-5 pt-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))] md:px-0">
            {step === "done" ? (
              // The flow's last two ways on: pills, as every step's footer (in-card buttons stay rounded).
              // Keyed: new buttons, not the step's Back and Continue fading into other colours.
              <div key="done" className="mx-auto grid max-w-prose grid-cols-1 gap-2 sm:grid-cols-2 md:px-10">
                <Button variant="primary" size="cta" onClick={() => finish("/app/editor")}>
                  {t("toEditor")}
                </Button>
                <Button variant="tinted" size="cta" onClick={() => finish("/app")}>
                  {t("toDashboard")}
                </Button>
              </div>
            ) : (
              <div key="steps" className="mx-auto flex max-w-prose items-center gap-2 md:px-10">
                {index > 0 && !showStart && !fromAi ? (
                  <Button variant="ghost" size="lg" icon={ArrowLeft} onClick={back} className="[&_svg]:rtl:-scale-x-100">
                    {t("back")}
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  size="cta"
                  className="ms-auto min-w-0 flex-1 sm:flex-none"
                  onClick={() => {
                    if (!showStart) {
                      void next();
                      return;
                    }
                    if (start === "ai") {
                      router.push("/app/build?from=welcome");
                      return;
                    }
                    // The five steps, from the first; focus goes to its title.
                    setStarted(true);
                    setMoved(true);
                  }}
                  trailing={<Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />}
                >
                  {showStart ? t("start.continue") : fromAi ? t("fromAi.finish") : step === steps[steps.length - 2] ? t("finish") : t("continue")}
                </Button>
              </div>
            )}
          </footer>
        ) : null}
      </div>

      <aside aria-label={t("previewLabel")} className="sticky top-0 hidden h-dvh w-preview box-content border-s border-line bg-canvas-muted p-6 xl:grid">
        <PhonePreview className="h-full" />
      </aside>
    </div>
  );
}
