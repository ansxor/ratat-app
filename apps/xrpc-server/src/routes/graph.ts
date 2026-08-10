import { json, type QueryContext } from "@atcute/xrpc-server";
import type { NetRatatGraphGetFollowers, NetRatatGraphGetFollows } from "@ratat/lexicon";
import { Effect } from "effect";

import { invalidCursor } from "../errors.ts";
import type { RouteEffect } from "../handler.ts";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  followersPage,
  followersPageByNumber,
  followsPage,
  followsPageByNumber,
  type GraphRow,
} from "../store.ts";
import { resolveViewer } from "../viewer.ts";

const DEFAULT_LIMIT = 100;

type FollowView = NetRatatGraphGetFollows.FollowView;
type FollowerView = NetRatatGraphGetFollowers.FollowView;

/**
 * A follow row as a lexicon follow view. The profile fields come from the
 * followed account's index snapshot; a handle the index has not resolved yet
 * is left out rather than faked, and callers fall back to the DID. The two
 * graph lexicons mint their own branded view types, so there are two of these.
 */
const followView = (row: GraphRow): FollowView => ({
  uri: row.follow.uri as FollowView["uri"],
  subject: row.follow.subject as FollowView["subject"],
  createdAt: row.follow.createdAt.toISOString() as FollowView["createdAt"],
  ...(row.actor?.handle && !row.actor.handle.startsWith("did:")
    ? { handle: row.actor.handle as FollowView["handle"] }
    : {}),
  ...(row.actor?.displayName ? { displayName: row.actor.displayName } : {}),
  ...(row.actor?.avatar ? { avatar: row.actor.avatar as NonNullable<FollowView["avatar"]> } : {}),
});

const followerView = (row: GraphRow): FollowerView => ({
  uri: row.follow.uri as FollowerView["uri"],
  subject: row.follow.subject as FollowerView["subject"],
  createdAt: row.follow.createdAt.toISOString() as FollowerView["createdAt"],
  ...(row.actor?.handle && !row.actor.handle.startsWith("did:")
    ? { handle: row.actor.handle as FollowerView["handle"] }
    : {}),
  ...(row.actor?.displayName ? { displayName: row.actor.displayName } : {}),
  ...(row.actor?.avatar ? { avatar: row.actor.avatar as NonNullable<FollowerView["avatar"]> } : {}),
});

/**
 * An actor's Ratat follows out of the local index.
 *
 * `indexed` is the honest part of the answer: until the ingester has walked
 * this repo once, follows written before Ratat watched the collection are
 * missing, and a client holding the repo — which, for the viewer's own
 * follows, the web app does — should read it rather than trust this list. The
 * request itself is what queues that walk.
 */
export const graphGetFollows = (
  ctx: QueryContext<NetRatatGraphGetFollows.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const { actor, cursor } = ctx.params;
    const limit = ctx.params.limit ?? DEFAULT_LIMIT;

    const viewer = yield* resolveViewer(actor, ctx.signal);

    const output: NetRatatGraphGetFollows.$output = {
      follows: [],
      indexed:
        viewer.row?.followsBackfilledAt !== undefined && viewer.row?.followsBackfilledAt !== null,
    };

    // The list page pages by number, which the index answers with an offset;
    // the follow-button state walks cursors instead. Either way the rows are
    // the same shape.
    if (ctx.params.page !== undefined) {
      const page = yield* followsPageByNumber(viewer.did, limit, ctx.params.page).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`follows of ${viewer.did} unreadable: ${String(error.cause)}`).pipe(
            Effect.as({ rows: [] as GraphRow[], page: 1, total: 0 }),
          ),
        ),
      );
      output.follows = page.rows.map(followView);
      output.page = page.page;
      output.total = page.total;
      return json(output);
    }

    const after = cursor === undefined ? undefined : decodeFeedCursor(cursor);
    if (cursor !== undefined && after === undefined) return yield* Effect.fail(invalidCursor());

    const page = yield* followsPage(viewer.did, limit, after).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`follows of ${viewer.did} unreadable: ${String(error.cause)}`).pipe(
          Effect.as({ rows: [] as GraphRow[], hasMore: false }),
        ),
      ),
    );

    const last = page.rows[page.rows.length - 1];
    output.follows = page.rows.map(followView);
    if (page.hasMore && last) output.cursor = encodeFeedCursor(last.follow);
    return json(output);
  });

/**
 * An actor's Ratat followers out of the local index, newest first. There is no
 * walk that completes this list the way `indexed` promises for follows: the
 * tail sees every follow written from now on, and follows written before the
 * tail existed only surface once their follower's repo is walked.
 */
export const graphGetFollowers = (
  ctx: QueryContext<NetRatatGraphGetFollowers.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const { actor, cursor } = ctx.params;
    const limit = ctx.params.limit ?? DEFAULT_LIMIT;

    const viewer = yield* resolveViewer(actor, ctx.signal);

    const output: NetRatatGraphGetFollowers.$output = { followers: [] };

    if (ctx.params.page !== undefined) {
      const page = yield* followersPageByNumber(viewer.did, limit, ctx.params.page).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`followers of ${viewer.did} unreadable: ${String(error.cause)}`).pipe(
            Effect.as({ rows: [] as GraphRow[], page: 1, total: 0 }),
          ),
        ),
      );
      output.followers = page.rows.map(followerView);
      output.page = page.page;
      output.total = page.total;
      return json(output);
    }

    const after = cursor === undefined ? undefined : decodeFeedCursor(cursor);
    if (cursor !== undefined && after === undefined) return yield* Effect.fail(invalidCursor());

    const page = yield* followersPage(viewer.did, limit, after).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`followers of ${viewer.did} unreadable: ${String(error.cause)}`).pipe(
          Effect.as({ rows: [] as GraphRow[], hasMore: false }),
        ),
      ),
    );

    const last = page.rows[page.rows.length - 1];
    output.followers = page.rows.map(followerView);
    if (page.hasMore && last) output.cursor = encodeFeedCursor(last.follow);
    return json(output);
  });
