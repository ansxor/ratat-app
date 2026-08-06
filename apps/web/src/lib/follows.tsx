import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import { createFollow, deleteFollow, listOwnFollows } from "#/lib/graph.ts";
import { getRatatFollows } from "#/lib/ratat.ts";
import { useSession } from "#/lib/session.tsx";

/**
 * The viewer's own Ratat graph, held once for the whole app: the follow button
 * on a profile, the home feed's empty state and the import offer all ask the
 * same question, and the answer is a few hundred DIDs at most.
 *
 * The index is asked first, since it is one request and always reachable. It
 * only answers for a repo it has walked, though — a graph written before Ratat
 * watched for it, or a follow written a second ago, exists only in the repo —
 * so the viewer's own PDS is the fallback and the writes below keep the map
 * true without re-reading anything.
 */

interface FollowsState {
  /** subject DID → the follow record's at-uri. */
  follows: ReadonlyMap<string, string>;
  loaded: boolean;
  isFollowing: (did: string) => boolean;
  follow: (did: string) => Promise<void>;
  unfollow: (did: string) => Promise<void>;
  reload: () => void;
}

const empty: ReadonlyMap<string, string> = new Map();

const FollowsContext = createContext<FollowsState>({
  follows: empty,
  loaded: false,
  isFollowing: () => false,
  follow: async () => {},
  unfollow: async () => {},
  reload: () => {},
});

export function FollowsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [follows, setFollows] = useState<ReadonlyMap<string, string>>(empty);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);

  const agent = session?.agent;
  const did = session?.did;

  useEffect(() => {
    setFollows(empty);
    setLoaded(false);
    if (!agent || !did) return;

    const controller = new AbortController();
    (async () => {
      const indexed = await getRatatFollows(did, controller.signal).catch(() => undefined);
      const entries =
        indexed && indexed.indexed
          ? indexed.follows
          : await listOwnFollows(agent, controller.signal).catch(() => indexed?.follows ?? []);
      if (controller.signal.aborted) return;
      setFollows(new Map(entries.map((entry) => [entry.subject, entry.uri])));
      setLoaded(true);
    })();

    return () => controller.abort();
  }, [agent, did, nonce]);

  const follow = useCallback(
    async (subject: string) => {
      if (!agent) return;
      const uri = await createFollow(agent, subject);
      setFollows((current) => new Map(current).set(subject, uri));
    },
    [agent],
  );

  const unfollow = useCallback(
    async (subject: string) => {
      const uri = follows.get(subject);
      if (!agent || !uri) return;
      await deleteFollow(agent, uri);
      setFollows((current) => {
        const next = new Map(current);
        next.delete(subject);
        return next;
      });
    },
    [agent, follows],
  );

  const value = useMemo<FollowsState>(
    () => ({
      follows,
      loaded,
      isFollowing: (subject: string) => follows.has(subject),
      follow,
      unfollow,
      reload: () => setNonce((n) => n + 1),
    }),
    [follows, loaded, follow, unfollow],
  );

  return <FollowsContext value={value}>{children}</FollowsContext>;
}

export function useFollows(): FollowsState {
  return use(FollowsContext);
}
