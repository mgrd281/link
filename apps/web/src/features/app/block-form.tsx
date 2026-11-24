"use client";

import {
  APP_PRICING,
  APP_STORES,
  CONTACT_KINDS,
  detectLink,
  LINK_ICONS,
  NO_IMAGE,
  normalizeUrl,
  PLATFORMS,
  VIDEO_PLAYBACK,
  type AppPricing,
  type AppStore,
  type Block,
  type BlockOf,
  type ContactKind,
  type CreatorKind,
  type LinkIcon,
  type Page,
  type Platform,
  type VideoPlayback,
} from "@linkyo/blocks";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { platformName } from "@/features/directions/shared/creator-kit";
import { STORE_NAMES } from "@/features/directions/shared/stores";

import { ChipsInput } from "./chips-input";
import { FormSection, ImageInput, Repeater, SelectField, SwitchRow, TextArea, TextInput, UrlInput } from "./form";
import { fetchLinkMetadata, installCommand } from "./metadata";
import { ProjectForm } from "./project-form";
import { ReachInput } from "./reach-input";
import { isReachWay, reachFrom, shapeWay } from "./reach";
import { useSite } from "./site-context";
import { inPage, type FieldErrors } from "./validate";

const noImage = { src: NO_IMAGE, alt: "" };
const platformOptions = PLATFORMS.map((value) => ({ value, label: platformName(value) }));

/** The platform a pasted URL belongs to, when we recognise it. */
const platformOf = (url: string): Platform | null => {
  const found = detectLink(url)?.platform;
  return found && (PLATFORMS as readonly string[]).includes(found) ? (found as Platform) : null;
};

/** Store names are the stores' own (the same in every language), except "Web". */

/** The store a pasted address belongs to: Apple's, Google's, or the web. */
const storeOf = (url: string): AppStore => {
  const platform = detectLink(url)?.platform;
  return platform === "appstore" || platform === "googleplay" ? platform : "web";
};

/** A GitHub link → owner, repository and (for a skill) its folder; null for anything else. */
const repoOf = (url: string): { owner: string; repo: string; path: string } | null => {
  const found = detectLink(url);
  if (found?.type !== "repo" || !found.id) return null;
  const [owner = "", repo = "", ...folders] = found.id.split("/");
  return { owner, repo, path: folders.join("/") };
};

const toLocalInput = (iso: string | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : undefined);

const LIVE_PLATFORMS = ["tiktok", "instagram", "youtube", "twitch", "kick"] as const;

/** How long the address has to stay unchanged before it names the link (typing is not finished before). */
const TITLE_DELAY = 600;

/**
 * A new link names itself: once its address has stayed put for a moment and the title is still empty,
 * the title becomes the site's name ("milaaurel.com"), and then the page's real title when our server
 * knows it (songs, videos, apps). A title the creator typed is never replaced; one we filled in follows
 * a corrected address.
 */
function useLinkTitle(block: Block, onChange: (block: Block) => void, creating: boolean) {
  // The latest block and callback, for the timer and the answer that arrive after this render.
  const latest = useRef({ block, onChange });
  useEffect(() => {
    latest.current = { block, onChange };
  });
  // The title this hook filled in last, so it can tell it apart from one the creator typed.
  const filled = useRef<string | null>(null);
  const url = creating && block.type === "link" ? block.url : null;
  useEffect(() => {
    if (url === null) return;
    // Replies that arrive after the sheet closed or the address changed are dropped.
    let live = true;
    const timer = window.setTimeout(() => {
      const current = latest.current.block;
      if (current.type !== "link" || (current.title.trim() && current.title !== filled.current)) return;
      const address = normalizeUrl(current.url);
      if (!address || !/^https?:$/.test(address.protocol)) return;
      const site = address.hostname.replace(/^www\./, "");
      filled.current = site;
      if (current.title !== site) latest.current.onChange({ ...current, title: site });
      // Our server only knows titles for platforms it recognises (it answers nothing for other sites).
      if (!detectLink(address.toString())?.platform) return;
      void fetchLinkMetadata(address.toString()).then((meta) => {
        if (!live) return;
        const now = latest.current.block;
        if (!meta?.title || now.type !== "link" || now.title !== site) return;
        filled.current = meta.title;
        latest.current.onChange({ ...now, title: meta.title });
      });
    }, TITLE_DELAY);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [url]);
}

/** Today (+days) at hh:00 in the creator's own time, as an ISO timestamp. */
const atHour = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

/**
 * The edit form for a block. One column, labels above fields, errors under the field that needs
 * attention. Every change is a draft that the live preview shows immediately.
 */
export function BlockForm({ block, onChange: handOn, errors, creating = false }: { block: Block; onChange: (block: Block) => void; errors: FieldErrors; creating?: boolean }) {
  const t = useTranslations("app.fields");
  const tErr = useTranslations("app.errors");
  const tPortfolio = useTranslations("app.portfolio");
  const { doc, site } = useSite();
  // Every draft is checked against the page it is edited on (a taken address, a second contact block).
  const onChange = (next: Block) => handOn(inPage(next, doc.blocks));
  useLinkTitle(block, onChange, creating);
  const err = (path: string) => {
    const key = errors[path];
    if (!key) return undefined;
    return key.startsWith("portfolio.") ? tPortfolio(key.slice("portfolio.".length) as "slugTaken") : tErr(key as "required");
  };
  const set = <B extends Block>(current: B, patch: Partial<B>) => onChange({ ...current, ...patch });
  const kind = site.kind as CreatorKind | undefined;

  const featured = (current: Block) =>
    "title" in current && current.type !== "header" && current.type !== "newsletter" ? (
      <SwitchRow label={t("highlight")} description={t("highlightHint")} checked={current.highlight} onChecked={(highlight) => onChange({ ...current, highlight })} />
    ) : null;
  const affiliate = (current: BlockOf<"link"> | BlockOf<"card"> | BlockOf<"product"> | BlockOf<"app">) => (
    <SwitchRow label={t("affiliate")} description={t("affiliateHint")} checked={current.affiliate ?? false} onChecked={(value) => set(current, { affiliate: value })} />
  );

  let fields: ReactNode;
  switch (block.type) {
    case "link":
      // People arrive with the address, not a title: the address comes first (and fills in the title),
      // and what most links never need waits behind "More options".
      fields = (
        <>
          <UrlInput label={t("url")} value={block.url} onValue={(url) => set(block, { url })} error={err("url")} />
          <TextInput label={t("title")} value={block.title} onValue={(title) => set(block, { title })} maxLength={120} error={err("title")} />
          {featured(block)}
          <Disclosure summary={t("moreOptions")}>
            <TextInput label={t("subtitle")} hint={t("subtitleHint")} value={block.subtitle ?? ""} onValue={(subtitle) => set(block, { subtitle: subtitle || undefined })} maxLength={80} />
            <SelectField<LinkIcon | "auto">
              label={t("icon")}
              value={block.icon ?? "auto"}
              onValue={(icon) => onChange(icon === "auto" ? { ...block, icon: undefined } : { ...block, icon })}
              options={[{ value: "auto", label: t("iconAuto") }, ...LINK_ICONS.map((icon) => ({ value: icon, label: t(`icons.${icon}`) }))]}
            />
            <ImageInput label={t("thumbnail")} kind="thumb" image={block.thumbnail} onImage={(thumbnail) => onChange(thumbnail ? { ...block, thumbnail } : { ...block, thumbnail: undefined })} withAlt={false} />
            <TextInput label={t("badge")} hint={t("badgeHint")} value={block.badge ?? ""} onValue={(badge) => set(block, { badge: badge || undefined })} maxLength={16} />
            {affiliate(block)}
          </Disclosure>
        </>
      );
      break;
    case "card":
      fields = (
        <>
          <ImageInput label={t("image")} image={block.image} onImage={(image) => set(block, { image: image ?? noImage })} error={err("image.src")} />
          <TextInput label={t("title")} value={block.title} onValue={(title) => set(block, { title })} maxLength={120} error={err("title")} />
          <TextArea label={t("description")} value={block.description ?? ""} onValue={(description) => set(block, { description: description || undefined })} max={240} />
          <UrlInput label={t("url")} value={block.url} onValue={(url) => set(block, { url })} error={err("url")} />
          {featured(block)}
          {affiliate(block)}
        </>
      );
      break;
    case "header":
      fields = <TextInput label={t("sectionTitle")} hint={t("sectionHint")} value={block.title} onValue={(title) => set(block, { title })} maxLength={80} error={err("title")} />;
      break;
    case "text":
      fields = <TextArea label={t("text")} value={block.text} onValue={(text) => set(block, { text })} max={2000} rows={6} error={err("text")} />;
      break;
    case "divider":
      fields = <p className="text-small text-fg-secondary">{t("dividerHint")}</p>;
      break;
    case "socials":
      fields = (
        <FormSection title={t("profiles")} description={t("profilesHint")}>
          <Repeater<BlockOf<"socials">["items"][number]>
            items={block.items}
            onItems={(items) => set(block, { items })}
            make={() => ({ platform: "instagram", url: "" })}
            max={12}
            itemLabel={(item) => platformName(item.platform)}
            addLabel={t("addProfile")}
            render={(item, update, index) => (
              <>
                <UrlInput
                  label={t("url")}
                  value={item.url}
                  onValue={(url) => update({ ...item, url, platform: platformOf(url) ?? item.platform })}
                  error={err(`items.${index}.url`)}
                />
                <SelectField label={t("platform")} value={item.platform} onValue={(platform) => update({ ...item, platform })} options={platformOptions} />
              </>
            )}
          />
        </FormSection>
      );
      break;
    case "image":
      fields = (
        <>
          <ImageInput label={t("image")} image={block.image} onImage={(image) => set(block, { image: image ?? noImage })} error={err("image.src")} />
          <UrlInput label={t("urlOptional")} value={block.url ?? ""} onValue={(url) => set(block, { url: url || undefined })} error={err("url")} />
        </>
      );
      break;
    case "gallery":
      fields = (
        <>
          <TextInput label={t("titleOptional")} value={block.title ?? ""} onValue={(title) => set(block, { title: title || undefined })} maxLength={80} />
          <FormSection title={t("photos")} description={err("images") ?? t("photosHint")}>
            <Repeater<BlockOf<"gallery">["images"][number]>
              items={block.images}
              onItems={(images) => set(block, { images })}
              make={() => noImage}
              max={24}
              itemLabel={(_, index) => t("photoN", { n: index + 1 })}
              addLabel={t("addPhoto")}
              render={(image, update, index) => <ImageInput label={t("photoN", { n: index + 1 })} image={image} onImage={(next) => update(next ?? noImage)} error={err(`images.${index}.src`)} />}
            />
          </FormSection>
        </>
      );
      break;
    case "video":
      fields = (
        <>
          <UrlInput
            label={t("videoUrl")}
            hint={t("videoUrlHint")}
            value={block.url}
            onValue={(url) => {
              const platform = platformOf(url);
              const provider = platform === "tiktok" || platform === "instagram" ? platform : url.includes("vimeo.com") ? "vimeo" : "youtube";
              set(block, { url, provider });
            }}
            error={err("url")}
          />
          <TextInput label={t("title")} value={block.title} onValue={(title) => set(block, { title })} maxLength={120} error={err("title")} />
          <SelectField<VideoPlayback>
            label={t("playback")}
            value={block.playback ?? "inline"}
            onValue={(playback) => onChange(playback === "inline" ? { ...block, playback: undefined } : { ...block, playback })}
            options={VIDEO_PLAYBACK.map((value) => ({ value, label: t(`playbackOptions.${value}`) }))}
          />
          <ImageInput label={t("poster")} kind="photo" shape="wide" image={block.poster} onImage={(poster) => set(block, { poster: poster ?? noImage })} withAlt={false} />
          {featured(block)}
        </>
      );
      break;
    case "shorts":
      fields = (
        <>
          <TextInput label={t("titleOptional")} value={block.title ?? ""} onValue={(title) => set(block, { title: title || undefined })} maxLength={80} />
          <Repeater<BlockOf<"shorts">["items"][number]>
            items={block.items}
            onItems={(items) => set(block, { items })}
            make={() => ({ title: "", url: "", poster: noImage })}
            min={1}
            max={12}
            itemLabel={(item, index) => item.title || t("clipN", { n: index + 1 })}
            addLabel={t("addClip")}
            render={(item, update, index) => (
              <>
                <UrlInput label={t("url")} value={item.url} onValue={(url) => update({ ...item, url })} error={err(`items.${index}.url`)} />
                <TextInput label={t("title")} value={item.title} onValue={(title) => update({ ...item, title })} maxLength={120} />
                <ImageInput label={t("poster")} image={item.poster} onImage={(poster) => update({ ...item, poster: poster ?? noImage })} withAlt={false} />
              </>
            )}
          />
        </>
      );
      break;
    case "music":
      fields = (
        <>
          <ImageInput label={t("cover")} image={block.cover} onImage={(cover) => set(block, { cover: cover ?? noImage })} />
          <TextInput label={t("releaseTitle")} value={block.title} onValue={(title) => set(block, { title })} maxLength={120} error={err("title")} />
          <TextInput label={t("artist")} value={block.artist} onValue={(artist) => set(block, { artist })} maxLength={120} error={err("artist")} />
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label={t("kind")}
              value={block.kind}
              onValue={(kind) => set(block, { kind })}
              options={(["single", "ep", "album", "playlist"] as const).map((value) => ({ value, label: t(`kinds.${value}`) }))}
            />
            <TextInput label={t("releaseDate")} type="date" value={block.releaseDate ?? ""} onValue={(releaseDate) => set(block, { releaseDate: releaseDate || undefined })} />
          </div>
          <FormSection title={t("listenOn")} description={err("links") ?? t("listenOnHint")}>
            <Repeater<BlockOf<"music">["links"][number]>
              items={block.links}
              onItems={(links) => set(block, { links })}
              make={() => ({ platform: "spotify", url: "" })}
              min={1}
              max={10}
              itemLabel={(item) => platformName(item.platform)}
              addLabel={t("addPlatform")}
              render={(item, update, index) => (
                <>
                  <UrlInput label={t("url")} value={item.url} onValue={(url) => update({ ...item, url, platform: platformOf(url) ?? item.platform })} error={err(`links.${index}.url`)} />
                  <SelectField label={t("platform")} value={item.platform} onValue={(platform) => update({ ...item, platform })} options={platformOptions} />
                </>
              )}
            />
          </FormSection>
          {featured(block)}
        </>
      );
      break;
    case "events":
      fields = (
        <>
          <TextInput label={t("titleOptional")} hint={t("eventsTitleHint")} value={block.title ?? ""} onValue={(title) => set(block, { title: title || undefined })} maxLength={80} />
          <Repeater<BlockOf<"events">["items"][number]>
            items={block.items}
            onItems={(items) => set(block, { items })}
            // A further show starts without a date too: the form asks for it before it is shown.
            make={() => ({ date: "", city: "", venue: "", url: "", status: "onsale" as const })}
            min={1}
            max={50}
            itemLabel={(item, index) => [item.name, item.city].find((text) => text?.trim()) ?? t("showN", { n: index + 1 })}
            addLabel={t("addShow")}
            render={(item, update, index) => (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <TextInput label={t("date")} type="date" value={item.date} onValue={(date) => update({ ...item, date })} error={err(`items.${index}.date`)} />
                  <TextInput label={t("time")} type="time" value={item.time ?? ""} onValue={(time) => update({ ...item, time: time || undefined })} />
                </div>
                <TextInput label={t("showName")} hint={t("showNameHint")} value={item.name ?? ""} onValue={(name) => update({ ...item, name: name || undefined })} maxLength={120} />
                <div className="grid grid-cols-2 gap-4">
                  <TextInput label={t("city")} value={item.city} onValue={(city) => update({ ...item, city })} maxLength={80} error={err(`items.${index}.city`)} />
                  <TextInput label={t("venue")} value={item.venue} onValue={(venue) => update({ ...item, venue })} maxLength={120} />
                </div>
                <UrlInput label={t("tickets")} value={item.url} onValue={(url) => update({ ...item, url })} error={err(`items.${index}.url`)} />
                <SelectField
                  label={t("status")}
                  value={item.status}
                  onValue={(status) => update({ ...item, status })}
                  options={(["onsale", "few", "soldout"] as const).map((value) => ({ value, label: t(`statuses.${value}`) }))}
                />
              </>
            )}
          />
        </>
      );
      break;
    case "product":
      fields = (
        <>
          <ImageInput label={t("image")} image={block.image} onImage={(image) => set(block, { image: image ?? noImage })} />
          <TextInput label={t("productName")} value={block.title} onValue={(title) => set(block, { title })} maxLength={120} error={err("title")} />
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label={t("price")}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={String(block.price)}
              onValue={(price) => set(block, { price: Math.max(0, Number(price) || 0) })}
              error={err("price")}
            />
            <SelectField label={t("currency")} value={block.currency} onValue={(currency) => set(block, { currency })} options={(["EUR", "USD", "GBP", "CHF"] as const).map((value) => ({ value, label: value }))} />
          </div>
          <UrlInput label={t("shopUrl")} value={block.url} onValue={(url) => set(block, { url })} error={err("url")} />
          {featured(block)}
          {affiliate(block)}
        </>
      );
      break;
    case "newsletter":
      fields = (
        <>
          <TextInput label={t("title")} value={block.title} onValue={(title) => set(block, { title })} maxLength={80} error={err("title")} />
          <TextArea label={t("description")} value={block.description ?? ""} onValue={(description) => set(block, { description: description || undefined })} max={200} />
          <p className="rounded-md bg-canvas-muted p-3 text-small text-fg-secondary">{t("newsletterHint")}</p>
        </>
      );
      break;
    case "brands":
      fields = (
        <>
          <TextInput label={t("titleOptional")} value={block.title ?? ""} onValue={(title) => set(block, { title: title || undefined })} maxLength={80} />
          <SelectField
            label={t("columns")}
            value={String(block.columns) as "2" | "3"}
            onValue={(columns) => set(block, { columns: columns === "2" ? 2 : 3 })}
            options={[
              { value: "3", label: t("columns3") },
              { value: "2", label: t("columns2") },
            ]}
          />
          <Repeater<BlockOf<"brands">["items"][number]>
            items={block.items}
            onItems={(items) => set(block, { items })}
            make={() => ({ name: "" })}
            min={1}
            max={24}
            itemLabel={(item, index) => item.name || t("partnerN", { n: index + 1 })}
            addLabel={t("addPartner")}
            render={(item, update, index) => (
              <>
                {/* A name is enough; a logo is someone's trademark and only shows with their consent. */}
                <ImageInput
                  label={t("logo")}
                  hint={tPortfolio("logoHint")}
                  kind="logo"
                  image={item.logo}
                  onImage={(logo) => {
                    const { logo: _logo, ...rest } = item;
                    update(logo ? { ...rest, logo } : rest);
                  }}
                  withAlt={false}
                />
                <TextInput label={t("name")} value={item.name} onValue={(name) => update({ ...item, name })} maxLength={80} error={err(`items.${index}.name`)} />
                <TextInput label={t("role")} value={item.role ?? ""} onValue={(role) => update({ ...item, role: role || undefined })} maxLength={80} />
                <UrlInput label={t("urlOptional")} value={item.url ?? ""} onValue={(url) => update({ ...item, url: url || undefined })} error={err(`items.${index}.url`)} />
              </>
            )}
          />
        </>
      );
      break;
    case "app":
      fields = (
        <>
          <ImageInput label={t("appIcon")} kind="thumb" image={block.icon} onImage={(icon) => set(block, { icon: icon ?? noImage })} withAlt={false} />
          <TextInput label={t("appName")} value={block.title} onValue={(title) => set(block, { title })} maxLength={80} error={err("title")} />
          <TextInput label={t("developer")} value={block.developer ?? ""} onValue={(developer) => set(block, { developer: developer || undefined })} maxLength={80} />
          <TextInput label={t("appLine")} hint={t("appLineHint")} value={block.description ?? ""} onValue={(description) => set(block, { description: description || undefined })} maxLength={140} />
          <FormSection title={t("stores")} description={err("stores") ?? t("storesHint")}>
            <Repeater<BlockOf<"app">["stores"][number]>
              items={block.stores}
              onItems={(stores) => set(block, { stores })}
              make={() => ({ store: block.stores.some((store) => store.store === "googleplay") ? "web" : "googleplay", url: "" })}
              max={APP_STORES.length}
              itemLabel={(item) => (item.store === "web" ? t("storeWeb") : STORE_NAMES[item.store])}
              addLabel={t("addStore")}
              render={(item, update, index) => (
                <>
                  <UrlInput label={t("url")} value={item.url} onValue={(url) => update({ ...item, url, store: url ? storeOf(url) : item.store })} error={err(`stores.${index}.url`)} />
                  <SelectField<AppStore>
                    label={t("store")}
                    value={item.store}
                    onValue={(store) => update({ ...item, store })}
                    options={APP_STORES.map((value) => ({ value, label: value === "web" ? t("storeWeb") : STORE_NAMES[value] }))}
                  />
                </>
              )}
            />
          </FormSection>
          <SelectField<AppPricing | "none">
            label={t("pricing")}
            value={block.pricing ?? "none"}
            onValue={(pricing) => onChange(pricing === "none" ? { ...block, pricing: undefined } : { ...block, pricing })}
            options={[{ value: "none", label: t("pricingNone") }, ...APP_PRICING.map((value) => ({ value, label: t(`pricings.${value}`) }))]}
          />
          <TextInput label={t("category")} value={block.category ?? ""} onValue={(category) => set(block, { category: category || undefined })} maxLength={40} />
          <TextInput label={t("promoCode")} hint={t("promoCodeHint")} value={block.code ?? ""} onValue={(code) => set(block, { code: code.trim() ? code.toUpperCase() : undefined })} maxLength={32} />
          {featured(block)}
          {affiliate(block)}
        </>
      );
      break;
    case "repo":
      fields = (
        <>
          <UrlInput
            label={t("githubUrl")}
            hint={t("githubUrlHint")}
            value={block.url}
            onValue={(url) => {
              const found = repoOf(url);
              if (!found) {
                set(block, { url });
                return;
              }
              const skill = found.path ? found.path.split("/").at(-1) : undefined;
              // The suggested command follows the link until the creator writes their own.
              const suggested = !block.install || block.install === installCommand(block.owner, block.repo, block.path?.split("/").at(-1));
              onChange({
                ...block,
                url,
                owner: found.owner,
                repo: found.repo,
                path: found.path || undefined,
                kind: found.path ? "skill" : block.kind,
                title: block.title || (skill ?? found.repo),
                ...(suggested ? { install: installCommand(found.owner, found.repo, skill) } : {}),
              });
            }}
            error={err("url")}
          />
          <TextInput label={t("skillName")} value={block.title} onValue={(title) => set(block, { title })} maxLength={80} error={err("title")} />
          <TextArea label={t("description")} value={block.description ?? ""} onValue={(description) => set(block, { description: description || undefined })} max={240} />
          <TextInput label={t("install")} hint={t("installHint")} value={block.install ?? ""} onValue={(install) => set(block, { install: install.trim() ? install : undefined })} maxLength={200} />
          <SelectField<"skill" | "repo">
            label={t("repoKind")}
            value={block.kind}
            onValue={(kind) => set(block, { kind })}
            options={[
              { value: "skill", label: t("repoKinds.skill") },
              { value: "repo", label: t("repoKinds.repo") },
            ]}
          />
          {featured(block)}
        </>
      );
      break;
    case "live":
      fields = (
        <>
          <UrlInput
            label={t("channelUrl")}
            value={block.url}
            onValue={(url) => {
              const platform = platformOf(url);
              const channel = url.replace(/^https?:\/\/(?:www\.)?[^/]+\/(?:@|c\/|channel\/)?/, "").split(/[/?#]/)[0] ?? "";
              const livePlatform = LIVE_PLATFORMS.find((value) => value === platform);
              set(block, { url, channel: block.channel.length > 0 ? block.channel : channel, platform: livePlatform ?? block.platform });
            }}
            error={err("url")}
          />
          <TextInput label={t("channel")} value={block.channel} onValue={(channel) => set(block, { channel })} maxLength={80} error={err("channel")} />
          <SelectField
            label={t("platform")}
            value={block.platform}
            onValue={(platform) => set(block, { platform })}
            options={LIVE_PLATFORMS.map((value) => ({ value, label: platformName(value) }))}
          />
          <TextInput label={t("streamTitle")} value={block.title ?? ""} onValue={(title) => set(block, { title: title || undefined })} maxLength={140} />
          <SwitchRow label={t("isLive")} description={t("isLiveHint")} checked={block.isLive} onChecked={(isLive) => set(block, { isLive })} />
          <div className="grid grid-cols-1 gap-3">
            <TextInput
              label={t("nextLive")}
              hint={t("nextLiveHint")}
              type="datetime-local"
              value={toLocalInput(block.startsAt)}
              onValue={(value) => set(block, { startsAt: fromLocalInput(value) })}
              error={err("startsAt")}
            />
            <div className="flex flex-wrap gap-2">
              {[
                { key: "today20", label: t("quickToday", { time: "20:00" }), at: atHour(0, 20) },
                { key: "today21", label: t("quickToday", { time: "21:00" }), at: atHour(0, 21) },
                { key: "tomorrow21", label: t("quickTomorrow", { time: "21:00" }), at: atHour(1, 21) },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => set(block, { startsAt: option.at })}
                  className="inline-flex h-control-sm items-center rounded-full border border-line-strong px-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:border-line-input hover:text-fg focus-visible:focus-ring"
                >
                  {option.label}
                </button>
              ))}
              {block.startsAt ? (
                <button
                  type="button"
                  onClick={() => set(block, { startsAt: undefined })}
                  className="inline-flex h-control-sm items-center rounded-full px-3 text-small font-medium text-fg-secondary hover:bg-hover focus-visible:focus-ring"
                >
                  {t("clearTime")}
                </button>
              ) : null}
            </div>
          </div>
        </>
      );
      break;
    case "project":
      // The project sheet has its own overview and panels; the schedule rows close its overview.
      return <ProjectForm block={block} onChange={onChange} errors={errors} err={err} schedule={<ScheduleRows block={block} onChange={onChange} />} />;
    case "about":
      fields = <AboutFields block={block} onChange={onChange} err={err} />;
      break;
    case "tools":
      fields = (
        <>
          <TextInput label={t("titleOptional")} value={block.title ?? ""} onValue={(title) => set(block, { title: title || undefined })} maxLength={80} />
          <ChipsInput
            label={tPortfolio("tools.items")}
            hint={tPortfolio("tools.hint")}
            values={block.items}
            onValues={(items) => set(block, { items })}
            max={12}
            maxLength={32}
            movable
            error={err("items")}
          />
        </>
      );
      break;
    case "timeline":
      fields = <TimelineFields block={block} onChange={onChange} err={err} />;
      break;
    case "quotes":
      fields = <QuotesFields block={block} onChange={onChange} err={err} />;
      break;
    case "contact":
      // Keyed by the block: the step fields keep their own places while one is typed in.
      fields = <ContactFields key={block.id} block={block} onChange={onChange} err={err} kind={kind} locale={doc.profile.locale} />;
      break;
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {fields}
      <ScheduleRows block={block} onChange={onChange} />
    </div>
  );
}

/** When a block shows: always, or only in a time window. */
function ScheduleRows({ block, onChange }: { block: Block; onChange: (block: Block) => void }) {
  const t = useTranslations("app.fields");
  return (
    <Disclosure summary={t("schedule")}>
      <p className="text-small text-fg-secondary">{t("scheduleHint")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          label={t("showFrom")}
          type="datetime-local"
          value={toLocalInput(block.schedule?.from)}
          onValue={(value) => onChange({ ...block, schedule: { ...block.schedule, from: fromLocalInput(value) } })}
        />
        <TextInput
          label={t("showUntil")}
          type="datetime-local"
          value={toLocalInput(block.schedule?.until)}
          onValue={(value) => onChange({ ...block, schedule: { ...block.schedule, until: fromLocalInput(value) } })}
        />
      </div>
    </Disclosure>
  );
}

type Err = (path: string) => string | undefined;

/** A year typed into a field: a whole number, or nothing. */
const yearOf = (text: string): number | undefined => {
  const value = Number.parseInt(text, 10);
  return Number.isInteger(value) ? value : undefined;
};

/** A section's own title, or none (the section then has no title of its own). */
function SectionTitle({ value, onValue }: { value: string | undefined; onValue: (title: string | undefined) => void }) {
  const t = useTranslations("app.fields");
  return <TextInput label={t("titleOptional")} value={value ?? ""} onValue={(title) => onValue(title || undefined)} maxLength={80} />;
}

function AboutFields({ block, onChange, err }: { block: BlockOf<"about">; onChange: (block: Block) => void; err: Err }) {
  const t = useTranslations("app.portfolio");
  const tFields = useTranslations("app.fields");
  type Fact = NonNullable<BlockOf<"about">["facts"]>[number];
  return (
    <>
      <SectionTitle value={block.title} onValue={(title) => onChange(withOptional(block, "title", title))} />
      <TextArea label={tFields("text")} value={block.text} onValue={(text) => onChange({ ...block, text })} max={1000} rows={6} error={err("text")} />
      <ImageInput label={t("about.portrait")} image={block.portrait} onImage={(portrait) => onChange(withOptional(block, "portrait", portrait))} />
      <FormSection title={t("about.addFact")} description={t("about.factsHint")}>
        <Repeater<Fact>
          items={block.facts ?? []}
          onItems={(facts) => onChange(withOptional(block, "facts", facts.length > 0 ? facts : undefined))}
          make={() => ({ label: "", value: "" })}
          max={4}
          itemLabel={(fact, index) => fact.label || `${t("about.factLabel")} ${String(index + 1)}`}
          addLabel={t("about.addFact")}
          render={(fact, update, index) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput label={t("about.factLabel")} value={fact.label} onValue={(label) => update({ ...fact, label })} maxLength={24} error={err(`facts.${String(index)}.label`)} />
              <TextInput label={t("about.factValue")} value={fact.value} onValue={(value) => update({ ...fact, value })} maxLength={40} error={err(`facts.${String(index)}.value`)} />
            </div>
          )}
        />
      </FormSection>
    </>
  );
}

/** An object with an optional key set, or without the key when the value is empty (never `key: undefined`). */
function withOptional<T extends object, K extends keyof T>(object: T, key: K, value: T[K] | undefined | ""): T {
  const { [key]: _old, ...rest } = object;
  return (value === undefined || value === "" ? rest : { ...rest, [key]: value }) as T;
}

function TimelineFields({ block, onChange, err }: { block: BlockOf<"timeline">; onChange: (block: Block) => void; err: Err }) {
  const t = useTranslations("app.portfolio");
  const tFields = useTranslations("app.fields");
  type Entry = BlockOf<"timeline">["items"][number];
  return (
    <>
      <SectionTitle value={block.title} onValue={(title) => onChange(withOptional(block, "title", title))} />
      <Repeater<Entry>
        items={block.items}
        onItems={(items) => onChange({ ...block, items })}
        make={() => ({ role: "", years: { from: new Date().getFullYear() } })}
        min={1}
        max={6}
        itemLabel={(item, index) => item.role || t("timeline.entryN", { n: index + 1 })}
        addLabel={t("timeline.add")}
        render={(item, update, index) => {
          const path = `items.${String(index)}`;
          const to = item.years.to;
          return (
            <>
              <TextInput label={t("timeline.role")} value={item.role} onValue={(role) => update({ ...item, role })} maxLength={60} error={err(`${path}.role`)} />
              <TextInput label={t("timeline.org")} value={item.org ?? ""} onValue={(org) => update(withOptional(item, "org", org))} maxLength={60} />
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label={t("yearFrom")}
                  type="number"
                  inputMode="numeric"
                  value={String(item.years.from)}
                  onValue={(text) => update({ ...item, years: { ...item.years, from: yearOf(text) ?? item.years.from } })}
                  error={err(`${path}.years.from`)}
                />
                <TextInput
                  label={t("yearTo")}
                  type="number"
                  inputMode="numeric"
                  value={typeof to === "number" ? String(to) : ""}
                  disabled={to === "now"}
                  onValue={(text) => {
                    const value = yearOf(text);
                    update({ ...item, years: value === undefined ? { from: item.years.from } : { from: item.years.from, to: value } });
                  }}
                  error={err(`${path}.years.to`)}
                />
              </div>
              <SwitchRow label={t("untilToday")} checked={to === "now"} onChecked={(on) => update({ ...item, years: on ? { from: item.years.from, to: "now" } : { from: item.years.from } })} />
              <TextInput label={t("timeline.note")} value={item.note ?? ""} onValue={(note) => update(withOptional(item, "note", note))} maxLength={120} />
              <UrlInput label={tFields("urlOptional")} value={item.url ?? ""} onValue={(url) => update(withOptional(item, "url", url))} error={err(`${path}.url`)} />
            </>
          );
        }}
      />
    </>
  );
}

function QuotesFields({ block, onChange, err }: { block: BlockOf<"quotes">; onChange: (block: Block) => void; err: Err }) {
  const t = useTranslations("app.portfolio.quotes");
  const { doc } = useSite();
  type Quote = BlockOf<"quotes">["items"][number];
  const projects = doc.blocks.filter((candidate): candidate is BlockOf<"project"> => candidate.type === "project");
  return (
    <>
      <SectionTitle value={block.title} onValue={(title) => onChange(withOptional(block, "title", title))} />
      {err("items") ? <p className="text-small text-danger-strong">{err("items")}</p> : null}
      <Repeater<Quote>
        items={block.items}
        onItems={(items) => onChange({ ...block, items })}
        // Not confirmed yet: the quote cannot be saved until its owner says they may publish it.
        make={() => ({ text: "", name: "", role: "", consent: false as unknown as true })}
        max={6}
        itemLabel={(item, index) => item.name || t("entryN", { n: index + 1 })}
        addLabel={t("add")}
        render={(item, update, index) => {
          const path = `items.${String(index)}`;
          const consented = item.consent as boolean;
          return (
            <>
              <TextArea label={t("text")} value={item.text} onValue={(text) => update({ ...item, text })} max={280} rows={3} error={err(`${path}.text`)} />
              <TextInput label={t("name")} value={item.name} onValue={(name) => update({ ...item, name })} maxLength={60} error={err(`${path}.name`)} />
              <TextInput label={t("role")} hint={t("roleHint")} value={item.role} onValue={(role) => update({ ...item, role })} maxLength={80} error={err(`${path}.role`)} />
              <ImageInput label={t("photo")} kind="avatar" shape="round" withAlt={false} image={item.photo} onImage={(photo) => update(withOptional(item, "photo", photo))} />
              {projects.length > 0 ? (
                <SelectField
                  label={t("about")}
                  value={item.project ?? ""}
                  onValue={(project) => update(withOptional(item, "project", project))}
                  options={[{ value: "", label: t("aboutNone") }, ...projects.map((project) => ({ value: project.id, label: project.title }))]}
                />
              ) : null}
              {/* Without it the quote is not saved: the reason stands right under the switch. */}
              <SwitchRow label={t("consent")} description={consented ? undefined : t("consentMissing")} checked={consented} onChecked={(on) => update({ ...item, consent: on as true })} />
              {err(`${path}.consent`) ? (
                <p role="alert" className="text-small text-danger-strong">
                  {err(`${path}.consent`)}
                </p>
              ) : null}
            </>
          );
        }}
      />
    </>
  );
}

function ContactFields({
  block,
  onChange,
  err,
  kind,
  locale,
}: {
  block: BlockOf<"contact">;
  onChange: (block: Block) => void;
  err: Err;
  kind: CreatorKind | undefined;
  locale: Page["profile"]["locale"];
}) {
  const t = useTranslations("app.portfolio.contact");
  const tFields = useTranslations("app.fields");
  const tPlatforms = useTranslations("app.welcome.platforms");
  type Way = NonNullable<BlockOf<"contact">["links"]>[number];
  // The three step fields keep their places while the owner types (an empty first step does not pull
  // the second one up into it); the block stores only the filled ones, in order.
  const [steps, setSteps] = useState(() => [0, 1, 2].map((index) => block.steps?.[index] ?? ""));
  return (
    <>
      {err("page") ? (
        <p role="alert" className="rounded-md border border-danger-strong bg-danger-subtle p-3 text-small">
          {err("page")}
        </p>
      ) : null}
      <TextInput label={t("title")} value={block.title} onValue={(title) => onChange({ ...block, title })} maxLength={80} error={err("title")} />
      <TextInput label={t("text")} value={block.text ?? ""} onValue={(text) => onChange(withOptional(block, "text", text))} maxLength={160} />
      <FormSection title={t("primary")}>
        <ReachInput value={block.primary} onValue={(primary) => onChange({ ...block, primary })} kind={kind} locale={locale} errors={{ url: err("primary.url"), label: err("primary.label") }} />
      </FormSection>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label={t("status")} hint={t("statusHint")} value={block.status ?? ""} onValue={(status) => onChange(withOptional(block, "status", status))} maxLength={40} />
        <TextInput
          label={t("statusUntil")}
          type="date"
          value={block.statusUntil ?? ""}
          disabled={!block.status}
          onValue={(until) => onChange(withOptional(block, "statusUntil", until))}
          error={err("statusUntil")}
        />
      </div>
      <FormSection title={t("other")}>
        <Repeater<Way>
          items={block.links ?? []}
          onItems={(links) => onChange(withOptional(block, "links", links.length > 0 ? links : undefined))}
          make={() => ({ kind: "email", url: "" })}
          max={3}
          itemLabel={(way) => t(`kinds.${way.kind}`)}
          addLabel={t("addWay")}
          render={(way, update, index) => (
            <>
              {/* A new kind shapes the address again: a number moves from phone to WhatsApp as a chat link. */}
              <SelectField<ContactKind> label={tFields("kind")} value={way.kind} onValue={(next) => update(shapeWay({ ...way, kind: next }))} options={CONTACT_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))} />
              {isReachWay(way.kind) ? (
                // Typed as the owner writes it; the address its kind builds is made when the field is left.
                <TextInput
                  label={tFields("url")}
                  hint={way.kind === "whatsapp" ? tPlatforms("whatsapp") : undefined}
                  ltr
                  type={way.kind === "email" ? "email" : way.kind === "calendar" ? "url" : "tel"}
                  inputMode={way.kind === "email" ? "email" : way.kind === "calendar" ? "url" : "tel"}
                  autoCapitalize="none"
                  spellCheck={false}
                  value={reachFrom(way.url).typed}
                  onValue={(url) => update({ ...way, url })}
                  onBlur={() => update(shapeWay(way))}
                  error={err(`links.${String(index)}.url`)}
                />
              ) : (
                <UrlInput label={tFields("url")} hint={way.kind === "cv" ? t("cvHint") : undefined} value={way.url} onValue={(url) => update({ ...way, url })} error={err(`links.${String(index)}.url`)} />
              )}
              <TextInput label={tFields("titleOptional")} value={way.label ?? ""} onValue={(label) => update(withOptional(way, "label", label))} maxLength={40} />
            </>
          )}
        />
      </FormSection>
      <FormSection title={t("steps")}>
        {steps.map((text, index) => (
          <TextInput
            key={index}
            label={t("stepN", { n: index + 1 })}
            value={text}
            maxLength={80}
            onValue={(value) => {
              const slots = steps.map((step, i) => (i === index ? value : step));
              setSteps(slots);
              const next = slots.filter((step) => step.trim() !== "");
              onChange(withOptional(block, "steps", next.length > 0 ? next : undefined));
            }}
          />
        ))}
      </FormSection>
    </>
  );
}


/** Settings most blocks never need, folded away under a one-line summary (the schedule, a link's extras). */
function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-line bg-surface">
      <summary className="flex h-control-lg cursor-pointer items-center justify-between rounded-md px-3 text-small font-medium focus-visible:focus-ring">{summary}</summary>
      <div className="grid grid-cols-1 gap-4 border-t border-line p-3">{children}</div>
    </details>
  );
}
