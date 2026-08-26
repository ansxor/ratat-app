import { Link } from "@tanstack/react-router";

import { FollowButton } from "#/components/FollowButton.tsx";
import { Pager } from "#/components/Pager.tsx";
import { PLACEHOLDER_GRADIENT } from "#/lib/avatar.ts";
import { imageBackground } from "#/lib/image.tsx";
import {
  MobileInfinitePagination,
  type InfinitePaginationState,
  type PagerPagination,
} from "#/lib/pagination.tsx";
import type { FollowActor } from "#/lib/ratat.ts";
import { Fragment, type RefObject } from "react";

/**
 * Ported from the old app's `src/components/profile/ActorRow.tsx`: same markup
 * and classes. The BskyOnlyBadge is gone — nothing on Ratat is mirrored from
 * Bluesky anymore — and the follow button writes a Ratat follow, not a Bluesky
 * one, so it takes the account's DID rather than its handle.
 */
export function FollowRow({ account }: { account: FollowActor }) {
  const name = account.displayName?.trim() || account.handle || account.subject;
  return (
    <div className="flex items-center gap-[10px] px-[14px] py-[9px] max-[880px]:py-[14px] border-b border-line-soft last:border-b-0">
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
      <FollowButton
        subject={account.subject}
        variant="compact"
        className="max-[880px]:h-[36px] max-[880px]:px-[12px] max-[880px]:text-[13px] max-[880px]:[&_svg]:size-[15px]"
      />
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
  infinite,
  anchorIndex,
  anchorRef,
}: {
  actors: FollowActor[];
  loading?: boolean;
  pagination?: PagerPagination;
  infinite?: InfinitePaginationState<FollowActor>;
  anchorIndex?: number;
  anchorRef?: RefObject<HTMLDivElement | null>;
}) {
  if (loading && actors.length === 0) {
    return <p className="text-mist py-[24px]">Loading…</p>;
  }
  if (actors.length === 0) {
    return <p className="text-mist py-[24px]">No accounts to show.</p>;
  }
  return (
    <>
      <div className="border border-line bg-ink-raised max-[880px]:-mx-[var(--pad)]">
        {actors.map((account, index) => (
          <Fragment key={account.uri}>
            {anchorIndex === index && anchorRef ? (
              <div ref={anchorRef} className="h-0" aria-hidden="true" />
            ) : null}
            <FollowRow account={account} />
          </Fragment>
        ))}
      </div>
      {infinite?.enabled ? (
        <MobileInfinitePagination pagination={infinite} />
      ) : pagination ? (
        <Pager variant="standalone" pagination={pagination} />
      ) : null}
    </>
  );
}
