import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ArtworkGate } from "#/components/content/ArtworkGate.tsx";
import { ExpandableText } from "#/components/ExpandableText.tsx";
import { ArtworkVeil, veilFrameClass } from "#/components/content/ArtworkVeil.tsx";
import { EngagementButton } from "#/components/EngagementButton.tsx";
import { FeedNotice } from "#/components/FeedNotice.tsx";
import { FollowButton } from "#/components/FollowButton.tsx";
import { Footer } from "#/components/Footer.tsx";
import { Sidebar } from "#/components/Sidebar.tsx";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "#/components/ui/Carousel.tsx";
import { BlueskyIcon } from "#/components/ui/icons.tsx";
import { rkeyOf } from "#/lib/artwork-href.ts";
import { formatDate } from "#/lib/date.ts";
import { Image, BLACKOUT_IMAGES } from "#/lib/image.tsx";
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
    const feed = await getAuthorFeed(post.author.did, { sample: true, limit: 9 }).catch(
      () => undefined,
    );
    const moreBy = (feed?.posts ?? []).filter((other) => other.uri !== post.uri).slice(0, 8);
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
    width: "100%",
    aspectRatio: aspectRatio(media),
    background: "var(--ink-raised)",
    border: "1px solid var(--line)",
  };

  const covered = veil.variant !== null && !veil.peeked;
  const frame = cn(
    veilFrameClass(covered ? veil.variant : null, { animated: veil.animated, strength: "page" }),
    "max-mobile:box-border max-mobile:!h-full max-mobile:min-h-0 max-mobile:max-h-none",
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
      <div style={style} className={cn(frame, "p-[16px] max-mobile:p-0")}>
        <video
          controls
          playsInline
          data-embla-no-drag
          poster={BLACKOUT_IMAGES ? undefined : media.thumbnail}
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
    <div style={style} className={cn(frame, "p-[16px] max-mobile:p-0")}>
      <Image
        src={media.fullsize}
        alt={covered ? "" : (media.alt ?? alt)}
        className="h-full w-full bg-mat object-contain"
      />
      {cover}
    </div>
  );
}

function MediaCarousel({ media, alt, veil }: { media: Media[]; alt: string; veil: Veil }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(1);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    const onSelect = () => setCurrent(api.selectedScrollSnap() + 1);
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      aria-label={alt}
      className="max-mobile:h-full max-mobile:[&_[data-slot=carousel-content]]:h-full max-mobile:[&_[data-slot=carousel-item]]:h-full"
    >
      <CarouselContent className="-ml-[0.4rem]">
        {media.map((item, index) => (
          <CarouselItem key={index} className="pl-[0.4rem]">
            <MediaFrame media={item} alt={alt} veil={veil} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="!left-2" />
      <CarouselNext className="!right-2" />
      {count > 1 && (
        <div
          className="absolute bottom-[10px] right-[10px] z-[5] bg-scrim-chip px-[7px] py-[3px] font-[700] text-[11px] leading-[1.4] text-accent-ink tabular-nums"
          aria-hidden="true"
        >
          {current} / {count}
        </div>
      )}
    </Carousel>
  );
}

function ArtistActions({ post }: { post: Post }) {
  const artistName = post.author.displayName?.trim() || post.author.handle;
  return (
    <>
      <div className="min-w-0 flex-auto">
        <div className="flex items-center gap-[10px]">
          <Link
            to="/profile/$handle"
            params={{ handle: post.author.handle }}
            className="inline-flex min-w-0 items-center gap-[7px] border-b border-line text-paper rounded-[6px] px-[7px] py-[3px] mx-[-7px] my-[-3px] transition-[background] duration-[140ms] hover:bg-ink-hi max-mobile:border-b-0"
          >
            {post.author.avatar ? (
              <Image
                src={post.author.avatar}
                alt={artistName}
                width={20}
                height={20}
                className="flex-none rounded-[4px] border border-line-2 object-cover"
              />
            ) : (
              <span className="size-[20px] flex-none rounded-[4px] border border-line-2 bg-mat" />
            )}
            <span className="min-w-0 truncate max-mobile:text-[17px] max-mobile:font-[600]">
              {artistName}
            </span>
          </Link>
          <FollowButton
            subject={post.author.did}
            variant="compact"
            className="max-mobile:h-[34px] max-mobile:px-[12px] max-mobile:text-[14px] max-mobile:[&_svg]:size-[15px]"
          />
        </div>
      </div>
      <div className="flex gap-[8px] flex-none">
        <EngagementButton post={post} variant="detail" />
      </div>
    </>
  );
}

function ArtworkPage() {
  const { post, moreBy } = Route.useLoaderData();
  const { hidden, veil, peeked, animated, reveal } = useContentVeil(post.labels);
  const [unhidden, setUnhidden] = useState(false);
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
      <main className="gallery max-mobile:pt-0">
        <div className="wrap layout">
          <div className="feed">
            <div className="max-mobile:flex max-mobile:h-[calc(100dvh-64px)] max-mobile:flex-col">
              <div className="max-mobile:-mx-[var(--pad)] max-mobile:min-h-0 max-mobile:flex-1">
                {post.media.length > 1 ? (
                  <MediaCarousel media={post.media} alt={mediaAlt} veil={frameVeil} />
                ) : (
                  post.media[0] && (
                    <MediaFrame media={post.media[0]} alt={mediaAlt} veil={frameVeil} />
                  )
                )}
              </div>

              <div className="mt-[24px] flex items-start gap-[16px] max-mobile:hidden">
                <ArtistActions post={post} />
              </div>
              <div className="hidden max-mobile:-mx-[var(--pad)] max-mobile:flex max-mobile:items-center max-mobile:gap-[12px] max-mobile:mb-px max-mobile:border max-mobile:border-line-2 max-mobile:bg-ink-raised max-mobile:px-[16px] max-mobile:py-[9px]">
                <ArtistActions post={post} />
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
      className="mt-[16px] max-mobile:mt-0 max-mobile:-mx-[var(--pad)] rounded-[4px] max-mobile:rounded-none"
      style={{
        background: "var(--ink-raised)",
        border: "1px solid var(--line-2)",
        boxShadow: "0 2px 0 var(--shadow)",
      }}
    >
      {description && (
        <div
          className="text-[15px] max-mobile:text-[13px]"
          style={{
            padding: "16px",
            lineHeight: 1.6,
            color: "var(--paper)",
            whiteSpace: "pre-wrap",
          }}
        >
          <ExpandableText
            description={description}
            id="artwork-description"
            className="m-0"
            collapsedClassName="max-mobile:line-clamp-3"
          />
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
            borderRadius: "0",
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
