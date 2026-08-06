import { Link } from "@tanstack/react-router";

import { EngagementButton } from "#/components/EngagementButton.tsx";
import { BoostIcon, ChatIcon } from "#/components/ui/icons.tsx";
import { artworkParams } from "#/lib/artwork-href.ts";
import { aspectRatio, isVideo, type Post } from "#/lib/ratat.ts";
import { cn } from "#/lib/utils.ts";

export type ArtworkCardHeader = "hover" | "pinned" | "none";

export function ArtworkCard({
  post,
  aspect,
  header = "hover",
}: {
  post: Post;
  aspect?: string;
  header?: ArtworkCardHeader;
}) {
  const cover = post.media[0];
  if (!cover) return null;

  const params = artworkParams(post);
  const title = post.text || `Artwork by @${post.author.handle}`;
  const imgAspect = aspect ?? aspectRatio(cover);

  return (
    <article className={cn("piece", header === "pinned" && "piece--pinned")}>
      <div className="piece__art">
        {header !== "none" && (
          <div className="piece__top">
            {post.author.avatar ? (
              <img
                className="piece__av"
                src={post.author.avatar}
                alt={post.author.displayName ?? post.author.handle}
                width={18}
                height={18}
              />
            ) : (
              <span className="piece__av" />
            )}
            <Link
              className="piece__artist"
              to="/profile/$handle"
              params={{ handle: post.author.handle }}
            >
              @{post.author.handle}
            </Link>
          </div>
        )}

        <div className="relative" style={{ aspectRatio: imgAspect }}>
          <Link
            className="piece__open absolute inset-0"
            to="/art/$handle/$rkey"
            params={params}
            aria-label={title}
          >
            <img
              className="canvas h-full w-full object-cover"
              src={isVideo(cover) ? cover.thumbnail : cover.thumb}
              alt={cover.alt ?? ""}
              loading="lazy"
            />
          </Link>
        </div>

        <div className="piece__bar">
          <EngagementButton post={post} variant="card" />
          <span className="act act--boost">
            <BoostIcon />
            <span>{post.repostCount ?? 0}</span>
          </span>
          <span className="act act--cm">
            <ChatIcon />
            <span>{post.replyCount ?? 0}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
