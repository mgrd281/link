"use client";

import { Button } from "@linkyo/ui";
import { ImageDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProfileSheet } from "./profile-sheet-lazy";
import { ShareToolRow } from "./share-tools";

// The picture is drawn on a canvas by code that comes in its own chunk, loaded the first time the
// sheet opens (`./share-image-sheet.tsx`, ADR 0008).
const ShareImageSheet = dynamic(() => import("./share-image-sheet").then((module) => module.ShareImageSheet), { ssr: false });

/**
 * "Picture for your story": the page's photo, name, line and address as an image to post, in the
 * page's own template (colors, display face, black and white for Mono). Story 9:16 or post 4:5;
 * shared through the phone's share sheet (straight to Instagram) or downloaded.
 */
export function ShareImageButton({ compact = false, appearance = "button" }: { compact?: boolean; appearance?: "button" | "row" }) {
  const t = useTranslations("app.shareImage");
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const show = () => {
    setShown(true);
    setOpen(true);
  };

  return (
    <>
      {appearance === "row" ? (
        <ShareToolRow icon={ImageDown} label={t("open")} onClick={show} />
      ) : (
        <Button icon={ImageDown} size={compact ? "md" : "lg"} onClick={show}>
          {t("open")}
        </Button>
      )}
      {shown ? (
        <ShareImageSheet
          open={open}
          onOpenChange={setOpen}
          onAddPhoto={() => {
            // One sheet at a time: this one closes, and the profile opens on the next frame.
            setOpen(false);
            requestAnimationFrame(() => setProfileOpen(true));
          }}
        />
      ) : null}
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
