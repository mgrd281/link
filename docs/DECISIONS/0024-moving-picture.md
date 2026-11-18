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
  - it does not start on its own for `prefers-reduced-motion` or the browser's data saver;
  - when the browser refuses to start it (iPhone in Low Power Mode), it starts on the visitor's first
    tap anywhere on the page;
  - a small play/pause button sits on the picture (WCAG 2.2.2: moving content can be stopped). It
    also lets visitors with reduced motion start the clip themselves;
  - it is hidden from assistive technology, since the photo carries the description;
  - a moving picture always shows in its own colors: the duotone template falls back to the portrait
    treatment when there is a clip, because a toned face on video reads as a filter.
- **Background.** On every screen the hero softens and fades on scroll as before (the scroll-driven
  CSS animation), so the moving picture turns into a soft background as the visitor reads on. On wide
  screens the ambient backdrop stays the still photo, which saves battery.
- **Privacy.** The clips are self-hosted (`/media/motion`). They make no third-party request and need
  no consent.
- **Examples.** Four example pages have a moving picture:
  - Timo Lacht (comedian);
  - Clara Wendt (writer);
  - Lina (beauty);
  - Mara Vale (singer).

  Each shows a face that looks into the camera, like the founder's reference. The cooking page keeps
  its photo, because no free clip shows a face there.

  The clips are Mixkit stock clips under the Mixkit Stock Video Free License, checked on each clip
  page. Clips under the restricted license were excluded. Each clip comes from its 1080p source, is
  cut with ffmpeg to 4:5 around the face and scaled to 720 × 900, loops seamlessly in 5–7 s (the end
  crossfades into the start), has no audio, and is H.264 with faststart, 0.4–0.8 MB.
  Credits are in `assets/examples/CREDITS.md`.

**Status.** Applied.
