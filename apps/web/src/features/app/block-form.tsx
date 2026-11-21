"use client";

import {
  APP_PRICING,
  APP_STORES,
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
  type LinkIcon,
  type Platform,
  type VideoPlayback,
} from "@linkyo/blocks";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";

import { platformName } from "@/features/directions/shared/creator-kit";
import { STORE_NAMES } from "@/features/directions/shared/stores";

import { FormSection, ImageInput, Repeater, SelectField, SwitchRow, TextArea, TextInput, UrlInput } from "./form";
import { fetchLinkMetadata, installCommand } from "./metadata";
import type { FieldErrors } from "./validate";

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
        const now = latest.current.block;
        if (!meta?.title || now.type !== "link" || now.title !== site) return;
        filled.current = meta.title;
        latest.current.onChange({ ...now, title: meta.title });
      });
    }, TITLE_DELAY);
    return () => window.clearTimeout(timer);
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
export function BlockForm({ block, onChange, errors, creating = false }: { block: Block; onChange: (block: Block) => void; errors: FieldErrors; creating?: boolean }) {
  const t = useTranslations("app.fields");
  const tErr = useTranslations("app.errors");
  useLinkTitle(block, onChange, creating);
  const err = (path: string) => (errors[path] ? tErr(errors[path]) : undefined);
  const set = <B extends Block>(current: B, patch: Partial<B>) => onChange({ ...current, ...patch });

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
            make={() => ({ date: new Date().toISOString().slice(0, 10), city: "", venue: "", url: "", status: "onsale" as const })}
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
            make={() => ({ name: "", logo: noImage })}
            min={1}
            max={24}
            itemLabel={(item, index) => item.name || t("partnerN", { n: index + 1 })}
            addLabel={t("addPartner")}
            render={(item, update, index) => (
              <>
                <ImageInput label={t("logo")} kind="logo" image={item.logo} onImage={(logo) => update({ ...item, logo: logo ?? noImage })} withAlt={false} />
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
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {fields}
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
    </div>
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
