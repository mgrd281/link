import { MAX_PROJECTS, NO_IMAGE, PLATFORMS, slugFor, type Block, type BlockOf, type Detection, type Platform } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import type { TileSize } from "../mosaic/renderer";

export interface EditorDoc {
  blocks: Block[];
  sizes: Record<string, TileSize>;
  theme: CreatorThemeConfig;
}

export interface EditorState<D extends EditorDoc = EditorDoc> {
  past: D[];
  present: D;
  future: D[];
  selectedId: string | null;
}

export type EditorAction =
  | { type: "add"; block: Block; index?: number }
  | { type: "update"; id: string; patch: Partial<Block> }
  /** Details fetched for a block after it was added (title, cover): no undo step of its own. */
  | { type: "enrich"; id: string; patch: Partial<Block> }
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; to: number }
  /** `word`: what a project's fallback address starts with ("projekt" on German pages, else "project"). */
  | { type: "duplicate"; id: string; word?: string }
  | { type: "resize"; id: string; size: TileSize }
  | { type: "theme"; theme: CreatorThemeConfig }
  | { type: "select"; id: string | null }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 50;

/**
 * A copy of a project gets an address of its own (made from its title, as for a new project) and no
 * earlier addresses: those keep leading to the original. The page's rules stay kept.
 */
function duplicateProject(source: BlockOf<"project">, id: string, blocks: readonly Block[], word: string): Block {
  const taken = blocks.flatMap((block) => (block.type === "project" ? [block.slug, ...(block.was ?? [])] : []));
  const { was: _was, ...rest } = source;
  return { ...rest, id, slug: slugFor(source.title, taken, word, source.source?.repo) };
}

function apply<D extends EditorDoc>(doc: D, action: EditorAction): D {
  const index = "id" in action ? doc.blocks.findIndex((block) => block.id === action.id) : -1;
  switch (action.type) {
    case "add": {
      const blocks = [...doc.blocks];
      blocks.splice(action.index ?? blocks.length, 0, action.block);
      return { ...doc, blocks };
    }
    case "update":
      return { ...doc, blocks: doc.blocks.map((block) => (block.id === action.id ? { ...block, ...action.patch } : block)) as Block[] };
    case "toggle":
      return { ...doc, blocks: doc.blocks.map((block) => (block.id === action.id ? { ...block, visible: !block.visible } : block)) };
    case "remove":
      return { ...doc, blocks: doc.blocks.filter((block) => block.id !== action.id) };
    case "move": {
      if (index < 0) return doc;
      const blocks = [...doc.blocks];
      const [moved] = blocks.splice(index, 1);
      if (!moved) return doc;
      blocks.splice(Math.max(0, Math.min(action.to, blocks.length)), 0, moved);
      return { ...doc, blocks };
    }
    case "duplicate": {
      const source = doc.blocks[index];
      // A page has one contact block: it has no copy. Nor has a project on a page that is full.
      if (!source || source.type === "contact") return doc;
      if (source.type === "project" && doc.blocks.filter((block) => block.type === "project").length >= MAX_PROJECTS) return doc;
      const id = `${source.id}-copy-${Date.now().toString(36)}`;
      const copy: Block = source.type === "project" ? duplicateProject(source, id, doc.blocks, action.word ?? "project") : { ...source, id };
      const blocks = [...doc.blocks];
      blocks.splice(index + 1, 0, copy);
      const size = doc.sizes[source.id];
      return { ...doc, blocks, sizes: size ? { ...doc.sizes, [copy.id]: size } : doc.sizes };
    }
    case "resize":
      return { ...doc, sizes: { ...doc.sizes, [action.id]: action.size } };
    case "theme":
      return { ...doc, theme: action.theme };
    default:
      return doc;
  }
}

/**
 * Editor reducer with undo/redo history (every content change is undoable — brand §5.1).
 * Generic over the document so the app can keep more than blocks and theme in the same history.
 */
export function editorReducer<D extends EditorDoc>(state: EditorState<D>, action: EditorAction): EditorState<D> {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return { ...state, past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case "enrich": {
      const present = apply(state.present, { type: "update", id: action.id, patch: action.patch });
      return present === state.present ? state : { ...state, present };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return { ...state, past: [...state.past, state.present], present: next, future: state.future.slice(1) };
    }
    default: {
      const present = apply(state.present, action);
      if (present === state.present) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present,
        future: [],
        selectedId: action.type === "remove" && state.selectedId === action.id ? null : action.type === "add" ? action.block.id : state.selectedId,
      };
    }
  }
}

export const initialEditorState = <D extends EditorDoc>(doc: D): EditorState<D> => ({ past: [], present: doc, future: [], selectedId: null });

const asPlatform = (value: Detection["platform"]): Platform =>
  (PLATFORMS as readonly string[]).includes(value ?? "") ? (value as Platform) : "website";

let counter = 0;
const newId = (type: string) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * Optimistic block from a smart-detect result. In production the server fetches metadata
 * (title, image, price, platform links via our resolver) and patches the block a moment later.
 */
/**
 * A readable name until the store's details arrive: Apple's address carries it ("…/app/fokus-timer/id1…"
 * → "Fokus Timer"), Google's the package ("com.example.fokus" → "Fokus").
 */
function appName(detection: Detection): string {
  // Title Case that also works for letters like "ü" (\b only knows ASCII word characters).
  const words = (value: string) => value.replace(/[-_.]+/g, " ").replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase()).trim();
  try {
    const url = new URL(detection.url);
    if (detection.platform === "googleplay") return words(detection.id?.split(".").at(-1) ?? detection.label) || detection.label;
    const slug = url.pathname.split("/").filter(Boolean).at(-2);
    return slug && slug !== "app" ? words(decodeURIComponent(slug)) : detection.label;
  } catch {
    return detection.label;
  }
}

export function blockFromDetection(detection: Detection, labels: { video: string; music: string; event: string }): Block {
  const base = { id: newId(detection.type), visible: true, highlight: false };
  switch (detection.type) {
    case "video":
      return { ...base, type: "video", title: `${labels.video} · ${detection.label}`, provider: detection.platform === "vimeo" ? "vimeo" : detection.platform === "tiktok" ? "tiktok" : detection.platform === "instagram" ? "instagram" : "youtube", url: detection.url, poster: { src: "sample:video-live", alt: "" } };
    case "music":
      return {
        ...base,
        type: "music",
        title: labels.music,
        artist: detection.label,
        kind: "single",
        cover: { src: "sample:cover-lichtfeld", alt: "" },
        links: [{ platform: asPlatform(detection.platform), url: detection.url }],
      };
    case "events":
      return { ...base, type: "events", title: labels.event, items: [{ date: "2027-03-20", city: "Berlin", venue: detection.label, url: detection.url, status: "onsale" }] };
    case "image":
      return { ...base, type: "image", image: { src: detection.url.startsWith("blob:") ? detection.url : "sample:gallery-1", alt: "" } };
    case "product":
      return { ...base, type: "product", title: detection.label, price: 0, currency: "EUR", url: detection.url, image: { src: "sample:merch-vinyl", alt: "" } };
    case "live":
      return { ...base, type: "live", platform: "twitch", channel: detection.id ?? detection.label, url: detection.url, isLive: false };
    case "card":
      return { ...base, type: "card", title: detection.label, url: detection.url, image: { src: "sample:mila-wide", alt: "" } };
    case "shorts":
      return { ...base, type: "link", title: `YouTube · ${detection.id ?? detection.label}`, url: detection.url };
    case "app":
      return { ...base, type: "app", title: appName(detection), icon: { src: NO_IMAGE, alt: "" }, stores: [{ store: detection.platform === "googleplay" ? "googleplay" : "appstore", url: detection.url }] };
    case "repo": {
      const [owner = "", repo = "", ...folders] = (detection.id ?? "").split("/");
      const path = folders.join("/");
      const skill = folders.at(-1);
      return {
        ...base,
        type: "repo",
        title: skill ?? repo,
        url: detection.url,
        owner,
        repo,
        ...(path ? { path } : {}),
        kind: path ? "skill" : "repo",
        install: `npx skills add ${owner}/${repo}${skill ? ` --skill ${skill}` : ""}`,
      };
    }
    default:
      return { ...base, type: "link", title: detection.label, url: detection.url };
  }
}
