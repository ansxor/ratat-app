import { useEffect } from "react";

import { LikeButton } from "./LikeButton.tsx";
import { aspectRatio, isVideo, type Media, type Post } from "#/lib/ratat.ts";

export function Lightbox({
  post,
  onClose,
  onPrev,
  onNext,
}: {
  post: Post;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onPrev?.();
      else if (event.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const scroll = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = scroll;
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={post.text || `Artwork by @${post.author.handle}`}
      className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-backdrop p-xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg border border-line bg-ink-raised shadow-lg shadow-shadow-drop"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-md border-b border-line px-xl py-md">
          <img
            src={post.author.avatar}
            alt=""
            width={28}
            height={28}
            className="size-[28px] rounded-pill bg-mat object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-body-sm text-paper">
              {post.author.displayName ?? post.author.handle}
            </p>
            <p className="truncate text-body-sm text-faint">@{post.author.handle}</p>
          </div>
          <div className="ml-auto flex items-center gap-sm">
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              aria-label="Previous artwork"
              className="rounded-pill border border-line-2 px-md py-xs text-body-sm text-mist disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              aria-label="Next artwork"
              className="rounded-pill border border-line-2 px-md py-xs text-body-sm text-mist disabled:opacity-40"
            >
              →
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-pill border border-line-2 px-md py-xs text-body-sm text-mist"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-md p-xl">
          {post.media.map((media, index) => (
            <MediaFrame key={index} media={media} />
          ))}

          {post.text ? (
            <p className="whitespace-pre-wrap text-body text-paper">{post.text}</p>
          ) : null}

          {post.media.some((media) => media.alt) ? (
            <div className="rounded-md border border-line-soft bg-mat p-md">
              <p className="text-eyebrow uppercase text-faint">Alt text</p>
              {post.media.map((media, index) =>
                media.alt ? (
                  <p key={index} className="mt-xs text-body-sm text-mist">
                    {media.alt}
                  </p>
                ) : null,
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-md">
            <LikeButton post={post} />
            <a
              href={post.bskyUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-pill border border-bsky-line bg-bsky-tint px-md py-xs text-body-sm text-bsky hover:bg-bsky-tint-hi"
            >
              View on Bluesky
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaFrame({ media }: { media: Media }) {
  if (isVideo(media)) {
    return (
      <video
        controls
        playsInline
        poster={media.thumbnail}
        src={media.playlist}
        style={{ aspectRatio: aspectRatio(media) }}
        className="w-full rounded-md bg-mat"
      >
        <track kind="captions" />
      </video>
    );
  }

  return (
    <img
      src={media.fullsize}
      alt={media.alt ?? ""}
      style={{ aspectRatio: aspectRatio(media) }}
      className="w-full rounded-md bg-mat object-contain"
    />
  );
}
