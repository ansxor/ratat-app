import { useEffect, useState } from "react";

import { StarIcon } from "#/components/ui/icons.tsx";
import {
  acknowledgeFirstLike,
  createLike,
  deleteLike,
  getLikeState,
  hasAcknowledgedFirstLike,
} from "#/lib/likes.ts";
import type { Post } from "#/lib/ratat.ts";
import { useSession } from "#/lib/session.tsx";
import { cn } from "#/lib/utils.ts";

const DETAIL_CLASS =
  "inline-flex items-center gap-[6px] text-[13px] font-[700] px-[12px] py-[7px] bg-ink-raised border text-paper transition-[background,border-color] duration-[140ms] hover:bg-ink-hi [&_svg]:size-[15px] [&_svg]:text-gold hover:border-gold disabled:cursor-default disabled:opacity-60 disabled:hover:bg-ink-raised disabled:hover:border-line";

/**
 * The old app's favourite control. Ratat writes a real `app.bsky.feed.like`, so
 * the first press asks for consent before the record is created.
 */
export function EngagementButton({ post, variant }: { post: Post; variant: "card" | "detail" }) {
  const { session } = useSession();
  const [count, setCount] = useState(post.likeCount ?? 0);
  const [likeUri, setLikeUri] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agent = session?.agent;

  useEffect(() => {
    setCount(post.likeCount ?? 0);
    setLikeUri(undefined);
    setError(null);
    if (!agent) return;

    const controller = new AbortController();
    (async () => {
      const state = await getLikeState(agent, post.uri, controller.signal).catch(() => undefined);
      if (controller.signal.aborted || !state) return;
      setCount(state.likeCount);
      setLikeUri(state.likeUri);
    })();
    return () => controller.abort();
  }, [agent, post.uri, post.likeCount]);

  const toggle = async () => {
    if (!agent || pending) return;
    setPending(true);
    setError(null);
    try {
      if (likeUri) {
        await deleteLike(agent, likeUri);
        setLikeUri(undefined);
        setCount((value) => Math.max(0, value - 1));
      } else {
        const uri = await createLike(agent, { uri: post.uri, cid: post.cid });
        setLikeUri(uri);
        setCount((value) => value + 1);
      }
    } catch (cause) {
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

  const active = Boolean(likeUri);
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
        <StarIcon />
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
          className={cn(
            "absolute z-30 m-0 bg-ink-raised border border-line px-[10px] py-[6px] text-[12.5px] text-[var(--danger)]",
            variant === "detail" ? "top-[calc(100%+8px)] left-0" : "bottom-[calc(100%+6px)] left-0",
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}
