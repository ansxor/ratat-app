import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Lightbox } from "#/components/Lightbox.tsx";
import { PortfolioGrid } from "#/components/PortfolioGrid.tsx";
import { ProfileHeader } from "#/components/ProfileHeader.tsx";
import { AppviewError, getAuthorFeed, getProfile, type Post, type Profile } from "#/lib/ratat.ts";

export const Route = createFileRoute("/profile/$handle")({
  loader: async ({ params }) => {
    const profile = await getProfile(params.handle).catch((cause: unknown) => {
      if (cause instanceof AppviewError && cause.kind === "ProfileNotFound") {
        throw new Error("No such account on Bluesky.");
      }
      throw cause;
    });
    const portfolio = await getAuthorFeed(profile.did);
    return { profile, portfolio };
  },
  component: ArtistPage,
  errorComponent: ArtistError,
});

function ArtistPage() {
  const { profile, portfolio } = Route.useLoaderData();
  return (
    <Portfolio
      key={profile.did}
      profile={profile}
      initial={portfolio.posts}
      initialCursor={portfolio.cursor}
    />
  );
}

function Portfolio({
  profile,
  initial,
  initialCursor,
}: {
  profile: Profile;
  initial: Post[];
  initialCursor: string | undefined;
}) {
  const [posts, setPosts] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await getAuthorFeed(profile.did, { cursor });
      setPosts((current) => [...current, ...page.posts]);
      setCursor(page.cursor);
    } finally {
      setLoading(false);
    }
  };

  const current = open === null ? undefined : posts[open];

  return (
    <>
      <main className="relative z-1 mx-auto w-full max-w-[var(--maxw)] px-xl py-xl">
        <ProfileHeader profile={profile} />

        <section className="mt-xl">
          {posts.length === 0 ? (
            <p className="rounded-md border border-line bg-ink-raised p-xl text-body-sm text-mist">
              No artwork yet — Ratat shows only posts that carry images or video.
            </p>
          ) : (
            <PortfolioGrid posts={posts} onOpen={setOpen} />
          )}

          {cursor ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loading}
              className="mx-auto mt-lg block rounded-pill border border-line-2 px-xl py-sm text-body-sm text-mist hover:text-paper disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </section>
      </main>

      {current ? (
        <Lightbox
          post={current}
          onClose={() => setOpen(null)}
          {...(open !== null && open > 0 ? { onPrev: () => setOpen(open - 1) } : {})}
          {...(open !== null && open < posts.length - 1 ? { onNext: () => setOpen(open + 1) } : {})}
        />
      ) : null}
    </>
  );
}

function ArtistError({ error }: { error: Error }) {
  return (
    <main className="mx-auto mt-xxl w-full max-w-md px-xl text-center">
      <p className="text-body text-paper">{error.message}</p>
      <Link
        to="/"
        className="mt-lg inline-block rounded-sm border border-line-2 px-md py-sm text-body-sm text-mist"
      >
        Back to Ratat
      </Link>
    </main>
  );
}
