import { useEffect, useState } from "react";

import { StarIcon } from "#/components/ui/icons.tsx";
import {
  acknowledgeFirstLike,
  createLike,
  deleteLike,
  hasAcknowledgedFirstLike,
} from "#/lib/likes.ts";
import type { Post } from "#/lib/ratat.ts";
import { useSession } from "#/lib/session.tsx";
import { cn } from "#/lib/utils.ts";

const DETAIL_CLASS =
  "inline-flex items-center gap-[6px] text-[13px] font-[700] px-[12px] py-[7px] bg-ink-raised border text-paper transition-[background,border-color] duration-[140ms] hover:bg-ink-hi [&_svg]:size-[15px] [&_svg]:text-gold hover:border-gold disabled:cursor-default disabled:opacity-60 disabled:hover:bg-ink-raised disabled:hover:border-line max-mobile:gap-[8px] max-mobile:text-[16px] max-mobile:px-[16px] max-mobile:py-[8px] max-mobile:[&_svg]:size-[19px]";

/**
 * The old app's favourite control. Ratat writes a real `app.bsky.feed.like`, so
 * the first press asks for consent before the record is created.
 */
export function EngagementButton({ post, variant }: { post: Post; variant: "card" | "detail" }) {
  const { session } = useSession();
  const [count, setCount] = useState(post.likeCount ?? 0);
  const [likeUri, setLikeUri] = useState<string | undefined>(post.viewerLike);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticActive, setOptimisticActive] = useState<boolean | undefined>();
  const [animationKey, setAnimationKey] = useState(0);
  const [starAnimation, setStarAnimation] = useState<"bounce" | "shrink">("bounce");

  const agent = session?.agent;

  useEffect(() => {
    setCount(post.likeCount ?? 0);
    setLikeUri(post.viewerLike);
    setOptimisticActive(undefined);
    setError(null);
  }, [post.uri, post.likeCount, post.viewerLike]);

  const toggle = async () => {
    if (!agent || pending) return;
    setPending(true);
    setError(null);
    const wasActive = Boolean(likeUri);
    const previousCount = count;
    setOptimisticActive(!wasActive);
    setCount((value) => wasActive ? Math.max(0, value - 1) : value + 1);
    setStarAnimation(wasActive ? "shrink" : "bounce");
    setAnimationKey((value) => value + 1);
    try {
      if (likeUri) {
        await deleteLike(agent, likeUri);
        setLikeUri(undefined);
      } else {
        const uri = await createLike(agent, { uri: post.uri, cid: post.cid });
        setLikeUri(uri);
      }
      setOptimisticActive(undefined);
    } catch (cause) {
      setLikeUri(likeUri);
      setOptimisticActive(undefined);
      setCount(previousCount);
      setError(cause instanceof Error ? cause.message : "That didn't work.");
    } finally {
      setPending(false);
    }
  };

  const press = () => {
    if (!likeUri && !hasAcknowledgedFirstLike()) {
      setNotice(true);
      return;
    }
    void toggle();
  };

  const confirmNotice = () => {
    acknowledgeFirstLike();
    setNotice(false);
    void toggle();
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
        onClick={press}
      >
        <StarIcon key={animationKey} className={`star-${starAnimation}`} />
        <span>{count}</span>
      </button>

      {notice && (
        // Cards clip their overflow, so the card notice opens upward over the artwork.
        <div
          className={cn(
            "absolute z-30 bg-ink-raised border border-line shadow-[0_12px_28px_-12px_var(--shadow-drop)] p-[12px]",
            variant === "detail"
              ? "top-[calc(100%+8px)] left-0 w-[266px]"
              : "bottom-[calc(100%+6px)] left-0 w-[230px]",
          )}
        >
          <p className="m-0 text-[13px] leading-[1.5] text-paper">
            Favouriting here writes a real like to your Bluesky account, visible on Bluesky.
          </p>
          <div className="mt-[10px] flex gap-[8px]">
            <button type="button" className="btn btn--accent" onClick={confirmNotice}>
              Got it — favourite it
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setNotice(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="fixed bottom-[20px] right-[20px] z-50 m-0 max-w-[min(360px,calc(100vw-40px))] border border-[var(--danger)] bg-ink-raised px-[12px] py-[9px] text-[13px] text-[var(--danger)] shadow-[0_12px_28px_-12px_var(--shadow-drop)]"
        >
          Favourite failed: {error}
        </p>
      )}
    </div>
  );
}
