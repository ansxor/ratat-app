import { Link } from "@tanstack/react-router";

import { FollowButton } from "#/components/FollowButton.tsx";
import { Pager } from "#/components/Pager.tsx";
import { PLACEHOLDER_GRADIENT } from "#/lib/avatar.ts";
import { imageBackground } from "#/lib/image.tsx";
import type { PagerPagination } from "#/lib/pagination.ts";
import type { FollowActor } from "#/lib/ratat.ts";

/**
 * Ported from the old app's `src/components/profile/ActorRow.tsx`: same markup
 * and classes. The BskyOnlyBadge is gone — nothing on Ratat is mirrored from
 * Bluesky anymore — and the follow button writes a Ratat follow, not a Bluesky
 * one, so it takes the account's DID rather than its handle.
 */
export function FollowRow({ account }: { account: FollowActor }) {
  const name = account.displayName?.trim() || account.handle || account.subject;
  return (
    <div className="flex items-center gap-[10px] px-[14px] py-[9px] border-b border-line-soft last:border-b-0">
      <Link
        to="/profile/$handle"
        params={{ handle: account.handle ?? account.subject }}
        className="size-[32px] flex-none bg-cover bg-center border border-line shadow-[inset_0_0_0_2px_var(--color-ink-raised)]"
        style={imageBackground(account.avatar, PLACEHOLDER_GRADIENT)}
      />
      <div className="min-w-0 flex-1">
        <Link
          to="/profile/$handle"
          params={{ handle: account.handle ?? account.subject }}
          className="block text-[13.5px] font-[700] leading-[1.25] truncate"
        >
          {name}
        </Link>
        <span className="flex items-center gap-[4px] text-[11px] tracking-[0.02em] text-faint">
          <span className="truncate">@{account.handle ?? account.subject}</span>
        </span>
      </div>
      <FollowButton subject={account.subject} variant="compact" />
    </div>
  );
}

/**
 * Ported from the old app's `src/components/profile/FollowList.tsx`: the
 * bordered account list with the standalone pager underneath.
 */
export function FollowList({
  actors,
  loading = false,
  pagination,
}: {
  actors: FollowActor[];
  loading?: boolean;
  pagination?: PagerPagination;
}) {
  if (loading && actors.length === 0) {
    return <p className="text-mist py-[24px]">Loading…</p>;
  }
  if (actors.length === 0) {
    return <p className="text-mist py-[24px]">No accounts to show.</p>;
  }
  return (
    <>
      <div className="border border-line bg-ink-raised">
        {actors.map((account) => (
          <FollowRow key={account.uri} account={account} />
        ))}
      </div>
      {pagination && (
        <Pager variant="standalone" pagination={pagination} countNoun={["account", "accounts"]} />
      )}
    </>
  );
}
