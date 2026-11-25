"use client";

import { getImageProps } from "next/dist/shared/lib/image-external-get-image-props";
import type { ImageProps } from "next/dist/shared/lib/get-img-props";
import type { Ref } from "react";
import { preload as preloadResource } from "react-dom";

import { trimSrcSet, type PictureSource } from "./picture-source";

type PictureProps = Omit<ImageProps, "src" | "placeholder" | "blurDataURL" | "ref"> & {
  src: PictureSource | string;
  alt: string;
  ref?: Ref<HTMLImageElement> | undefined;
};

/**
 * next/image's `<img>` for the home page, without a blurred preview: the attributes are next/image's
 * own (`getImageProps`, imported from its own module so its client component stays out), in the order
 * next/image writes them, with its `data-nimg` mark; the `srcset` lists only widths that can differ
 * (`trimSrcSet`); a picture marked `preload` is preloaded the way next/image does it (`ReactDOM.preload`).
 *
 * A client module: a server component passes only the picture's address, size and layout (the props
 * below), and the `srcset` is written in the browser and on the server from them, so its long list of
 * addresses never travels in the page's data a second time (E-03, ADR 0008). A client component that
 * needs to know when the picture is there passes `onLoad` and a `ref` (a picture can load before the
 * page's code runs, without a load event to hear).
 */
export function Picture({ alt, ref, onLoad, ...image }: PictureProps) {
  // getImageProps leaves `onLoad` out (next/image's client component calls it itself): it goes onto the `<img>` here.
  const { props } = getImageProps({ alt, ...image });
  const { loading, fetchPriority, width, height, decoding, className, style, sizes, srcSet: allWidths, src: widest, alt: _alt, ...rest } = props;
  const intrinsic = typeof image.src === "string" ? (image.fill ? undefined : Number(image.width) || undefined) : image.src.width;
  const trimmed = allWidths ? trimSrcSet(allWidths, intrinsic) : null;
  const srcSet = trimmed?.srcSet ?? allWidths;
  const src = trimmed?.src ?? widest;
  if (image.preload === true) {
    preloadResource(src, {
      as: "image",
      ...(srcSet ? { imageSrcSet: srcSet } : {}),
      ...(sizes ? { imageSizes: sizes } : {}),
      ...(fetchPriority ? { fetchPriority } : {}),
    });
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image's own attributes, drawn without its client code (above)
    <img
      ref={ref}
      alt={alt}
      {...rest}
      onLoad={onLoad}
      fetchPriority={fetchPriority}
      loading={loading}
      width={width}
      height={height}
      decoding={decoding}
      data-nimg={image.fill ? "fill" : "1"}
      className={className}
      style={style}
      sizes={sizes}
      srcSet={srcSet}
      src={src}
    />
  );
}
