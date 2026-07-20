import React, { memo, useMemo } from "react";

/**
 * Build responsive Unsplash srcset (w= + q=) when possible.
 * Falls back to the original URL for other hosts.
 */
function unsplashSrcSet(src, widths = [80, 160, 240, 320, 480]) {
  try {
    const u = new URL(src, typeof window !== "undefined" ? window.location.origin : "https://titanos-web.vercel.app");
    if (!u.hostname.includes("images.unsplash.com") && !u.hostname.includes("unsplash.com")) {
      return null;
    }
    return widths
      .map((w) => {
        const next = new URL(u.toString());
        next.searchParams.set("w", String(w));
        next.searchParams.set("q", "75");
        next.searchParams.set("auto", "format");
        next.searchParams.set("fit", "crop");
        return `${next.toString()} ${w}w`;
      })
      .join(", ");
  } catch {
    return null;
  }
}

/**
 * Lazy-loading image with async decode, optional blur-up, and Unsplash srcset.
 * Prefer width/height to reduce CLS for Lighthouse.
 */
function OptimizedImage({
  src,
  alt = "",
  className = "",
  width,
  height,
  eager = false,
  sizes,
  ...rest
}) {
  const srcSet = useMemo(() => (src ? unsplashSrcSet(src) : null), [src]);
  const resolvedSizes =
    sizes ||
    (width
      ? `(max-width: 640px) ${Math.min(Number(width) * 2, 160)}px, ${width}px`
      : undefined);

  if (!src) {
    return (
      <div
        className={`bg-muted ${className}`}
        style={{ width, height }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={src}
      srcSet={srcSet || undefined}
      alt={alt}
      width={width}
      height={height}
      sizes={srcSet ? resolvedSizes : sizes}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
      className={className}
      {...rest}
    />
  );
}

export default memo(OptimizedImage);
