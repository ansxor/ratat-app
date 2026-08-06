import { useEffect, useState } from "react";

import {
  acknowledgeFirstLike,
  createLike,
  deleteLike,
  getLikeState,
  hasAcknowledgedFirstLike,
} from "#/lib/likes.ts";
import type { Post } from "#/lib/ratat.ts";
import { useSession } from "#/lib/session.tsx";

export function LikeButton({ post }: { post: Post }) {
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

  if (!session) {
    return (
      <span className="flex items-center gap-xs text-body-sm text-mist">
        <HeartIcon filled={false} />
        {count}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      <button
        type="button"
        onClick={press}
        disabled={pending}
        aria-pressed={Boolean(likeUri)}
        className={`flex w-fit items-center gap-xs rounded-pill border px-md py-xs text-body-sm disabled:opacity-60 ${
          likeUri
            ? "border-fav-ring text-fav-ring"
            : "border-line-2 text-mist hover:border-line-3 hover:text-paper"
        }`}
      >
        <HeartIcon filled={Boolean(likeUri)} />
        {count}
      </button>

      {notice ? (
        <div className="rounded-md border border-line-2 bg-mat p-md text-body-sm text-paper">
          <p>Liking here writes a real like to your Bluesky account, visible on Bluesky.</p>
          <div className="mt-sm flex gap-sm">
            <button
              type="button"
              onClick={confirmNotice}
              className="rounded-sm bg-primary px-md py-xs font-semibold text-primary-foreground"
            >
              Got it — like it
            </button>
            <button
              type="button"
              onClick={() => setNotice(false)}
              className="rounded-sm border border-line-2 px-md py-xs text-mist"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-body-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 20.4 4.2 12.9a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 1 1 6.5 6.5Z" />
    </svg>
  );
}
