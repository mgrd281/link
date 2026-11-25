"use client";

import dynamic from "next/dynamic";

/**
 * Linkyo's not-found page under a language, loaded when it is shown: a segment's not-found file comes
 * with every route below it, so a client module splits the page's code off (rendered on the server as
 * before; ADR 0008). A server-side `next/dynamic` would still send the code with every page.
 */
export const NotFoundScreen = dynamic(() => import("./error-screen").then((module) => module.NotFoundScreen));
