import { createFileRoute, Link } from "@tanstack/react-router";

import { FollowList } from "#/components/FollowList.tsx";
import { Footer } from "#/components/Footer.tsx";
import { ProfileHeader } from "#/components/ProfileHeader.tsx";
import { pagerLinks, type PagerPagination } from "#/lib/pagination.ts";
import {
  getFollowList,
  getProfile,
  readFailureMessage,
  type FollowListResult,
} from "#/lib/ratat.ts";

const PAGE_SIZE = 30;

export const Route = createFileRoute("/profile/$handle_/followers")({
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    const page = Math.trunc(Number(search.page));
    return Number.isFinite(page) && page > 1 ? { page } : {};
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ params, deps }) => {
    const profile = await getProfile(params.handle).catch((cause: unknown) => {
      throw new Error(readFailureMessage(cause, "No such account on Bluesky."));
    });
    const list = await getFollowList(params.handle, "followers", {
      page: deps.page,
      limit: PAGE_SIZE,
    });
    return { profile, list };
  },
  component: FollowersPage,
  pendingComponent: FollowListPending,
  errorComponent: FollowListError,
});

function paginationFor(list: FollowListResult, requested: number, handle: string): PagerPagination {
  const page = list.page ?? requested;
  return pagerLinks({
    page,
    limit: PAGE_SIZE,
    total: list.total,
    itemCount: list.actors.length,
    link: (target) => ({
      to: "/profile/$handle/followers",
      params: { handle },
      search: target > 1 ? { page: target } : {},
    }),
  });
}

function FollowersPage() {
  const { profile, list } = Route.useLoaderData();
  const { handle } = Route.useParams();
  const { page = 1 } = Route.useSearch();
  const pagination = paginationFor(list, page, handle);

  return (
    <>
      <main className="gallery pt-0">
        <div className="wrap layout">
          <div className="feed">
            <ProfileHeader
              profile={profile}
              artCount={profile.postsCount ?? 0}
              section="followers"
            />
            <div className="pt-[18px] pb-[40px]">
              <FollowList actors={list.actors} pagination={pagination} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function FollowListShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="gallery">
      <div className="wrap layout">
        <div className="feed">{children}</div>
      </div>
    </main>
  );
}

function FollowListPending() {
  return (
    <FollowListShell>
      <FollowList actors={[]} loading />
    </FollowListShell>
  );
}

function FollowListError({ error }: { error: Error }) {
  const { handle } = Route.useParams();
  return (
    <FollowListShell>
      <p className="text-mist py-[24px]">{error.message}</p>
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
    </FollowListShell>
  );
}
