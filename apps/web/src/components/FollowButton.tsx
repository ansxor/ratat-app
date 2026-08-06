import { useState } from "react";

import { CheckIcon, PlusIcon } from "#/components/ui/icons.tsx";
import { useFollows } from "#/lib/follows.tsx";
import { useSession } from "#/lib/session.tsx";
import { cn } from "#/lib/utils.ts";

/**
 * Ported from the old app's `src/components/FollowButton.tsx`: same markup and
 * classes, with `cva` folded into `cn`. What it writes is different — an
 * `art.ratat.graph.follow` in the viewer's repo rather than a Bluesky follow —
 * so following an artist here changes nothing on Bluesky.
 */
const COMPACT =
  "inline-flex items-center justify-center gap-[5px] h-[27px] box-border px-[9px] text-[12px] font-[700] bg-ink-raised border border-line-2 text-paper cursor-pointer whitespace-nowrap align-middle transition-[background,border-color] duration-[180ms] hover:not-disabled:bg-ink-hi hover:not-disabled:border-up [&_svg]:size-[13px] disabled:opacity-[0.55] disabled:cursor-not-allowed";

export function FollowButton({
  subject,
  variant = "default",
}: {
  subject: string;
  variant?: "default" | "compact";
}) {
  const { session } = useSession();
  const { isFollowing, loaded, follow, unfollow } = useFollows();
  const [pending, setPending] = useState(false);

  if (!session || !loaded) return null;
  if (session.did === subject) return null;

  const following = isFollowing(subject);

  const run = (action: () => Promise<void>) => () => {
    if (pending) return;
    setPending(true);
    void action().finally(() => setPending(false));
  };

  if (variant === "compact") {
    return following ? (
      <button
        type="button"
        className={cn(COMPACT, "px-[8px] text-up")}
        title="Following — click to unfollow"
        aria-label="Following"
        onClick={run(() => unfollow(subject))}
        disabled={pending}
      >
        <CheckIcon />
      </button>
    ) : (
      <button
        type="button"
        className={COMPACT}
        onClick={run(() => follow(subject))}
        disabled={pending}
      >
        <PlusIcon />
        <span>Follow</span>
      </button>
    );
  }

  return following ? (
    <button
      type="button"
      className={cn("btn btn--ghost", "[&_svg]:size-[14px] text-mist")}
      title="Unfollow"
      onClick={run(() => unfollow(subject))}
      disabled={pending}
    >
      <CheckIcon />
      <span>Following</span>
    </button>
  ) : (
    <button
      type="button"
      className={cn("btn btn--accent", "[&_svg]:size-[14px]")}
      onClick={run(() => follow(subject))}
      disabled={pending}
    >
      <PlusIcon />
      <span>Follow</span>
    </button>
  );
}
