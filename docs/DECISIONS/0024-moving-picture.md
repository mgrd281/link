# 0024 — Moving picture: a short silent loop in place of the hero photo

**Context.** The founder sent a screen recording of a creator page whose hero portrait moves (a
person smiling into the camera, looping, no sound). The portrait melts into the page and softens on
scroll. He asked for the same feature: "a moving picture with a background".

**Decision.**

- **Data.** Profiles take an optional `motion: { src }`: a short clip (3–10 s, MP4, no sound).
  - The hero photo stays as the clip's poster and as the still version, so pages are never empty while
    the clip loads.
  - The editor has a "Moving picture" link field. Uploads come with the storage of Phase 1.
- **Player** (`HeroMotion`, a small client component):
  - a `<video>` that is muted, loops and plays inline, laid over the photo;
  - it fades in on its first frame and plays only while on screen (IntersectionObserver);
  - it never plays for `prefers-reduced-motion` or the browser's data saver;
  - it is hidden from assistive technology, since the photo carries the description;
  - the duotone treatment applies to the clip too.
- **Background.** On wide screens the same clip, blurred, is the ambient backdrop behind the
  column. On every screen the hero softens and fades on scroll as before (the scroll-driven CSS
  animation), so the moving picture turns into a soft background as the visitor reads on.
- **Privacy.** The clips are self-hosted (`/media/motion`). They make no third-party request and need
  no consent.
- **Examples.** Five example pages have a moving picture:
  - Timo Lacht (comedian);
  - Clara Wendt (writer);
  - Lina (beauty);
  - Mara Vale (singer);
  - مطبخ ريم (cooking).

  The clips are Mixkit stock clips under the Mixkit Stock Video Free License, checked on each clip
  page. Clips under the restricted license were excluded. Each clip is cut with ffmpeg to 4:5, a
  seamless 5–7 s loop (the end crossfades into the start), no audio, H.264 with faststart, 150–510 KB.
  Credits are in `assets/examples/CREDITS.md`.

**Status.** Applied.
