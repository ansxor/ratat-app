<script lang="ts">
  import { rkeyOf } from "$lib/artwork-href";
  import { BLACKOUT_IMAGES } from "$lib/artwork-media";
  import ArtworkGate from "$lib/components/ArtworkGate.svelte";
  import ArtworkVeil, { veilFrameClass } from "$lib/components/ArtworkVeil.svelte";
  import Carousel from "$lib/components/Carousel.svelte";
  import EngagementButton from "$lib/components/EngagementButton.svelte";
  import ExpandableText from "$lib/components/ExpandableText.svelte";
  import FeedNotice from "$lib/components/FeedNotice.svelte";
  import FollowButton from "$lib/components/FollowButton.svelte";
  import Icons from "$lib/components/Icons.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { formatDate } from "$lib/date";
  import { aspectRatio, isVideo, type Media, type Post } from "$lib/ratat";
  import { useContentVeil } from "$lib/settings.svelte";
  import { cn } from "$lib/utils";

  let { data } = $props();

  const contentVeil = useContentVeil(() => data.post?.labels);
  let unhidden = $state(false);

  $effect(() => {
    void data.post?.uri;
    unhidden = false;
  });

  const covered = $derived(contentVeil.veil !== null && !contentVeil.peeked);
  const description = $derived((data.post?.text ?? "").trim() || undefined);
  const mediaAlt = $derived(data.post ? `Artwork by @${data.post.author.handle}` : "Artwork");
</script>

{#snippet mediaFrame(media: Media, alt: string)}
  {@const ratio = aspectRatio(media)}
  {@const frameStyle = [
    "position: relative",
    "overflow: hidden",
    "height: calc(100vh - 260px)",
    "width: 100%",
    ratio ? `aspect-ratio: ${ratio}` : null,
    "background: var(--ink-raised)",
    "border: 1px solid var(--line)",
  ]
    .filter(Boolean)
    .join("; ")}
  <div
    style={frameStyle}
    class={cn(
      veilFrameClass(covered ? contentVeil.veil : null, {
        animated: contentVeil.animated,
        strength: "page",
      }),
      "p-[16px] max-mobile:p-0 max-mobile:box-border max-mobile:!h-full max-mobile:min-h-0 max-mobile:max-h-none",
    )}
  >
    {#if isVideo(media)}
      <video
        controls
        playsinline
        data-embla-no-drag
        poster={BLACKOUT_IMAGES ? undefined : media.thumbnail}
        src={media.playlist}
        style={`${ratio ? `aspect-ratio: ${ratio}; ` : ""}height: 100%; width: 100%;`}
        class="bg-mat object-contain"
      >
        <track kind="captions" />
      </video>
    {:else if BLACKOUT_IMAGES}
      <span
        class="inline-block h-full w-full bg-black"
        role={covered ? undefined : "img"}
        aria-label={covered ? undefined : (media.alt ?? alt)}
        aria-hidden={covered ? true : undefined}
      ></span>
    {:else}
      <img
        src={media.fullsize}
        alt={covered ? "" : (media.alt ?? alt)}
        class="h-full w-full bg-mat object-contain"
      />
    {/if}

    {#if contentVeil.veil}
      <ArtworkVeil
        variant={contentVeil.veil}
        peeked={contentVeil.peeked}
        animated={contentVeil.animated}
        onReveal={contentVeil.reveal}
        prominent
        iconSize={44}
        label="Uncensor this artwork"
      />
    {/if}
  </div>
{/snippet}

{#snippet artistActions(post: Post)}
  {@const artistName = post.author.displayName?.trim() || post.author.handle}
  <div class="min-w-0 flex-auto">
    <div class="flex items-center gap-[10px]">
      <a
        href={`/profile/${encodeURIComponent(post.author.handle)}`}
        class="inline-flex min-w-0 items-center gap-[7px] border-b border-line text-paper rounded-[6px] px-[7px] py-[3px] mx-[-7px] my-[-3px] transition-[background] duration-[140ms] hover:bg-ink-hi max-mobile:border-b-0"
      >
        {#if post.author.avatar && !BLACKOUT_IMAGES}
          <img
            src={post.author.avatar}
            alt={artistName}
            width={20}
            height={20}
            class="flex-none rounded-[4px] border border-line-2 object-cover"
          />
        {:else if post.author.avatar && BLACKOUT_IMAGES}
          <span
            class="inline-block size-[20px] flex-none rounded-[4px] border border-line-2 bg-black"
            role="img"
            aria-label={artistName}
          ></span>
        {:else}
          <span class="size-[20px] flex-none rounded-[4px] border border-line-2 bg-mat"></span>
        {/if}
        <span class="min-w-0 truncate max-mobile:text-[17px] max-mobile:font-[600]">
          {artistName}
        </span>
      </a>
      <FollowButton
        subjectDid={post.author.did}
        subjectHandle={post.author.handle}
        variant="compact"
        class="max-mobile:h-[34px] max-mobile:px-[12px] max-mobile:text-[14px] max-mobile:[&_svg]:size-[15px]"
      />
    </div>
  </div>
  <div class="flex gap-[8px] flex-none">
    <EngagementButton
      postUri={post.uri}
      postCid={post.cid}
      likeCount={post.likeCount ?? 0}
      viewerLikeUri={post.viewerLike}
      size="md"
      variant="detail"
    />
  </div>
{/snippet}

{#if !data.post}
  <main class="gallery">
    <div class="wrap layout">
      <div class="feed">
        <FeedNotice>{data.errorMessage}</FeedNotice>
        <a
          href={`/profile/${encodeURIComponent(data.handle)}`}
          class="btn btn--ghost"
          title={rkeyOf(data.rkey)}
        >
          Back to @{data.handle}
        </a>
      </div>
    </div>
  </main>
{:else if contentVeil.hidden && !unhidden}
  <ArtworkGate
    handle={data.post.author.handle}
    labels={data.post.labels}
    onReveal={() => (unhidden = true)}
  />
{:else}
  {@const post = data.post}
  <main class="gallery max-mobile:pt-0">
    <div class="wrap layout">
      <div class="feed">
        <div class="max-mobile:flex max-mobile:h-[calc(100dvh-66px)] max-mobile:flex-col">
          <div class="max-mobile:-mx-[var(--pad)] max-mobile:min-h-0 max-mobile:flex-1">
            {#if post.media.length > 1}
              {#key post.uri}
                <Carousel count={post.media.length} label={mediaAlt}>
                  {#each post.media as item, index (index)}
                    <div
                      role="group"
                      aria-roledescription="slide"
                      data-slot="carousel-item"
                      class="min-w-0 shrink-0 grow-0 basis-full pl-[0.4rem]"
                    >
                      {@render mediaFrame(item, mediaAlt)}
                    </div>
                  {/each}
                </Carousel>
              {/key}
            {:else if post.media[0]}
              {@render mediaFrame(post.media[0], mediaAlt)}
            {/if}
          </div>

          <div class="mt-[24px] flex items-start gap-[16px] max-mobile:hidden">
            {@render artistActions(post)}
          </div>
          <div
            class="hidden max-mobile:-mx-[var(--pad)] max-mobile:flex max-mobile:items-center max-mobile:gap-[12px] max-mobile:border max-mobile:border-line-2 max-mobile:bg-ink-raised max-mobile:px-[16px] max-mobile:py-[9px]"
          >
            {@render artistActions(post)}
          </div>
        </div>

        <div
          class="mt-[16px] max-mobile:mt-0 max-mobile:-mx-[var(--pad)] rounded-[4px] max-mobile:rounded-none"
          style="background: var(--ink-raised); border: 1px solid var(--line-2); box-shadow: 0 2px 0 var(--shadow);"
        >
          {#if description}
            <div
              class="text-[15px] max-mobile:text-[13px]"
              style="padding: 16px; line-height: 1.6; color: var(--paper); white-space: pre-wrap;"
            >
              <ExpandableText
                {description}
                id="artwork-description"
                class="m-0"
                collapsedClass="max-mobile:line-clamp-3"
              />
            </div>
          {/if}
          <div
            style={`display: flex; align-items: center; gap: 8px 22px; flex-wrap: wrap; padding: 9px 16px; border-top: ${description ? "1px solid var(--line)" : "none"}; background: var(--ink);`}
          >
            <span
              style="display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; color: var(--mist);"
            >
              <b
                style="font-weight: 700; font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--faint);"
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
              class="transition-[background,border-color] duration-[140ms] hover:bg-bsky-tint-hi hover:border-bsky-line-hi"
              style="display: inline-flex; align-items: center; gap: 6px; flex: none; margin-left: auto; padding: 3px 8px; border-radius: 0; border: 1px solid var(--bsky-line); background: var(--bsky-tint); font-size: 11.5px; font-weight: 700; line-height: 1; color: var(--mist);"
            >
              <Icons name="bluesky" width={12} size={12} tone="brand" />
              <span aria-hidden="true" style="font-variant-numeric: tabular-nums;">
                {post.likeCount ?? 0} · {post.repostCount ?? 0} · {post.replyCount ?? 0}
              </span>
            </a>
          </div>
        </div>
      </div>

      <Sidebar moreBy={data.moreBy} />
    </div>
  </main>
{/if}
