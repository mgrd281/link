import { getImageProps } from "next/dist/shared/lib/image-external-get-image-props";
import type { ImageProps } from "next/dist/shared/lib/get-img-props";
import { preload as preloadResource } from "react-dom";

/**
 * next/image's `<img>` without its client component, for creator pages (ADR 0008): the attributes are
 * next/image's own (`getImageProps`, its public API, imported from its own module so that the client
 * component, which `next/image` itself imports, never enters the page), written in the order next/image
 * writes them, with its `data-nimg` mark, and a picture marked `preload` is preloaded the way next/image
 * does it (`ReactDOM.preload`, also from a server component).
 *
 * What the client component did after loading is done by one island per page instead (`Unblur`: it
 * takes a blur placeholder away once its picture has loaded, and shows a failed picture's alt text).
 */
export function PlainImage({ alt, ...image }: ImageProps & { alt: string }) {
  const { props } = getImageProps({ alt, ...image });
  const { loading, fetchPriority, width, height, decoding, className, style, sizes, srcSet, src, alt: _alt, ...rest } = props;
  if (image.preload === true) {
    preloadResource(src, {
      as: "image",
      ...(srcSet ? { imageSrcSet: srcSet } : {}),
      ...(sizes ? { imageSizes: sizes } : {}),
      ...(rest.crossOrigin ? { crossOrigin: rest.crossOrigin } : {}),
      ...(rest.referrerPolicy ? { referrerPolicy: rest.referrerPolicy } : {}),
      ...(fetchPriority ? { fetchPriority } : {}),
    });
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image's own attributes, drawn without its client code (above)
    <img
      alt={alt}
      {...rest}
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
