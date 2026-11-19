import type { Json } from "./database.types";

/** App data as a JSON column value (a plain copy: drops `undefined`, keeps everything else). */
export const toJson = (value: object): NonNullable<Json> => JSON.parse(JSON.stringify(value)) as NonNullable<Json>;

/** A JSON column read back as the app type it was written from (written by toJson, validated on write). */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the type it stored.
export const fromJson = <T>(value: Json | null): T => value as unknown as T;
