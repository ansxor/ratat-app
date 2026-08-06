import { json, type QueryContext } from "@atcute/xrpc-server";
import type { NetRatatGraphGetFollows } from "@ratat/lexicon";
import { Effect } from "effect";

import { invalidCursor } from "../errors.ts";
import type { RouteEffect } from "../handler.ts";
import { decodeFeedCursor, encodeFeedCursor, followsPage, type RatatFollowRow } from "../store.ts";
import { resolveViewer } from "../viewer.ts";

const DEFAULT_LIMIT = 100;

type FollowView = NetRatatGraphGetFollows.FollowView;

const followView = (row: RatatFollowRow): FollowView => ({
  uri: row.uri as FollowView["uri"],
  subject: row.subject as FollowView["subject"],
  createdAt: row.createdAt.toISOString() as FollowView["createdAt"],
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

    const after = cursor === undefined ? undefined : decodeFeedCursor(cursor);
    if (cursor !== undefined && after === undefined) return yield* Effect.fail(invalidCursor());

    const viewer = yield* resolveViewer(actor, ctx.signal);

    const page = yield* followsPage(viewer.did, limit, after).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`follows of ${viewer.did} unreadable: ${String(error.cause)}`).pipe(
          Effect.as({ rows: [] as RatatFollowRow[], hasMore: false }),
        ),
      ),
    );

    const last = page.rows[page.rows.length - 1];
    const output: NetRatatGraphGetFollows.$output = {
      follows: page.rows.map(followView),
      indexed:
        viewer.row?.followsBackfilledAt !== undefined && viewer.row?.followsBackfilledAt !== null,
      ...(page.hasMore && last ? { cursor: encodeFeedCursor(last) } : {}),
    };
    return json(output);
  });
