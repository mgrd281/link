import { getTranslations } from "next-intl/server";

import { newBlockId } from "@/features/app/blocks";
import { projectSlugs, revalidateCreatorPages } from "@/features/creator/revalidate";
import { lookupLinkMetadata } from "@/lib/link-metadata";
import { requireUser } from "@/lib/server/user";
import { SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import { toJson } from "@/lib/supabase/json";

import { applyOps, bodySchema, MAX_BODY, MAX_OPS } from "./ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const answer = (body: object, status = 200) => Response.json(body, { status, headers: noStore });

const LOCALES = ["de", "en", "ar"] as const;
type Locale = (typeof LOCALES)[number];
const localeOf = (...candidates: unknown[]): Locale => candidates.find((value): value is Locale => (LOCALES as readonly unknown[]).includes(value)) ?? "de";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The body as text, or null when it is larger than `max` bytes (read no further than that). */
async function readBody(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? "0") > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** The database refused the page for its size (`sites.site_size`). */
const tooLarge = (error: { code?: string; message?: string }) => error.code === "23514" && (error.message ?? "").includes("site_size");

/**
 * The iPhone app's page changes (ADR draft-app-sync): its Home, Add sheet, block list and share
 * extension change the page through here, never by writing block JSON themselves.
 *
 *   POST { baseUpdatedAt, ops: [{ op: "add", url } | { op: "addImage", src, alt, w, h }
 *        | { op: "move", id, to } | { op: "show", id, visible } | { op: "remove", id }] }
 *   200  { ok: true, updatedAt, changed: [ids], added: [ids] }
 *
 * - Bearer only (`requireUser`); the read and the write run as the account, under row-level security.
 * - The write happens only while the row still has `baseUpdatedAt` (the version the app saw, from its
 *   own read or `window.linkyoApp.flush()`): otherwise 409 with the current `updatedAt`, nothing written.
 * - 422 for more than 20 operations, a body the schema refuses, a link that is no address, a picture
 *   that is not the account's own upload, an unknown or doubled block id, a position past the end, or
 *   a page the blocks schema would refuse; 413 above 64 KB; 403 for a suspended account; 409 without
 *   real accounts (a demo build).
 * - A successful write drops the cached public page, so visitors see it at once.
 */
export async function POST(request: Request) {
  if (!supabaseEnabled) return answer({ ok: false, error: "unavailable" }, 409);
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;

  const raw = await readBody(request, MAX_BODY);
  if (raw === null) return answer({ ok: false, error: "tooLarge", max: MAX_BODY }, 413);
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return answer({ ok: false, error: "invalidJson" }, 400);
  }
  if (isRecord(input) && Array.isArray(input.ops) && input.ops.length > MAX_OPS) return answer({ ok: false, error: "tooManyOps", max: MAX_OPS }, 422);
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return answer({ ok: false, error: "invalidBody", path: parsed.error.issues[0]?.path.join(".") ?? "" }, 422);

  const { user, db } = signedIn;
  const { data: profile } = await db.from("profiles").select("status, username, locale").eq("id", user.id).maybeSingle();
  if (!profile) return answer({ ok: false, error: "notFound" }, 404);
  if (profile.status !== "active") return answer({ ok: false, error: "suspended" }, 403);

  const currentVersion = async () => (await db.from("sites").select("updated_at").eq("profile_id", user.id).maybeSingle()).data?.updated_at ?? null;
  const conflict = async () => answer({ ok: false, error: "conflict", updatedAt: await currentVersion() }, 409);

  // Read only the version the app built on: a newer one is a conflict before any link is looked up.
  const { data: row, error: readError } = await db
    .from("sites")
    .select("page, updated_at")
    .eq("profile_id", user.id)
    .eq("updated_at", parsed.data.baseUpdatedAt)
    .maybeSingle();
  if (readError) return answer({ ok: false, error: "serverError" }, 502);
  if (!row) return (await currentVersion()) === null ? answer({ ok: false, error: "notFound" }, 404) : conflict();

  const stored = isRecord(row.page) && isRecord(row.page.profile) ? row.page.profile : {};
  const t = await getTranslations({ locale: localeOf(stored.locale, profile.locale), namespace: "dashboard.types" });
  const displayName = typeof stored.displayName === "string" ? stored.displayName : "";
  const result = await applyOps(row.page, parsed.data.ops, {
    ownerId: user.id,
    storageUrl: SUPABASE_URL,
    labels: { video: t("video"), music: t("music"), event: t("events") },
    artist: displayName || profile.username,
    lookup: (url) => lookupLinkMetadata(url).catch(() => null),
    newId: newBlockId,
  });
  if (!result.ok) {
    const { ok: _refused, ...problem } = result;
    return answer({ ok: false, ...problem }, 422);
  }

  // The same guard on the write: a change that landed after the read is never overwritten.
  const { data: saved, error: writeError } = await db
    .from("sites")
    .update({ page: toJson(result.page) })
    .eq("profile_id", user.id)
    .eq("updated_at", row.updated_at)
    .select("updated_at")
    .maybeSingle();
  if (writeError) return tooLarge(writeError) ? answer({ ok: false, error: "pageTooLarge" }, 422) : answer({ ok: false, error: "serverError" }, 502);
  if (!saved) return conflict();

  revalidateCreatorPages([profile.username], [...projectSlugs(row.page), ...projectSlugs(result.page)]);
  return answer({ ok: true, updatedAt: saved.updated_at, changed: result.changed, added: result.added });
}
