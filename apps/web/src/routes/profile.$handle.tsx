import { createFileRoute, Link } from "@tanstack/react-router";

import { ArtworkGrid } from "#/components/ArtworkGrid.tsx";
import { FeedNotice } from "#/components/FeedNotice.tsx";
import { Footer } from "#/components/Footer.tsx";
import { Pager } from "#/components/Pager.tsx";
import { ProfileHeader } from "#/components/ProfileHeader.tsx";
import { pagerLinks, type PagerPagination } from "#/lib/pagination.ts";
import {
  getAuthorFeed,
  getProfile,
  type Portfolio,
  type Profile,
  readFailureMessage,
} from "#/lib/ratat.ts";

const PAGE_SIZE = 30;

/** The appview refuses to walk further than this, so the pager stops offering it. */
const MAX_PAGE = 100;

export const Route = createFileRoute("/profile/$handle")({
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    const page = Math.trunc(Number(search.page));
    return Number.isFinite(page) && page > 1 ? { page: Math.min(page, MAX_PAGE) } : {};
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ params, deps }) => {
    const profile = await getProfile(params.handle).catch((cause: unknown) => {
      throw new Error(readFailureMessage(cause, "No such account on Bluesky."));
    });
    const portfolio = await getAuthorFeed(profile.did, { page: deps.page, limit: PAGE_SIZE });
    return { profile, portfolio };
  },
  component: ArtistPage,
  pendingComponent: ArtistPending,
  errorComponent: ArtistError,
});

/**
 * A cursor feed cannot say how long it is, so the page slots are sized from
 * Bluesky's post count — an upper bound, since posts without media are dropped
 * — and shown as a capped total. Reaching the end of the feed replaces the
 * estimate with what was actually paged through.
 */
function paginationFor(
  profile: Profile,
  portfolio: Portfolio,
  requested: number,
  handle: string,
): PagerPagination {
  // Asking past the end of a feed lands on its last page, so the pager follows
  // the page the appview served rather than the one in the URL.
  const page = portfolio.page ?? requested;
  const exhausted = portfolio.cursor === undefined;
  const paged = (page - 1) * PAGE_SIZE + portfolio.posts.length;
  // A cursor in hand means one more page exists, whatever the post count says.
  const estimate =
    profile.postsCount === undefined
      ? undefined
      : Math.max(profile.postsCount, page * PAGE_SIZE + 1);
  const total = exhausted ? paged : estimate;
  const ceiling = MAX_PAGE * PAGE_SIZE;

  return pagerLinks({
    page,
    limit: PAGE_SIZE,
    total: total === undefined ? undefined : Math.min(total, ceiling),
    totalCapped: total !== undefined && (!exhausted || total > ceiling),
    itemCount: portfolio.posts.length,
    link: (target) => ({
      to: "/profile/$handle",
      params: { handle },
      search: target > 1 ? { page: target } : {},
    }),
  });
}

function ArtistPage() {
  const { profile, portfolio } = Route.useLoaderData();
  const { handle } = Route.useParams();
  const { page = 1 } = Route.useSearch();
  const posts = portfolio.posts;
  const pagination = paginationFor(profile, portfolio, page, handle);

  return (
    <>
      <main className="gallery">
        <div className="wrap layout">
          <div className="feed">
            <ProfileHeader profile={profile} artCount={profile.postsCount ?? posts.length} />

            <div className="pt-[18px] pb-[40px]">
              {posts.length === 0 ? (
                <FeedNotice>
                  No artworks to show yet — this artist has posted nothing with media, or Ratat is
                  still reading their work in.
                </FeedNotice>
              ) : (
                <>
                  <Pager variant="top" pagination={pagination} />
                  <ArtworkGrid posts={posts} />
                  <Pager variant="bottom" pagination={pagination} />
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ArtistShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="gallery">
      <div className="wrap layout">
        <div className="feed">{children}</div>
      </div>
    </main>
  );
}

function ArtistPending() {
  return (
    <ArtistShell>
      <FeedNotice pulse>Loading…</FeedNotice>
    </ArtistShell>
  );
}

function ArtistError({ error }: { error: Error }) {
  const { handle } = Route.useParams();
  return (
    <ArtistShell>
      <FeedNotice>{error.message}</FeedNotice>
      <div className="flex gap-[8px]">
        <Link to="/" className="btn btn--ghost">
          Back to Ratat
        </Link>
        <a
          className="btn btn--ghost"
          href={`https://bsky.app/profile/${handle}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Look on Bluesky
        </a>
      </div>
    </ArtistShell>
  );
}
