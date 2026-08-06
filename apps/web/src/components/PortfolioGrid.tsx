import { ArtworkCard } from "./ArtworkCard.tsx";
import type { Post } from "#/lib/ratat.ts";

export function PortfolioGrid({
  posts,
  onOpen,
}: {
  posts: Post[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="columns-2 gap-md md:columns-3 xl:columns-4">
      {posts.map((post, index) => (
        <ArtworkCard key={post.uri} post={post} onOpen={() => onOpen(index)} />
      ))}
    </div>
  );
}
