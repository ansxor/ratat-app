import { aspectRatio, isVideo, type Post } from "#/lib/ratat.ts";

export function ArtworkCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const cover = post.media[0];
  if (!cover) return null;

  const extra = post.media.length - 1;
  const label = cover.alt || post.text || `Artwork by @${post.author.handle}`;

  return (
    <article className="mb-md break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="group relative block w-full overflow-hidden rounded-md border border-line bg-ink-raised shadow-sm shadow-shadow"
      >
        <img
          src={isVideo(cover) ? cover.thumbnail : cover.thumb}
          alt={cover.alt ?? ""}
          loading="lazy"
          style={{ aspectRatio: aspectRatio(cover) }}
          className="w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-sm bg-scrim-hover px-md py-sm text-body-sm text-scrim-solid-fg opacity-0 transition-opacity group-hover:opacity-100">
          <span className="truncate">@{post.author.handle}</span>
          <span className="shrink-0">♥ {post.likeCount ?? 0}</span>
        </span>
        {isVideo(cover) ? (
          <span className="pointer-events-none absolute right-sm top-sm rounded-pill bg-scrim-chip px-sm text-eyebrow uppercase text-scrim-solid-fg">
            video
          </span>
        ) : null}
        {extra > 0 ? (
          <span className="pointer-events-none absolute left-sm top-sm rounded-pill bg-scrim-chip px-sm text-eyebrow text-scrim-solid-fg">
            +{extra}
          </span>
        ) : null}
      </button>
    </article>
  );
}
