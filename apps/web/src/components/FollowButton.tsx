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
export function FollowButton({ subject }: { subject: string }) {
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
