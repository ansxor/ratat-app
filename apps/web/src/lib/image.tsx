import type { CSSProperties, ImgHTMLAttributes } from "react";

/**
 * Keeps screenshots and demos free of external artwork when explicitly enabled
 * at build time. Vite exposes only `VITE_`-prefixed variables to the browser.
 */
export const BLACKOUT_IMAGES = false;

/** Returns CSS background styles without ever requesting the source in blackout mode. */
export function imageBackground(source: string | undefined, fallback: string): CSSProperties {
  if (BLACKOUT_IMAGES) return { backgroundColor: "black", backgroundImage: "none" };
  return { backgroundImage: source ? `url(${source})` : fallback };
}

/**
 * An image element that becomes a same-sized black placeholder in blackout mode.
 * A span is used instead of a black image data URI so no media request is made.
 */
export function Image({
  src: _src,
  alt = "",
  className,
  style,
  width,
  height,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  if (!BLACKOUT_IMAGES) {
    return (
      <img
        src={_src}
        alt={alt}
        className={className}
        style={style}
        width={width}
        height={height}
        {...props}
      />
    );
  }

  const size: CSSProperties = {
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
  };
  return (
    <span
      // theme-invariant: blackout mode deliberately makes every image solid black.
      className={`inline-block bg-black ${className ?? ""}`}
      style={{ ...size, ...style }}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    />
  );
}
