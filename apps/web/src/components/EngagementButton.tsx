import { useEffect, useState } from "react";
import { toast } from "sonner";

import { StarIcon } from "#/components/ui/icons.tsx";
import { createLike, deleteLike } from "#/lib/likes.ts";
import type { Post } from "#/lib/ratat.ts";
import { useSession } from "#/lib/session.tsx";
import { cn } from "#/lib/utils.ts";

// Detail reads omit viewer state, so retain what viewer-aware feeds already told us.
const viewerLikes = new Map<string, string | null>();

const DETAIL_CLASS =
  "inline-flex items-center gap-[6px] text-[13px] font-[700] px-[12px] py-[7px] bg-ink-raised border text-paper transition-[background,border-color] duration-[140ms] hover:bg-ink-hi [&_svg]:size-[15px] [&_svg]:text-gold hover:border-gold disabled:cursor-default disabled:opacity-60 disabled:hover:bg-ink-raised disabled:hover:border-line max-mobile:gap-[8px] max-mobile:text-[16px] max-mobile:px-[16px] max-mobile:py-[8px] max-mobile:[&_svg]:size-[19px]";

/**
 * The old app's favourite control. Ratat writes a real `app.bsky.feed.like`.
 */
export function EngagementButton({ post, variant }: { post: Post; variant: "card" | "detail" }) {
  const { session } = useSession();
  const [count, setCount] = useState(post.likeCount ?? 0);
  const likeKey = session ? `${session.did}:${post.uri}` : undefined;
  const cachedLike = likeKey ? viewerLikes.get(likeKey) : undefined;
  const [likeUri, setLikeUri] = useState<string | undefined>(
    cachedLike === null ? undefined : (cachedLike ?? post.viewerLike),
  );
  const [pending, setPending] = useState(false);
  const [optimisticActive, setOptimisticActive] = useState<boolean | undefined>();
  const [animationKey, setAnimationKey] = useState(0);
  const [starAnimation, setStarAnimation] = useState<"bounce" | "shrink">();

  const agent = session?.agent;

  useEffect(() => {
    setCount(post.likeCount ?? 0);
    const cached = likeKey ? viewerLikes.get(likeKey) : undefined;
    const next = post.viewerLike ?? (cached === null ? undefined : cached);
    setLikeUri(next);
    if (likeKey && (post.viewerLike || cached === undefined)) {
      viewerLikes.set(likeKey, post.viewerLike ?? null);
    }
    setOptimisticActive(undefined);
    setStarAnimation(undefined);
  }, [likeKey, post.likeCount, post.viewerLike]);

  const toggle = async () => {
    if (!agent || pending) return;
    setPending(true);
    const wasActive = Boolean(likeUri);
    const previousCount = count;
    setOptimisticActive(!wasActive);
    setCount((value) => (wasActive ? Math.max(0, value - 1) : value + 1));
    setStarAnimation(wasActive ? "shrink" : "bounce");
    setAnimationKey((value) => value + 1);
    try {
      if (likeUri) {
        await deleteLike(agent, likeUri);
        setLikeUri(undefined);
        if (likeKey) viewerLikes.set(likeKey, null);
      } else {
        const uri = await createLike(agent, { uri: post.uri, cid: post.cid });
        setLikeUri(uri);
        if (likeKey) viewerLikes.set(likeKey, uri);
      }
      setOptimisticActive(undefined);
    } catch (cause) {
      setLikeUri(likeUri);
      setOptimisticActive(undefined);
      setCount(previousCount);
      toast.error(
        `Favourite failed: ${cause instanceof Error ? cause.message : "That didn't work."}`,
      );
    } finally {
      setPending(false);
    }
  };

  const active = optimisticActive ?? Boolean(likeUri);
  const title = !session ? "Sign in to favourite" : active ? "Remove favourite" : "Favourite";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className={
          variant === "detail"
            ? cn(DETAIL_CLASS, active ? "border-gold bg-ink-hi [&_svg]:fill-gold" : "border-line")
            : cn("act act--star", active && "act--active")
        }
        title={title}
        disabled={pending || !session}
        onClick={() => void toggle()}
      >
        <StarIcon
          key={animationKey}
          className={starAnimation ? `star-${starAnimation}` : undefined}
        />
        <span>{count}</span>
      </button>
    </div>
  );
}
