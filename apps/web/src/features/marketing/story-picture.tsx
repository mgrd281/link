"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { drawShareArt, loadFaces, SHARE_SIZES, type ShareArt } from "@/features/share/story-card";

/**
 * Everything the picture shows that the server can work out: the words, the colors and the photo's
 * focal point. The theme engine runs on the server, so it stays out of the homepage's first download
 * (the playground loads it only on demand, too).
 */
export type StoryArt = Omit<ShareArt, "photo" | "display" | "displayWeight" | "body">;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

/**
 * The real story picture of an example page, drawn by the same code that draws a creator's own
 * picture in the dashboard ("Image for story & post"), so the homepage shows exactly what people
 * post. It is drawn once, the first time it comes near the screen: the faces and the photo load
 * only for visitors who scroll this far (the font probes, too, are there only from then on: text in a
 * face makes the browser fetch it, even unseen). Until then the canvas keeps its 9:16 box (nothing
 * moves). The tile's text says what it is, so the picture itself is hidden from screen readers.
 */
export function StoryPicture({ art, photo, faces }: { art: StoryArt; photo: string; faces: CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fontsRef = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const { width, height } = SHARE_SIZES.story;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setNear(true);
      },
      // Start a little before it scrolls in, so the picture is there when it is seen.
      { rootMargin: "50% 0%" },
    );
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const displayProbe = fontsRef.current?.querySelector<HTMLElement>("[data-face=display]");
    const bodyProbe = fontsRef.current?.querySelector<HTMLElement>("[data-face=body]");
    if (!near || !canvas || !displayProbe || !bodyProbe) return;
    let cancelled = false;
    const draw = async () => {
      // The canvas can't resolve CSS variables: read the page's real font stacks from the probes.
      const display = getComputedStyle(displayProbe).fontFamily;
      const displayWeight = getComputedStyle(displayProbe).fontWeight;
      const body = getComputedStyle(bodyProbe).fontFamily;
      const [image] = await Promise.all([loadImage(photo), loadFaces(display, displayWeight, body)]);
      // The probes have just appeared: every face they asked for is there before the picture is drawn.
      await document.fonts.ready;
      if (cancelled) return;
      drawShareArt(canvas, "story", { ...art, photo: image, display, displayWeight, body });
      // Lets tests (and people inspecting the page) tell a drawn picture from the empty box.
      canvas.dataset.drawn = "";
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [near, art, photo]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} aria-hidden width={width} height={height} className="h-auto w-full rounded-lg border border-line bg-canvas-muted" />
      {/* Reads the page's real font stacks (the canvas can't resolve CSS variables itself). */}
      {near ? (
        <span ref={fontsRef} aria-hidden style={faces} className="pointer-events-none absolute size-0 overflow-hidden opacity-0">
          <span data-face="display" className="font-creator-display" style={{ fontWeight: "var(--creator-display-weight)" }}>
            Aa
          </span>
          <span data-face="body" className="font-creator-body">
            Aa
          </span>
        </span>
      ) : null}
    </div>
  );
}
