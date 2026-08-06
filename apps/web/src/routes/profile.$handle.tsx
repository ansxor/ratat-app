import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { ArtworkGrid } from "#/components/ArtworkGrid.tsx";
import { Footer } from "#/components/Footer.tsx";
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

  return (
    <>
      <main className="gallery">
        <div className="wrap layout">
          <div className="feed">
            <ProfileHeader profile={profile} artCount={profile.postsCount ?? posts.length} />

            <div className="pt-[18px] pb-[40px]">
              {posts.length === 0 ? (
                <p className="text-mist py-[24px]">No artworks to show yet.</p>
              ) : (
                <ArtworkGrid posts={posts} />
              )}

              {cursor && (
                <div className="flex items-center justify-center mt-[1.5rem]">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loading}
                    className="btn btn--ghost"
                  >
                    {loading ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ArtistError({ error }: { error: Error }) {
  return (
    <main className="gallery">
      <div className="wrap layout">
        <div className="feed">
          <p className="text-mist py-[24px]">{error.message}</p>
          <Link to="/" className="btn btn--ghost">
            Back to Ratat
          </Link>
        </div>
      </div>
    </main>
  );
}
