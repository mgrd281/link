import type { BlockType } from "@linkyo/blocks";

import { ADD_GROUPS, ADD_PRESETS, addGroups, type AddGroupKey, type AddPreset } from "./blocks";

/*
 * The Add sheet's entries as one menu, and the search over them (D-15): the sheet filters its cards,
 * and the ⌘K palette offers the same entries under "Hinzufügen". Pure, so both and the tests agree.
 */

/** One entry of a group in the sheet: a block type, or a preset (a block of a type, already set up). */
export type AddEntry = { type: BlockType; preset?: undefined } | { type?: undefined; preset: AddPreset };

/** The message key of an entry under `app.add.desc` and `app.add.keywords`: its type, or its preset. */
export const entryKey = (entry: AddEntry): BlockType | AddPreset => entry.type ?? entry.preset;

/** A group's entries in order: its presets ("Clients") right after its quotes, else at its end. */
export function addEntries(types: readonly BlockType[], presets: readonly AddPreset[]): AddEntry[] {
  const quotes = types.indexOf("quotes");
  const cut = quotes < 0 ? types.length : quotes + 1;
  return [...types.slice(0, cut).map((type) => ({ type })), ...presets.map((preset) => ({ preset })), ...types.slice(cut).map((type) => ({ type }))];
}

/**
 * Everything the Add sheet offers, in its groups: "For you" (or "Popular") first, then the fixed groups,
 * each type once. Real accounts have no newsletter backend yet, so the newsletter is not offered there.
 */
export function addMenu(kind: string | undefined, demo: boolean): { key: AddGroupKey; entries: AddEntry[] }[] {
  return addGroups(kind)
    .map((group) => (demo ? group : { ...group, types: group.types.filter((type) => type !== "newsletter") }))
    .map((group) => ({ key: group.key, entries: addEntries(group.types, (Object.hasOwn(ADD_PRESETS, group.key) ? ADD_PRESETS[group.key as keyof typeof ADD_PRESETS] : []) as readonly AddPreset[]) }))
    .filter((group) => group.entries.length > 0);
}

/** Every entry key the sheet can show (all types and presets), for the messages' completeness test. */
export const ALL_ENTRY_KEYS: readonly (BlockType | AddPreset)[] = [...Object.values(ADD_GROUPS).flat(), ...Object.values(ADD_PRESETS).flat()];

/**
 * Text as the search compares it: lower case, without accents and Arabic vowel marks, the Arabic
 * letters people write either way folded together (أ إ آ ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي) and no
 * tatweel, so "Über" finds "uber" and "صوره" finds "صورة".
 */
export function searchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The words a query is made of, folded (`searchText`). */
export const queryWords = (query: string): string[] => searchText(query).split(" ").filter(Boolean);

/** True when every word of the query is found in one of the texts (name, description, search words). */
export function matchesQuery(query: string, texts: readonly string[]): boolean {
  const words = queryWords(query);
  if (words.length === 0) return true;
  const haystack = searchText(texts.join(" "));
  return words.every((word) => haystack.includes(word));
}

/** The menu with only the entries a query finds; groups left empty are dropped. */
export function filterMenu<G extends { entries: AddEntry[] }>(menu: readonly G[], query: string, texts: (entry: AddEntry) => readonly string[]): G[] {
  if (queryWords(query).length === 0) return [...menu];
  return menu.map((group) => ({ ...group, entries: group.entries.filter((entry) => matchesQuery(query, texts(entry))) })).filter((group) => group.entries.length > 0);
}
