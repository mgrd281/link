"use client";

import { hasImage } from "@linkyo/blocks/rules";
import { SEARCH_DESCRIPTION_MAX, SEARCH_TITLE_MAX, type Visibility } from "@linkyo/blocks";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Avatar, Icon, Switch } from "@linkyo/ui";
import { CirclePause, Search, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { accountStore } from "@/features/account/store";
import { refreshPublicPage } from "@/features/creator/refresh";
import { searchTexts } from "@/features/creator/visibility";
import { themeStyle } from "@/features/creator/theme";
import { plainImageSrc } from "@/features/directions/shared/media";
import { haptic } from "@/lib/haptics";
import { CREATOR_DOMAIN, pageAddress } from "@/lib/page-url";

import { TextArea, TextInput } from "../form";
import { FieldGroup, ListGroup, Tile } from "../list";
import { SETTINGS_HREF } from "../routes";
import { ColumnGroups, Screen } from "../screen";
import { useSite } from "../site-context";

/**
 * The settings as they are stored: only what differs from the default (a pause, search engines off,
 * a title or description that is not blank), and nothing at all when everything is the default.
 */
export function storedVisibility(value: Visibility): Visibility | undefined {
  const title = value.title?.trim();
  const description = value.description?.trim();
  const kept: Visibility = {
    ...(value.paused ? { paused: true } : {}),
    ...(value.search === false ? { search: false } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  };
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/** What the Settings row says about the page: paused, kept out of search engines, or public. */
export function visibilityState(value: Visibility | undefined): "paused" | "hidden" | "public" {
  if (value?.paused) return "paused";
  return value?.search === false ? "hidden" : "public";
}

/**
 * Once a change of the pause or the texts has reached the database, the cached public page and its link
 * card are dropped (/api/account/revalidate), so the next visitor sees the change, not the copy cached
 * up to a minute ago. Demo accounts have no public page (no token: nothing is sent).
 */
function useRefreshWhenSaved(): () => void {
  const { save } = useSite();
  const waiting = useRef(false);
  useEffect(() => {
    if (save !== "saved" || !waiting.current) return;
    waiting.current = false;
    void refreshPublicPage("");
  }, [save]);
  return () => {
    waiting.current = true;
  };
}

/** A row of the grouped list with a switch: the tile, the label and what it does, then the switch. */
function SwitchListRow({ icon, label, description, checked, onChecked }: { icon: LucideIcon; label: string; description: string; checked: boolean; onChecked: (checked: boolean) => void }) {
  const id = useId();
  return (
    <li className="relative flex items-start gap-4 px-4 py-3 not-first:before:absolute not-first:before:start-16 not-first:before:end-0 not-first:before:top-0 not-first:before:border-t not-first:before:border-line">
      <Tile icon={icon} />
      <label htmlFor={id} className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-body leading-snug">{label}</span>
        <span id={`${id}-description`} className="text-small text-pretty text-fg-secondary">
          {description}
        </span>
      </label>
      <Switch
        id={id}
        aria-describedby={`${id}-description`}
        checked={checked}
        onCheckedChange={(value) => {
          haptic();
          onChecked(value);
        }}
      />
    </li>
  );
}

/** One preview with its small heading; a picture of what others will show, not a control. */
function PreviewFrame({ title, note, children }: { title: string; note?: string | undefined; children: ReactNode }) {
  const id = useId();
  return (
    <figure aria-labelledby={id} className="grid min-w-0 gap-2">
      <figcaption id={id} className="px-4 text-small font-semibold text-fg-secondary">
        {title}
      </figcaption>
      <div className="min-w-0 rounded-lg bg-group p-4 lg:border lg:border-line">{children}</div>
      {note ? <p className="px-4 text-small text-fg-secondary">{note}</p> : null}
    </figure>
  );
}

/**
 * Settings › Sichtbarkeit (D-09): pause the page, keep it out of search engines, and the title and
 * description search results and link cards show, with a live preview of both. Every switch is one
 * undoable change of the page, saved like any other; the texts are written when their field is left.
 */
export function VisibilityScreen() {
  const t = useTranslations("app.visibility");
  const tApp = useTranslations("app");
  const { doc, dispatch, account } = useSite();
  const visibility = useMemo(() => doc.profile.visibility ?? {}, [doc.profile.visibility]);
  const refreshSoon = useRefreshWhenSaved();
  const set = (patch: Visibility) => {
    const next = storedVisibility({ ...visibility, ...patch });
    if (JSON.stringify(next) === JSON.stringify(doc.profile.visibility)) return;
    dispatch({ type: "profile", patch: { visibility: next } });
    refreshSoon();
  };

  // The texts as typed: the previews follow every key, the page is changed once the field is left.
  const [title, setTitle] = useState(visibility.title ?? "");
  const [description, setDescription] = useState(visibility.description ?? "");
  // An undo, a redo or a change from another device brings other texts: the fields follow them.
  const [shown, setShown] = useState({ title: visibility.title, description: visibility.description });
  if (shown.title !== visibility.title || shown.description !== visibility.description) {
    setShown({ title: visibility.title, description: visibility.description });
    setTitle(visibility.title ?? "");
    setDescription(visibility.description ?? "");
  }
  // Leaving the screen with a field still focused writes it too.
  const typed = useRef({ title, description });
  const write = useRef(set);
  useEffect(() => {
    typed.current = { title, description };
    write.current = set;
  });
  useEffect(() => () => write.current(typed.current), []);
  const commit = () => set({ title, description });

  const paused = visibility.paused === true;
  const texts = searchTexts({ ...doc.profile, visibility: { ...visibility, title, description } });
  const theme = useMemo(() => resolveCreatorTheme(doc.theme, { rtlScript: doc.profile.locale === "ar" }), [doc.theme, doc.profile.locale]);
  const avatar = doc.profile.avatar;
  const address = pageAddress(account.username);
  const count = (value: string, max: number) => (
    <span aria-hidden className="shrink-0 text-caption text-fg-tertiary tabular-nums">
      {Array.from(value).length}/{max}
    </span>
  );

  return (
    <Screen title={t("title")} lead={t("lead")} back={{ href: SETTINGS_HREF, label: tApp("nav.settings") }} preview grow>
      <ColumnGroups>
        <ListGroup
          title={t("groups.page")}
          titleId="visibility-page"
          footer={
            // Read out when the pause changes: the owner hears what visitors now see.
            <span role="status">{paused ? t("pausedNote") : accountStore.demo ? t("demoNote") : t("liveNote")}</span>
          }
        >
          <SwitchListRow icon={CirclePause} label={t("pause")} description={t("pauseHint")} checked={paused} onChecked={(next) => set({ paused: next })} />
          <SwitchListRow
            icon={Search}
            label={t("search")}
            description={paused ? t("searchPaused") : t("searchHint")}
            checked={visibility.search !== false}
            onChecked={(next) => set({ search: next })}
          />
        </ListGroup>

        <FieldGroup title={t("groups.texts")} titleId="visibility-texts" footer={t("textsFooter")}>
          <TextInput
            label={t("titleLabel")}
            hint={t("titleHint")}
            value={title}
            onValue={(typed) => setTitle(Array.from(typed).slice(0, SEARCH_TITLE_MAX).join(""))}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
            }}
            maxLength={SEARCH_TITLE_MAX}
            placeholder={doc.profile.displayName}
            trailing={count(title, SEARCH_TITLE_MAX)}
            enterKeyHint="done"
          />
          <TextArea
            label={t("descriptionLabel")}
            hint={t("descriptionHint")}
            value={description}
            onValue={(typed) => setDescription(Array.from(typed.replace(/\n/g, " ")).slice(0, SEARCH_DESCRIPTION_MAX).join(""))}
            onBlur={commit}
            max={SEARCH_DESCRIPTION_MAX}
            rows={3}
            count
          />
        </FieldGroup>

        <PreviewFrame title={t("previewSearch")} note={visibility.search === false || paused ? t("previewSearchOff") : undefined}>
          {/* A search result as most engines draw it: where it lives, the title, the description. */}
          <div className="grid min-w-0 gap-1">
            <p className="flex min-w-0 items-center gap-2 text-small text-fg-secondary">
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-tinted text-caption font-semibold text-tinted-fg">
                L
              </span>
              <bdi dir="ltr" className="truncate">
                {`${CREATOR_DOMAIN} › ${account.username}`}
              </bdi>
            </p>
            <p data-preview-title className="truncate text-body-lg font-semibold">
              <bdi>{texts.title}</bdi>
            </p>
            <p data-preview-description className="line-clamp-2 text-small text-fg-secondary">
              {texts.description ? <bdi>{texts.description}</bdi> : t("previewNoDescription")}
            </p>
          </div>
        </PreviewFrame>

        <PreviewFrame title={t("previewCard")} note={t("previewCardNote")}>
          {/* The card a message app shows for the link: our picture (in the page's colours) and its texts. */}
          <div className="overflow-hidden rounded-md border border-line">
            <div lang={doc.profile.locale} dir={doc.profile.locale === "ar" ? "rtl" : "ltr"} style={themeStyle(theme)} className="flex aspect-og items-center gap-4 bg-creator-bg p-4 text-creator-fg">
              <Avatar name={doc.profile.displayName} src={hasImage(avatar) ? plainImageSrc(avatar.src) : undefined} size="lg" className="shrink-0" />
              <span className="grid min-w-0 gap-1">
                <span className="line-clamp-2 font-creator-display text-title break-words">
                  <bdi>{texts.title}</bdi>
                </span>
                {texts.description && !paused ? (
                  <span className="line-clamp-2 text-small text-creator-fg-muted">
                    <bdi>{texts.description}</bdi>
                  </span>
                ) : null}
                <bdi dir="ltr" className="truncate text-caption text-creator-fg-muted">
                  {address}
                </bdi>
              </span>
            </div>
            <div className="grid gap-0.5 border-t border-line bg-surface px-3 py-2">
              <span className="truncate text-small font-semibold">
                <bdi>{texts.title}</bdi>
              </span>
              {texts.description && !paused ? (
                <span className="line-clamp-2 text-caption text-fg-secondary">
                  <bdi>{texts.description}</bdi>
                </span>
              ) : null}
              <bdi dir="ltr" className="text-caption text-fg-tertiary">
                {CREATOR_DOMAIN}
              </bdi>
            </div>
          </div>
        </PreviewFrame>
      </ColumnGroups>
    </Screen>
  );
}

/**
 * The Settings row's value: "Pausiert" (with the pause's glyph) or "Ohne Suchmaschinen"; nothing while
 * everything is the default (a demo page is not public, so the row never claims it is).
 */
export function VisibilityValue() {
  const t = useTranslations("app.visibility.state");
  const { doc } = useSite();
  const state = visibilityState(doc.profile.visibility);
  if (state === "public") return null;
  return state === "paused" ? (
    <span className="inline-flex items-center gap-1">
      <Icon icon={CirclePause} size="sm" />
      {t("paused")}
    </span>
  ) : (
    t("hidden")
  );
}
