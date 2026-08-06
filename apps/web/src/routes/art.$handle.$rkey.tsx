import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { ArtworkGate } from "#/components/content/ArtworkGate.tsx";
import { ArtworkVeil, veilFrameClass } from "#/components/content/ArtworkVeil.tsx";
import { EngagementButton } from "#/components/EngagementButton.tsx";
import { FeedNotice } from "#/components/FeedNotice.tsx";
import { FollowButton } from "#/components/FollowButton.tsx";
import { Footer } from "#/components/Footer.tsx";
import { Sidebar } from "#/components/Sidebar.tsx";
import { BlueskyIcon } from "#/components/ui/icons.tsx";
import { rkeyOf } from "#/lib/artwork-href.ts";
import { formatDate } from "#/lib/date.ts";
import {
  aspectRatio,
  getAuthorFeed,
  getPost,
  isVideo,
  type Media,
  type Post,
  readFailureMessage,
} from "#/lib/ratat.ts";
import { useContentVeil } from "#/lib/settings.tsx";
import { cn } from "#/lib/utils.ts";

export const Route = createFileRoute("/art/$handle/$rkey")({
  loader: async ({ params }) => {
    const post = await getPost(params.handle, params.rkey).catch((cause: unknown) => {
      throw new Error(readFailureMessage(cause, "That artwork isn't on Ratat."));
    });
    const feed = await getAuthorFeed(post.author.did, { limit: 12 }).catch(() => undefined);
    const moreBy = (feed?.posts ?? []).filter((other) => other.uri !== post.uri).slice(0, 4);
    return { post, moreBy };
  },
  component: ArtworkPage,
  pendingComponent: ArtworkPending,
  errorComponent: ArtworkError,
});

interface Veil {
  variant: "black" | "blur" | null;
  peeked: boolean;
  animated: boolean;
  reveal: () => void;
}

function MediaFrame({ media, alt, veil }: { media: Media; alt: string; veil: Veil }) {
  const style = {
    position: "relative" as const,
    overflow: "hidden",
    height: "calc(100vh - 260px)",
    background: "var(--ink-raised)",
    border: "1px solid var(--line)",
    padding: "16px",
  };

  const covered = veil.variant !== null && !veil.peeked;
  const frame = cn(
    veilFrameClass(covered ? veil.variant : null, { animated: veil.animated, strength: "page" }),
  );

  const cover = veil.variant && (
    <ArtworkVeil
      variant={veil.variant}
      peeked={veil.peeked}
      animated={veil.animated}
      onReveal={veil.reveal}
      prominent
      iconSize={44}
      label="Uncensor this artwork"
    />
  );

  if (isVideo(media)) {
    return (
      <div style={style} className={frame}>
        <video
          controls
          playsInline
          poster={media.thumbnail}
          src={media.playlist}
          style={{ aspectRatio: aspectRatio(media), height: "100%", width: "100%" }}
          className="bg-mat object-contain"
        >
          <track kind="captions" />
        </video>
        {cover}
      </div>
    );
  }

  return (
    <div style={style} className={frame}>
      <img
        src={media.fullsize}
        alt={covered ? "" : (media.alt ?? alt)}
        className="h-full w-full bg-mat object-contain"
      />
      {cover}
    </div>
  );
}

function ArtworkPage() {
  const { post, moreBy } = Route.useLoaderData();
  const { hidden, veil, peeked, animated, reveal } = useContentVeil(post.labels);
  const [unhidden, setUnhidden] = useState(false);
  const artistName = post.author.displayName?.trim() || post.author.handle;
  const description = (post.text ?? "").trim() || undefined;
  const mediaAlt = `Artwork by @${post.author.handle}`;

  if (hidden && !unhidden) {
    return (
      <ArtworkGate
        handle={post.author.handle}
        labels={post.labels}
        onReveal={() => setUnhidden(true)}
      />
    );
  }

  const frameVeil: Veil = { variant: veil, peeked, animated, reveal };

  return (
    <>
      <main className="gallery">
        <div className="wrap layout">
          <div className="feed">
            {post.media.map((media, index) => (
              <div key={index} className={index === 0 ? "" : "mt-[0.4rem]"}>
                <MediaFrame media={media} alt={mediaAlt} veil={frameVeil} />
              </div>
            ))}

            <div className="mt-[24px] flex items-start gap-[16px]">
              <div className="min-w-0 flex-auto">
                <div className="flex items-center gap-[10px]">
                  <Link
                    to="/profile/$handle"
                    params={{ handle: post.author.handle }}
                    className="inline-flex items-center gap-[7px] border-b border-line text-paper rounded-[6px] px-[7px] py-[3px] mx-[-7px] my-[-3px] transition-[background] duration-[140ms] hover:bg-ink-hi"
                  >
                    {post.author.avatar ? (
                      <img
                        src={post.author.avatar}
                        alt={artistName}
                        width={20}
                        height={20}
                        className="flex-none rounded-[4px] border border-line-2 object-cover"
                      />
                    ) : (
                      <span className="size-[20px] flex-none rounded-[4px] border border-line-2 bg-mat" />
                    )}
                    <span>{artistName}</span>
                  </Link>
                  <FollowButton subject={post.author.did} variant="compact" />
                </div>
              </div>

              <div className="flex gap-[8px] flex-none">
                <EngagementButton post={post} variant="detail" />
              </div>
            </div>

            <ArtworkMeta post={post} description={description} />
          </div>

          <Sidebar moreBy={moreBy} />
        </div>
      </main>
      <Footer />
    </>
  );
}

function ArtworkMeta({ post, description }: { post: Post; description: string | undefined }) {
  return (
    <div
      style={{
        marginTop: "16px",
        background: "var(--ink-raised)",
        border: "1px solid var(--line-2)",
        borderRadius: "4px",
        boxShadow: "0 2px 0 var(--shadow)",
      }}
    >
      {description && (
        <div
          style={{
            padding: "16px",
            fontSize: "15px",
            lineHeight: 1.6,
            color: "var(--paper)",
            whiteSpace: "pre-wrap",
          }}
        >
          {description}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px 22px",
          flexWrap: "wrap",
          padding: "9px 16px",
          borderTop: description ? "1px solid var(--line)" : "none",
          background: "var(--ink)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: "6px",
            fontSize: "12px",
            color: "var(--mist)",
          }}
        >
          <b
            style={{
              fontWeight: 700,
              fontSize: "10px",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--faint)",
            }}
          >
            Posted
          </b>
          {formatDate(post.createdAt)}
        </span>
        <a
          href={post.bskyUrl}
          target="_blank"
          rel="noreferrer noopener"
          title="Open the source post on Bluesky"
          className="transition-[background,border-color] duration-[140ms] hover:bg-bsky-tint-hi hover:border-bsky-line-hi"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            flex: "none",
            marginLeft: "auto",
            padding: "3px 8px",
            borderRadius: "999px",
            border: "1px solid var(--bsky-line)",
            background: "var(--bsky-tint)",
            fontSize: "11.5px",
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--mist)",
          }}
        >
          <BlueskyIcon width={12} />
          <span aria-hidden="true" style={{ fontVariantNumeric: "tabular-nums" }}>
            {post.likeCount ?? 0} · {post.repostCount ?? 0} · {post.replyCount ?? 0}
          </span>
        </a>
      </div>
    </div>
  );
}

function ArtworkShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="gallery">
      <div className="wrap layout">
        <div className="feed">{children}</div>
      </div>
    </main>
  );
}

function ArtworkPending() {
  return (
    <ArtworkShell>
      <FeedNotice pulse>Loading…</FeedNotice>
    </ArtworkShell>
  );
}

function ArtworkError({ error }: { error: Error }) {
  const { handle, rkey } = Route.useParams();
  return (
    <ArtworkShell>
      <FeedNotice>{error.message}</FeedNotice>
      <Link
        to="/profile/$handle"
        params={{ handle }}
        className="btn btn--ghost"
        title={rkeyOf(rkey)}
      >
        Back to @{handle}
      </Link>
    </ArtworkShell>
  );
}
