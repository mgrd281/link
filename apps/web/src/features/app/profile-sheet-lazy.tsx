"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// The profile form (pictures, moving picture, focal point and its rules) comes in its own chunk,
// loaded the first time the sheet opens (ADR 0008).
const ProfileSheetBody = dynamic(() => import("./profile-form").then((module) => module.ProfileSheet), { ssr: false });

/** The profile sheet (`./profile-form.tsx`), loaded the first time it opens and mounted from then on. */
export function ProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open ? <ProfileSheetBody open={open} onOpenChange={onOpenChange} /> : null;
}
