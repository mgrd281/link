"use client";

import { detectMany, type Block, type BlockOf } from "@linkyo/blocks";
import { Button, cn, Icon, Logo } from "@linkyo/ui";
import { ArrowLeft, ArrowRight, Check, PartyPopper } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { accountStore } from "@/features/account/store";
import { TemplatePicker } from "@/features/directions/poster/template-picker";
import { useRouter } from "@/i18n/navigation";

import { blockFromLink, newBlockId } from "./blocks";
import { TextArea } from "./form";
import { PhonePreview, PreviewButton } from "./preview";
import { ProfileFields, useProfileDraft } from "./profile-form";
import { QrButton, ShareButtons } from "./share-tools";
import { useSite } from "./site-context";

const STEPS = ["you", "look", "links", "done"] as const;
type Step = (typeof STEPS)[number];

const SOCIALS = [
  { platform: "instagram", prefix: "instagram.com/" },
  { platform: "tiktok", prefix: "tiktok.com/@" },
  { platform: "youtube", prefix: "youtube.com/@" },
  { platform: "spotify", prefix: "open.spotify.com/artist/" },
] as const;

/**
 * Welcome: four short steps from an empty account to a page worth sharing, with the page building
 * itself in the phone next to the form. Every step can be skipped; nothing here is final.
 */
export function WelcomeScreen() {
  const t = useTranslations("app.welcome");
  const tTypes = useTranslations("dashboard.types");
  const tTemplates = useTranslations("templates");
  const router = useRouter();
  const { doc, dispatch, account } = useSite();
  const [step, setStep] = useState<Step>("you");
  const profile = useProfileDraft();
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [links, setLinks] = useState("");
  const index = STEPS.indexOf(step);
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

  const next = () => {
    if (step === "you" && !profile.save(t("nameRequired"))) return;
    if (step === "links") {
      const items: BlockOf<"socials">["items"] = SOCIALS.flatMap(({ platform, prefix }) => {
        const handle = (handles[platform] ?? "").trim().replace(/^@/, "");
        if (!handle) return [];
        return [{ platform, url: /^https?:\/\//.test(handle) ? handle : `https://${prefix}${handle}` }];
      });
      const blocks: Block[] = detected.map((detection) => blockFromLink(detection, labels, doc.profile.displayName));
      if (items.length && !doc.blocks.some((block) => block.type === "socials")) {
        dispatch({ type: "add", block: { id: newBlockId("socials"), type: "socials", visible: true, highlight: false, items }, index: 0 });
      }
      const at = items.length ? 1 : 0;
      blocks.forEach((block, i) => dispatch({ type: "add", block, index: at + i }));
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
          <ol aria-label={t("progress")} className="grid grid-cols-4 gap-2">
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

          {step === "you" ? <ProfileFields profile={profile.profile} onChange={profile.change} errors={profile.errors} /> : null}

          {step === "look" ? (
            <div className="grid grid-cols-1 gap-3">
              <TemplatePicker value={doc.theme.template} profile={doc.profile} onChange={(template) => dispatch({ type: "theme", theme: { template } })} />
              {doc.theme.template ? <p className="text-small text-fg-secondary">{tTemplates(`${doc.theme.template}.description`)}</p> : null}
              <p className="text-small text-fg-tertiary">{t("lookLater")}</p>
            </div>
          ) : null}

          {step === "links" ? (
            <div className="grid grid-cols-1 gap-6">
              <fieldset className="grid min-w-0 grid-cols-1 gap-3">
                <legend className="mb-3 text-body font-semibold">{t("socials")}</legend>
                {SOCIALS.map(({ platform, prefix }) => (
                  <label key={platform} className="grid grid-cols-1 gap-2">
                    <span className="text-small">{t(`platforms.${platform}`)}</span>
                    <span dir="ltr" className="flex h-control-lg items-center rounded-md border border-line-input bg-surface-elevated px-3 focus-within:border-focus focus-within:focus-ring">
                      <span className="shrink-0 text-fg-tertiary select-none">{prefix}</span>
                      <input
                        value={handles[platform] ?? ""}
                        onChange={(event) => setHandles((current) => ({ ...current, [platform]: event.target.value }))}
                        autoCapitalize="none"
                        spellCheck={false}
                        className="h-full min-w-0 flex-1 bg-transparent text-body outline-none"
                      />
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="grid grid-cols-1 gap-2">
                <TextArea label={t("links")} hint={t("linksHint")} value={links} onValue={setLinks} max={2000} rows={4} dir="ltr" placeholder="https://" />
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
