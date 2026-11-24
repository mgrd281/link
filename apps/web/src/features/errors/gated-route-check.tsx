"use client";

import { notFound, useSelectedLayoutSegments } from "next/navigation";

import { gatedRouteMissing, type GatedArea } from "./gated-routes";

/**
 * Rendered by the /app and /admin layouts next to their gate (never inside it): an address that can
 * never exist answers "not found" while the server renders, so the visitor gets a real 404 and the
 * site's own not-found page, signed in or not. Renders nothing otherwise (gated-routes.ts says why).
 */
export function GatedRouteCheck({ area }: { area: GatedArea }) {
  const segments = useSelectedLayoutSegments();
  if (gatedRouteMissing(area, segments)) notFound();
  return null;
}
