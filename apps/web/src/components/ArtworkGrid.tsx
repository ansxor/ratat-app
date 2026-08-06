import { ArtworkCard, type ArtworkCardHeader } from "#/components/ArtworkCard.tsx";
import type { Post } from "#/lib/ratat.ts";

export function ArtworkGrid({ posts, header }: { posts: Post[]; header?: ArtworkCardHeader }) {
  return (
    <div className="masonry">
      {posts.map((post) => (
        <ArtworkCard key={post.uri} post={post} header={header} />
      ))}
    </div>
  );
}
