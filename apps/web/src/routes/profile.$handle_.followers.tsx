import { createFileRoute, Link } from "@tanstack/react-router";

import { FollowList } from "#/components/FollowList.tsx";
import { Footer } from "#/components/Footer.tsx";
import { ProfileHeader } from "#/components/ProfileHeader.tsx";
import {
  pagerLinks,
  paginationSearch,
  useInfinitePagination,
  useMobileInfinitePagination,
  type PagerPagination,
} from "#/lib/pagination.tsx";
import {
  getFollowList,
  getProfile,
  readFailureMessage,
  type FollowListResult,
} from "#/lib/ratat.ts";

const PAGE_SIZE = 30;

export const Route = createFileRoute("/profile/$handle_/followers")({
  validateSearch: paginationSearch,
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
  const search = Route.useSearch();
  const page = search.page ?? 1;
  const infinite = useInfinitePagination({
    enabled: useMobileInfinitePagination(),
    resetKey: `${profile.did}:followers`,
    initialPage: list,
    pageNumber: (result) => result.page ?? 1,
    getItems: (result) => result.actors,
    hasNextPage: (result) =>
      result.total === undefined
        ? result.actors.length >= PAGE_SIZE
        : (result.page ?? 1) * PAGE_SIZE < result.total,
    loadPage: (target) =>
      getFollowList(profile.did, "followers", { page: target, limit: PAGE_SIZE }),
  });
  const displayList = infinite.lastPage;
  const displayPage = displayList.page ?? page;
  const pagination = paginationFor(displayList, displayPage, handle);

  return (
    <>
      <main className="gallery max-[880px]:pt-0">
        <div className="wrap layout">
          <div className="feed">
            <ProfileHeader
              profile={profile}
              artCount={profile.postsCount ?? 0}
              section="followers"
            />
            <div className="pt-[18px] pb-[40px]">
              <FollowList
                actors={infinite.enabled ? infinite.items : displayList.actors}
                pagination={pagination}
                infinite={infinite}
              />
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
