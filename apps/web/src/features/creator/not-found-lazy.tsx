"use client";

import dynamic from "next/dynamic";

/**
 * The not-found pages of creator pages, loaded when they are shown. A segment's not-found file comes
 * with every route below it, so this client module splits their code (logo, button, the way back) off
 * every creator page: rendered on the server as before (ADR 0008). A server-side `next/dynamic` would
 * still send the code with every page.
 */
export const CreatorNotFoundScreen = dynamic(() => import("./creator-not-found").then((module) => module.CreatorNotFoundScreen));
export const ProjectNotFound = dynamic(() => import("./project-not-found-link").then((module) => module.ProjectNotFound));
