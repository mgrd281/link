"use client";

import { detectLink, detectMany, normalizeUrl, slugWord, type Block, type BlockOf, type BlockType, type CreatorKind, type Detection, type Platform } from "@linkyo/blocks";
import { Badge, Button, cn, ConfirmDialog, Icon, toast } from "@linkyo/ui";
import { Building2, CircleAlert, ClipboardPaste, FolderKanban, ImagePlus, Images, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

import { accountStore } from "@/features/account/store";
import { showsFromTickets } from "@/features/directions/editor/state";
import { blockIcon } from "@/features/directions/editor/ui";
import { canReadClipboard, readText } from "@/lib/clipboard";
import { linkOnlyPlatform } from "@/lib/link-metadata";
import { supabaseEnabled } from "@/lib/supabase/config";

import { BlockEditorFields, useBlockEditor } from "./block-editor";
import { ADD_PRESETS, addGroups, blankBlock, blockFromLink, insertAt, newBlockId, presetBlock, type AddPreset } from "./blocks";
import { useShowRules } from "./edit-sheet";
import { readSharedOffer, subscribeSharedOffer, takeSharedOffer } from "./install/intents";
import { ImageError, pickFiles, prepareAndStore, projectPictureLimit, storedImage, workImageKind } from "./images";
import { isPortfolioKind, titleKeys } from "./kinds";
import { useMediaOwner } from "./media-owner";
import { fetchLinkMetadata } from "./metadata";
import { PreviewButton } from "./preview";
import { projectFromLink, projectFromPictures, projectFromRepository, startedBlock } from "./project-form";
import { useShellChrome } from "./screen";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";
import { inPage } from "./validate";

// Whether the clipboard can be read never changes while the page is open; the server can't know it.
const never = () => () => undefined;

/**
 * Add anything from one sheet: paste a link (we recognise the platform and make the right block),
 * upload photos, or pick a type from a few short groups, the first one fitted to the kind of page.
 * A picked type opens its form right in this sheet (a second step with "‹ Back", as on iOS), so there
 * is one sheet the whole time. Pasted links and picked types land in the same place. Reachable from
 * every screen (sidebar, tab bar, the editor's buttons and its "Add below").
 */
/** The icon of a preset entry (a block of an existing type, started for one purpose). */
const PRESET_ICONS: Record<AddPreset, typeof Building2> = { clients: Building2 };

/**
 * A type's card. Two across on a phone, the glyph above its name: beside it, a card is 170 px wide and
 * the name has 92 px, so "Kundenstimmen" (109 px) was cut in two ("Kundenstim-men"). Stacked, the name
 * has the card's whole 144 px. From `sm` the glyph stands beside the name again (three across).
 */
const CARD =
  "flex flex-col items-start gap-2 rounded-lg border border-line bg-surface p-3 text-start transition-[background-color,border-color,scale] duration-micro hover:border-line-input focus-visible:focus-ring active:scale-pressed active:bg-pressed motion-reduce:active:scale-none sm:flex-row sm:items-center sm:gap-3";
/** The name on a card: whole words only. Hyphenation off (it broke "Kundenstimmen" mid-word); `break-words` only as the last resort for a word wider than the card. */
const CARD_NAME = "text-small font-semibold break-words";

/** One entry of a group in the sheet: a block type, or a preset (a block of a type, already set up). */
type AddEntry = { type: BlockType; preset?: undefined } | { type?: undefined; preset: AddPreset };

/** A group's entries in order: its presets ("Clients") right after its quotes, else at its end. */
export function addEntries(types: readonly BlockType[], presets: readonly AddPreset[]): AddEntry[] {
  const quotes = types.indexOf("quotes");
  const cut = quotes < 0 ? types.length : quotes + 1;
  return [...types.slice(0, cut).map((type) => ({ type })), ...presets.map((preset) => ({ preset })), ...types.slice(cut).map((type) => ({ type }))];
}

/** Platforms whose profile address belongs in the page's Social icons row. */
const SOCIAL_PLATFORMS: ReadonlySet<string> = new Set<Platform>(["instagram", "tiktok", "x", "threads", "bluesky", "discord", "whatsapp", "telegram", "facebook", "linkedin", "github", "youtube", "twitch"]);
/** Paths on those platforms that are one post, not a profile. */
const POST_PATHS: ReadonlySet<string> = new Set(["status", "post", "posts", "feed", "pulse", "p", "reel", "video"]);
/** The Social icons row holds at most this many (the socials block's schema). */
export const SOCIALS_MAX = 12;

/**
 * A pasted address that is a profile on a social platform (instagram.com/mila, a YouTube or Twitch
 * channel, a GitHub account) as an item of the Social icons row; null for anything else: a post, a
 * song, a shop, a platform's front page.
 */
export function socialProfile(detection: Detection | null): { platform: Platform; url: string } | null {
  if (!detection?.platform || !SOCIAL_PLATFORMS.has(detection.platform)) return null;
  const kind = detection.type === "link" || (detection.platform === "youtube" && detection.type === "shorts") || (detection.platform === "twitch" && detection.type === "live");
  const segments = new URL(detection.url).pathname.split("/").filter(Boolean);
  if (!kind || segments.length === 0 || segments.some((segment) => POST_PATHS.has(segment.toLowerCase()))) return null;
  return { platform: detection.platform as Platform, url: detection.url };
}

/** A profile address without what does not tell profiles apart: "www.", a trailing slash, letter case. */
const profileKey = (address: string) => {
  try {
    const url = new URL(address);
    return `${url.hostname.replace(/^(www|m)\./, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return address.toLowerCase();
  }
};

/** Two addresses of the same profile ("https://www.instagram.com/Mila/" and "https://instagram.com/mila"). */
export const sameProfile = (a: string, b: string) => profileKey(a) === profileKey(b);

/**
 * The door the sheet was opened at. "all": everything (the rail, the tab bar, a row's "Add below").
 * "workLink": straight at a project from a link (Arbeiten's "From a link"): only the link field,
 * and what is pasted there becomes a project, never a plain block.
 */
export type AddDoor = "all" | "workLink";

export function AddSheet({ entry = "all" }: { entry?: AddDoor } = {}) {
  const t = useTranslations("app.add");
  const tEdit = useTranslations("app.edit");
  const tTypes = useTranslations("dashboard.types");
  const tFields = useTranslations("app.fields");
  const tPortfolio = useTranslations("app.portfolio");
  const tShare = useTranslations("app.share");
  const tApp = useTranslations("app");
  const { addOpen, setAddOpen, addIndex, addBlocks, edit, editing, doc, site, dispatch, latest } = useSite();
  const kind = site.kind as CreatorKind | undefined;
  // While the sheet slides away it keeps showing the door it was opened at.
  const [shownEntry, setShownEntry] = useState(entry);
  if (addOpen && shownEntry !== entry) setShownEntry(entry);
  const workLink = (addOpen ? entry : shownEntry) === "workLink";
  // Pages that show work: a pasted link can become a project, so pasting waits for the choice.
  const portfolio = isPortfolioKind(kind);
  // Photos picked for a choice ("as a gallery" or "as a project"), and the line a new project opens with.
  const [photos, setPhotos] = useState<File[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const inShell = useShellChrome();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  // A link shared into Linkyo (the installed app's share target) waits in the field as if pasted;
  // when nothing usable was shared, the hint says so instead (install/intents.ts).
  const sharedOffer = useSyncExternalStore(subscribeSharedOffer, readSharedOffer, () => null);
  const [takenOffer, setTakenOffer] = useState(0);
  const [sharedNone, setSharedNone] = useState(false);
  if (addOpen && sharedOffer && sharedOffer.id !== takenOffer) {
    setTakenOffer(sharedOffer.id);
    setValue(sharedOffer.link ?? "");
    setError(false);
    setSharedNone(sharedOffer.link === null);
  }
  if (!addOpen && sharedNone) setSharedNone(false);
  useEffect(() => {
    if (takenOffer) takeSharedOffer(takenOffer);
  }, [takenOffer]);
  const [uploading, setUploading] = useState(false);
  const canPaste = useSyncExternalStore(never, canReadClipboard, () => false);
  const detection = useMemo(() => (value.trim() ? detectLink(value.trim()) : null), [value]);
  // One profile on a social platform in the field: it can go to the Social icons row instead (D-16).
  const social = useMemo(() => (detectMany(value).length === 1 ? socialProfile(detection) : null), [value, detection]);
  const labels = useMemo(() => ({ video: tTypes("video"), music: tTypes("music"), event: tTypes("events") }), [tTypes]);
  // Real accounts have no newsletter backend yet: the block is not offered (public pages drop it too).
  // A group's presets (Portfolio: "Clients") stand right after its quotes, else at its end.
  const groups = useMemo(
    () =>
      addGroups(site.kind)
        .map((group) => (accountStore.demo ? group : { ...group, types: group.types.filter((candidate) => candidate !== "newsletter") }))
        .map((group) => ({ key: group.key, entries: addEntries(group.types, (Object.hasOwn(ADD_PRESETS, group.key) ? ADD_PRESETS[group.key as keyof typeof ADD_PRESETS] : []) as readonly AddPreset[]) }))
        .filter((group) => group.entries.length > 0),
    [site.kind],
  );

  // The second step: the block picked here, filled in right in this sheet.
  const current = editing?.mode === "create" && editing.inAddSheet ? editing : null;
  // While the sheet slides away it keeps showing the step it was closed on.
  const [shown, setShown] = useState(current);
  if (addOpen && shown !== current) setShown(current);
  const step = addOpen ? current : shown;
  // A show is added only with its date and city (see `useShowRules`).
  const editor = useShowRules(useBlockEditor({ source: step?.block ?? null, creating: true, index: step?.index }));
  const [discard, setDiscard] = useState<"back" | "close" | null>(null);
  // The sheet can close without asking (Back to another screen closes it): its question goes with it.
  if (!addOpen && discard !== null) setDiscard(null);

  const close = () => {
    // Also forgets the place chosen with "Add below".
    setAddOpen(false);
    setValue("");
    setError(false);
    setPhotos(null);
    setNotice(null);
    if (current) edit(null);
  };
  // Leaving a form with changes asks first (closing, and going back to the types).
  const requestClose = () => {
    if (step && editor.dirty) setDiscard("close");
    else close();
  };
  // Back to the types: what was pasted is still in the field.
  const back = () => {
    if (editor.dirty) setDiscard("back");
    else {
      setNotice(null);
      edit(null);
    }
  };
  const save = () => {
    if (editor.save()) close();
  };

  const addText = (text: string) => {
    const found = detectMany(text);
    if (found.length === 0) {
      setValue(text);
      setError(true);
      document.getElementById(inputId)?.focus();
      return;
    }
    // A ticket link knows no date and no city, so it never becomes a show by itself: it opens the
    // Events form with its address filled in and the rest for the owner (one show per ticket link).
    // Every other link is added right away, as before.
    const tickets = found.filter((detection) => detection.type === "events");
    const rest = found.filter((detection) => detection.type !== "events");
    if (rest.length > 0) {
      addBlocks(
        rest.map((d) => blockFromLink(d, labels, doc.profile.displayName)),
        // While the Events form stays open, the toast offers no "Edit": it would drop that form.
        { index: addIndex, ...(tickets.length > 0 ? { open: false } : {}) },
      );
    }
    if (tickets.length === 0) {
      close();
      return;
    }
    setValue("");
    setError(false);
    create(showsFromTickets(tickets), t("ticketNotice", { count: tickets.length }));
  };

  // A single pasted link that has a second home waits in the field for the owner's choice: on a page
  // that shows work it can become a project, and a social profile can go to the Social icons row.
  const waits = (text: string) => {
    const found = detectMany(text);
    return found.length === 1 && (portfolio || socialProfile(found[0] ?? null) !== null);
  };

  // One tap instead of long-press and Paste. iOS asks once with its own Paste button; when reading is
  // refused or the clipboard is empty, the field takes focus so the usual paste still works.
  const paste = async () => {
    const text = await readText();
    if (text && (workLink || waits(text))) setValue(text.trim());
    else if (text) addText(text);
    else document.getElementById(inputId)?.focus();
  };

  // The same place as a pasted link. A new section, and the contact block that closes the page, go to the end.
  const placeFor = (type: BlockType) => addIndex ?? (type === "header" || type === "contact" ? undefined : insertAt(doc.blocks));
  const create = (block: Block, line: string | null = null) => {
    setNotice(line);
    edit({ mode: "create", block: inPage(block, doc.blocks), index: placeFor(block.type), inAddSheet: true });
  };

  // A profile into the Social icons row: the row there is grows by one (one step to undo), or a new
  // row starts with it. A profile already in the row, or a full row, is said, never added twice.
  const addToSocials = () => {
    if (!social) return;
    const row = doc.blocks.find((block): block is BlockOf<"socials"> => block.type === "socials");
    if (!row) {
      addBlocks([{ id: newBlockId("socials"), type: "socials", visible: true, highlight: false, items: [social] }], { index: placeFor("socials") });
      close();
      return;
    }
    if (row.items.some((item) => sameProfile(item.url, social.url))) {
      toast({ title: tShare("socialsHas") });
      close();
      return;
    }
    if (row.items.length >= SOCIALS_MAX) {
      toast({ title: tShare("socialsFull", { count: SOCIALS_MAX }), tone: "danger" });
      return;
    }
    const before = latest();
    dispatch({ type: "update", id: row.id, patch: { items: [...row.items, social] } });
    toast({
      title: tShare("addedToSocials"),
      tone: "success",
      undoable: { before, latestOnly: true },
      action: { label: tApp("undo"), onAction: () => dispatch({ type: "undo" }) },
    });
    close();
  };

  const pick = (type: BlockType) => {
    // A page has one contact block: its entry opens the one there is.
    const contact = type === "contact" ? doc.blocks.find((block) => block.type === "contact") : undefined;
    if (contact) {
      close();
      edit({ mode: "edit", id: contact.id });
      return;
    }
    // A new portfolio section starts with the kind's title and, for quotes, one quote to fill in.
    const blank = blankBlock(type, { artist: doc.profile.displayName, newsletter: tFields("newsletterDefault") });
    // A new show starts without a date (blankBlock), like one from a ticket link.
    create(startedBlock(blank, kind, (key) => tPortfolio(key as "sentence")));
  };

  const pickPreset = (preset: AddPreset) => create(presetBlock(preset, { clients: tPortfolio(titleKeys(kind).clients) }));

  // A link as a project. Details arrive only where a platform gives them (GitHub's API for a
  // repository); any other address is kept as the project's link, and the title is the owner's.
  const linkAsProject = async () => {
    const address = normalizeUrl(value.trim());
    if (!address || !/^https?:$/.test(address.protocol)) {
      setError(true);
      document.getElementById(inputId)?.focus();
      return;
    }
    const url = address.toString();
    const id = newBlockId("project");
    const word = slugWord(doc.profile.locale);
    const found = detectLink(url);
    const platform = linkOnlyPlatform(url);
    setLinking(true);
    try {
      if (found?.type === "repo" && found.id) {
        const [owner = "", repo = ""] = found.id.split("/");
        const meta = await fetchLinkMetadata(`https://github.com/${owner}/${repo}`);
        create(projectFromRepository(id, { url, owner, repo }, meta, doc.blocks, word, new Date().toISOString().slice(0, 10)));
      } else if (platform) {
        create(projectFromLink(id, url, undefined, doc.blocks, word), tPortfolio("linkOnly", { platform }));
      } else {
        // Our server only knows titles for platforms it recognises (it answers nothing for other sites).
        const meta = found?.platform ? await fetchLinkMetadata(url) : null;
        create(projectFromLink(id, url, meta?.title, doc.blocks, word), meta?.title ? null : tPortfolio("linkKept"));
      }
      setValue("");
    } finally {
      setLinking(false);
    }
  };

  // The project's title takes the focus when the sheet says what to add (a link was kept).
  useEffect(() => {
    if (!notice || !step) return;
    document.querySelector<HTMLInputElement>("[role=dialog] [data-project-title]")?.focus();
  }, [notice, step]);
  // That line is read out: its live region is on the page first and the words arrive a frame later
  // (a region inserted already filled is not reliably announced).
  const [spoken, setSpoken] = useState<string | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSpoken(step ? notice : null));
    return () => cancelAnimationFrame(frame);
  }, [notice, step]);

  const owner = useMediaOwner();
  // One picture becomes an image; several ask first whether they are a gallery or a project.
  const upload = async () => {
    const files = await pickFiles({ multiple: true });
    if (files.length === 0) return;
    if (files.length > 1) setPhotos(files);
    else await store(files, "gallery");
  };
  const store = async (files: File[], as: "gallery" | "project") => {
    setUploading(true);
    try {
      const real = supabaseEnabled;
      // A project keeps its cover and as many pictures as it holds: only those are prepared and stored
      // (a file uploaded and then dropped would wait in Storage with nothing pointing to it).
      const cap = as === "project" ? projectPictureLimit(real) + 1 : 24;
      const images = await Promise.all(files.slice(0, cap).map((file) => prepareAndStore(file, as === "project" ? workImageKind(real) : "photo", owner)));
      setPhotos(null);
      if (as === "project") {
        // The demo says why some were left out; a real account sees "20 of 20" on the Pictures row.
        create(projectFromPictures(newBlockId("project"), images, real), files.length > cap && !real ? tPortfolio("demoPictures") : null);
        return;
      }
      const base = { visible: true, highlight: false };
      const first = images[0];
      const block: Block | null =
        images.length === 1 && first
          ? { ...base, id: newBlockId("image"), type: "image", image: storedImage(first) }
          : images.length > 1
            ? { ...base, id: newBlockId("gallery"), type: "gallery", images: images.map((image) => storedImage(image)) }
            : null;
      if (block) addBlocks([block], { index: addIndex });
      close();
    } catch (problem) {
      toast({ title: t(`imageErrors.${problem instanceof ImageError ? problem.reason : "decode"}`), tone: "danger" });
    } finally {
      setUploading(false);
    }
  };

  const type = step ? tTypes(step.block.type) : "";
  return (
    <>
      <Sheet
        open={addOpen}
        onOpenChange={(open) => (open ? setAddOpen(true, addIndex) : requestClose())}
        step={step ? "form" : "pick"}
        detent="large"
        title={step ? tEdit("addTitle", { type }) : workLink ? t("work.title") : t("title")}
        description={step ? tEdit(`hints.${step.block.type}`) : workLink ? t("work.lead") : t("lead")}
        closeLabel={t("close")}
        besidePreview
        back={step ? { label: tEdit("back"), onBack: back } : undefined}
        // Hidden where the page shows beside the sheet: from desk in the dashboard, from xl in the team area.
        headerAction={step ? <PreviewButton className={inShell ? "desk:hidden" : "xl:hidden"} /> : undefined}
        // The navigation row has room for one short word; the button's name stays "Add to page".
        confirm={step ? { label: tEdit("addShort"), ariaLabel: tEdit("add"), onConfirm: save } : undefined}
        footer={
          step ? (
            <>
              <Button variant="ghost" onClick={requestClose}>
                {tEdit("cancel")}
              </Button>
              <Button variant="primary" onClick={save}>
                {tEdit("add")}
              </Button>
            </>
          ) : undefined
        }
      >
        {step && editor.draft ? (
          <div className="grid grid-cols-1 gap-4">
            <p role="status" className="rounded-md border border-line-strong bg-surface p-3 text-small empty:hidden">
              {spoken}
            </p>
            <BlockEditorFields editor={{ ...editor, draft: editor.draft }} creating onSave={save} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!value.trim()) return;
                // From Arbeiten the link becomes a project; anywhere else, the block it is.
                if (workLink) void linkAsProject();
                else addText(value);
              }}
              className="grid grid-cols-1 gap-3"
            >
              <label htmlFor={inputId} className="text-small font-semibold">
                {workLink ? t("work.label") : t("pasteLabel")}
              </label>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border ps-4 pe-2 transition-[border-color,background-color] duration-micro ease-standard has-[input:focus-visible]:focus-field",
                  error
                    ? "border-danger-strong bg-danger-subtle [--color-focus:var(--color-danger-strong)]"
                    : "border-line-input bg-surface-elevated hover:border-fg-tertiary has-[input:focus-visible]:border-focus",
                )}
              >
                <Icon icon={Link2} size="md" className="shrink-0 text-fg-tertiary" />
                <input
                  id={inputId}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    setError(false);
                    setSharedNone(false);
                  }}
                  onPaste={(event) => {
                    const text = event.clipboardData.getData("text");
                    // One link on a page that shows work, or one social profile, waits in the field: it
                    // may become a project or a social icon. At Arbeiten's door every link waits: it
                    // becomes a project when sent.
                    if (workLink || waits(text)) return;
                    if (!value && detectMany(text).length > 0) {
                      event.preventDefault();
                      addText(text);
                    }
                  }}
                  dir="ltr"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={workLink ? t("work.placeholder") : t("pastePlaceholder")}
                  aria-invalid={error || undefined}
                  aria-describedby={`${inputId}-hint`}
                  className="h-control-xl min-w-0 flex-1 bg-transparent text-body-lg outline-none placeholder:text-fg-tertiary"
                />
                {/* Empty field: paste in one tap. With text: add it. Without clipboard access: Add waits for text. */}
                {!value.trim() && canPaste ? (
                  <Button type="button" variant="tinted" size="sm" icon={ClipboardPaste} onClick={() => void paste()}>
                    {t("paste")}
                  </Button>
                ) : (
                  <Button type="submit" variant="primary" size="sm" disabled={!value.trim()} loading={workLink && linking}>
                    {workLink ? t("work.submit") : t("addButton")}
                  </Button>
                )}
              </div>
              {/* Read out when a platform is recognised; the error interrupts. */}
              <p id={`${inputId}-hint`} aria-live="polite" className={error ? "text-small text-danger-strong" : "min-h-control-sm text-small text-fg-secondary"}>
                {error ? (
                  <span role="alert" className="flex items-start gap-2">
                    <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
                    {t("invalid")}
                  </span>
                ) : workLink ? null : detection ? (
                  <Badge tone="primary">{t("detected", { type: tTypes(detection.type === "shorts" ? "link" : detection.type) })}</Badge>
                ) : sharedNone ? (
                  tShare("sharedNone")
                ) : (
                  t("pasteHint")
                )}
              </p>
              {/* Under the detected block: a social profile into the Social icons row, any other link as a piece of work. */}
              {detection && value.trim() && !workLink ? (
                social ? (
                  <Button type="button" variant="ghost" icon={blockIcon.socials} className="justify-self-start" onClick={addToSocials}>
                    {tShare("addToSocials")}
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" icon={FolderKanban} loading={linking} className="justify-self-start" onClick={() => void linkAsProject()}>
                    {t("asProject")}
                  </Button>
                )
              ) : null}
            </form>

            {workLink ? null : (
            <div className="grid grid-cols-1 gap-2">
              <Button variant="tinted" size="lg" block icon={ImagePlus} loading={uploading && photos === null} onClick={() => void upload()}>
                {t("photos")}
              </Button>
              {photos ? (
                // Several pictures: a gallery, or the pictures of one piece of work (the first is its cover).
                <div role="group" aria-label={t("photos")} className="grid grid-cols-2 gap-2">
                  <Button size="lg" icon={Images} disabled={uploading} onClick={() => void store(photos, "gallery")}>
                    {t("photosAsGallery")}
                  </Button>
                  <Button size="lg" variant="primary" icon={FolderKanban} loading={uploading} onClick={() => void store(photos, "project")}>
                    {t("photosAsProject")}
                  </Button>
                </div>
              ) : (
                <p className="text-caption text-fg-secondary">{t("photosHint")}</p>
              )}
            </div>
            )}

            {(workLink ? [] : groups).map((group) => (
              <section key={group.key} aria-labelledby={`${inputId}-${group.key}`} className="grid grid-cols-1 gap-2">
                <h3 id={`${inputId}-${group.key}`} className="text-small font-semibold text-fg-secondary">
                  {t(`groups.${group.key}`)}
                </h3>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.entries.map((entry) =>
                    entry.type ? (
                    <li key={entry.type} className="grid min-w-0">
                      {/* The name starts with the type ("Link Any website …"), then what it is for. */}
                      <button
                        type="button"
                        data-type={entry.type}
                        onClick={() => pick(entry.type)}
                        className={CARD}
                      >
                        <span className="grid size-control-md shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg">
                          <Icon icon={blockIcon[entry.type]} size="md" />
                        </span>
                        <span className="grid min-w-0">
                          <span className={CARD_NAME}>{tTypes(entry.type)}</span>
                          <span className="text-caption text-fg-secondary">{t(`desc.${entry.type}`)}</span>
                        </span>
                      </button>
                    </li>
                    ) : (
                    <li key={entry.preset} className="grid min-w-0">
                      <button
                        type="button"
                        data-preset={entry.preset}
                        onClick={() => pickPreset(entry.preset)}
                        className={CARD}
                      >
                        <span className="grid size-control-md shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg">
                          <Icon icon={PRESET_ICONS[entry.preset]} size="md" />
                        </span>
                        <span className="grid min-w-0">
                          <span className={CARD_NAME}>{t(`presets.${entry.preset}`)}</span>
                          <span className="text-caption text-fg-secondary">{t(`desc.${entry.preset}`)}</span>
                        </span>
                      </button>
                    </li>
                    ),
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={discard !== null}
        onOpenChange={(open) => {
          if (!open) setDiscard(null);
        }}
        title={tEdit("discardTitle")}
        description={tEdit("discardBody")}
        confirmLabel={tEdit("discard")}
        cancelLabel={tEdit("keepEditing")}
        onConfirm={() => {
          const leaving = discard;
          setDiscard(null);
          if (leaving === "back") {
            setNotice(null);
            edit(null);
          } else close();
        }}
      />
    </>
  );
}
