"use client";

import dynamic from "next/dynamic";

/**
 * The blocks Laufbahn reads in its own calm way (about, skills, experience, text), loaded with the pages
 * that show them. A client module, so the import below splits off its own chunk: the blocks render on
 * the server as before, but Laufbahn's client code (its index) comes with Laufbahn's pages only and
 * never with the pages of other templates (ADR 0008's page budget).
 */
export const LaufbahnAbout = dynamic(() => import("./laufbahn").then((module) => module.LaufbahnAbout));
export const LaufbahnSkills = dynamic(() => import("./laufbahn").then((module) => module.LaufbahnSkills));
export const LaufbahnText = dynamic(() => import("./laufbahn").then((module) => module.LaufbahnText));
export const LaufbahnTimeline = dynamic(() => import("./laufbahn").then((module) => module.LaufbahnTimeline));
