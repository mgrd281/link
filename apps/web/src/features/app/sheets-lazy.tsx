"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { AddDoor } from "./add-sheet";
import { useSite } from "./site-context";

/*
 * The Add and Edit sheets carry every block's form (and with them the picture tools, the link
 * metadata, the block rules and their schemas): they come in their own chunk, loaded when one first
 * opens, so the dashboard's first load does not carry them (ADR 0008). Once loaded they stay mounted,
 * so their opening and closing animations run as before.
 */
const AddSheetBody = dynamic(() => import("./add-sheet").then((module) => module.AddSheet), { ssr: false });
const EditSheetBody = dynamic(() => import("./edit-sheet").then((module) => module.EditSheet), { ssr: false });

/** True from the first time `open` is true on (a sheet that has been opened stays mounted). */
function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}

/** The Add sheet (`./add-sheet.tsx`), loaded the first time it opens. */
export function AddSheet({ entry = "all" }: { entry?: AddDoor }) {
  const { addOpen } = useSite();
  return useOpenedOnce(addOpen) ? <AddSheetBody entry={entry} /> : null;
}

/** The sheet that edits a block (`./edit-sheet.tsx`), loaded the first time a block is edited or created. */
export function EditSheet() {
  const { editing } = useSite();
  return useOpenedOnce(editing !== null) ? <EditSheetBody /> : null;
}
