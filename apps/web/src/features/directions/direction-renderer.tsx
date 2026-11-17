import type { Page } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";

import { GalleryRenderer } from "./gallery/renderer";
import { MosaicRenderer, type TileSize } from "./mosaic/renderer";
import { PosterRenderer } from "./poster/renderer";
import type { DirectionId } from "./registry";
import { StageRenderer } from "./stage/renderer";

/** The real renderer — used by the public page and the dashboard's live preview alike. */
export function DirectionRenderer({
  direction,
  page,
  theme,
  sizes,
  preview = false,
}: {
  direction: DirectionId;
  page: Page;
  theme: ResolvedCreatorTheme;
  sizes?: Record<string, TileSize> | undefined;
  preview?: boolean;
}) {
  switch (direction) {
    case "poster":
      return <PosterRenderer page={page} theme={theme} preview={preview} />;
    case "gallery":
      return <GalleryRenderer page={page} theme={theme} preview={preview} />;
    case "stage":
      return <StageRenderer page={page} theme={theme} preview={preview} />;
    case "mosaic":
      return <MosaicRenderer page={page} theme={theme} sizes={sizes} preview={preview} />;
  }
}
