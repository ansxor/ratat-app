import { ArtworkCard, type ArtworkCardHeader } from "#/components/ArtworkCard.tsx";
import type { Post } from "#/lib/ratat.ts";
import { Fragment, type RefObject } from "react";

export function ArtworkGrid({
  posts,
  header,
  anchorIndex,
  anchorRef,
}: {
  posts: Post[];
  header?: ArtworkCardHeader;
  anchorIndex?: number;
  anchorRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="masonry">
      {posts.map((post, index) => (
        <Fragment key={post.uri}>
          {anchorIndex === index && anchorRef ? (
            <div ref={anchorRef} className="h-0" aria-hidden="true" />
          ) : null}
          <ArtworkCard post={post} header={header} />
        </Fragment>
      ))}
    </div>
  );
}
