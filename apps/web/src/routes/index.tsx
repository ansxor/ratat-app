import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ArtworkGrid } from "#/components/ArtworkGrid.tsx";
import { FeedNotice } from "#/components/FeedNotice.tsx";
import { Footer } from "#/components/Footer.tsx";
import { LoginPanel } from "#/components/LoginPanel.tsx";
import { Pager } from "#/components/Pager.tsx";
import { useFollows } from "#/lib/follows.tsx";
import {
  MobileInfinitePagination,
  pagerLinks,
  paginationSearch,
  useInfinitePagination,
  useMobileInfinitePagination,
  useScrollToPaginationMode,
  type PagerPagination,
} from "#/lib/pagination.tsx";
import { getTimeline, type Timeline } from "#/lib/ratat.ts";
import { useSession } from "#/lib/session.tsx";

const PAGE_SIZE = 30;

export const Route = createFileRoute("/")({
  validateSearch: paginationSearch,
  component: Home,
});

/**
 * Home is the following feed. Signed out there is nothing to follow with, so
 * the page is the sign-in card and nothing else.
 */
function Home() {
  const { session, restored } = useSession();
  const search = Route.useSearch();
  const page = search.page ?? 1;

  if (!restored) {
    return (
      <FeedShell>
        <FeedNotice pulse>Loading…</FeedNotice>
      </FeedShell>
    );
  }
  if (!session) return <LoginPanel />;
  return <HomeFeed did={session.did} page={page} />;
}

function FeedShell({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <main className="gallery max-[880px]:py-0">
        <div className="wrap layout">
          <div className="feed">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function paginationFor(timeline: Timeline): PagerPagination {
  return pagerLinks({
    page: timeline.page,
    limit: PAGE_SIZE,
    total: timeline.total,
    itemCount: timeline.posts.length,
    link: (target) => ({ to: "/", search: target > 1 ? { page: target } : {} }),
  });
}

function HomeFeed({ did, page }: { did: string; page: number }) {
  const { follows, loaded } = useFollows();
  const [timeline, setTimeline] = useState<Timeline | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    getTimeline(did, { page, limit: PAGE_SIZE, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setTimeline(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [did, page]);

  if (failed) {
    return (
      <FeedShell>
        <FeedNotice>Couldn&apos;t load your feed right now. Try again in a moment.</FeedNotice>
      </FeedShell>
    );
  }

  if (timeline === undefined || !loaded) {
    return (
      <FeedShell>
        <FeedNotice pulse>Loading…</FeedNotice>
      </FeedShell>
    );
  }

  if (follows.size === 0) {
    return (
      <FeedShell>
        <FeedNotice>
          You don&apos;t follow any artists on Ratat yet.{" "}
          <Link to="/onboarding">Bring over the ones you follow on Bluesky</Link>, or open an
          artist&apos;s portfolio and follow them there.
        </FeedNotice>
      </FeedShell>
    );
  }

  if (timeline.posts.length === 0) {
    return (
      <FeedShell>
        <FeedNotice>
          Nothing from the artists you follow yet — their work is still being read in. Check back in
          a minute.
        </FeedNotice>
      </FeedShell>
    );
  }

  return <HomeFeedContent did={did} timeline={timeline} />;
}

function HomeFeedContent({ did, timeline }: { did: string; timeline: Timeline }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const infinite = useInfinitePagination({
    enabled: useMobileInfinitePagination(),
    resetKey: did,
    initialPage: timeline,
    pageNumber: (result) => result.page,
    getItems: (result) => result.posts,
    hasNextPage: (result) => result.page * PAGE_SIZE < result.total,
    loadPage: (target) => getTimeline(did, { page: target, limit: PAGE_SIZE }),
  });
  const displayTimeline = infinite.lastPage;
  const pagination = paginationFor(displayTimeline);
  const posts = infinite.enabled ? infinite.items : displayTimeline.posts;
  useScrollToPaginationMode(anchorRef, !infinite.isPreparing);

  return (
    <FeedShell>
      <div className="max-[880px]:-mx-[var(--pad)]">
        {infinite.enabled ? null : <Pager variant="top" pagination={pagination} />}
        <ArtworkGrid
          posts={posts}
          header="pinned"
          anchorIndex={infinite.enabled ? infinite.lastPageStart : 0}
          anchorRef={anchorRef}
        />
        {infinite.enabled ? (
          <MobileInfinitePagination pagination={infinite} />
        ) : (
          <Pager variant="bottom" pagination={pagination} />
        )}
      </div>
    </FeedShell>
  );
}
