<script module lang="ts">
  export type ArtworkCardHeader = "hover" | "pinned" | "none";
</script>

<script lang="ts">
  import { artworkHref } from "$lib/artwork-href.ts";
  import ArtworkVeil, { veilFrameClass } from "$lib/components/ArtworkVeil.svelte";
  import EngagementButton from "$lib/components/EngagementButton.svelte";
  import { aspectRatio, isVideo, type Post } from "$lib/ratat.ts";
  import { useContentVeil } from "$lib/settings.svelte.ts";
  import { cn } from "$lib/utils.ts";

  let {
    post,
    aspect,
    header = "hover",
  }: {
    post: Post;
    aspect?: string;
    header?: ArtworkCardHeader;
  } = $props();

  const contentVeil = useContentVeil(() => post.labels);

  const cover = $derived(post.media[0]);
  const href = $derived(artworkHref(post));
  const title = $derived(post.text || `Artwork by @${post.author.handle}`);
  const imgAspect = $derived(aspect ?? (cover ? aspectRatio(cover) : undefined));
  const covered = $derived(contentVeil.veil !== null && !contentVeil.peeked);
  const coverSrc = $derived(
    cover ? (isVideo(cover) ? (cover.thumbnail ?? "") : cover.thumb) : "",
  );
  const coverAlt = $derived(covered ? "" : (cover?.alt ?? ""));
</script>

{#if cover && !contentVeil.hidden}
  <article
    class={cn("piece", header === "pinned" && "piece--pinned")}
    onmouseleave={() => contentVeil.unreveal()}
  >
    <div class="piece__art">
      {#if header !== "none"}
        <div class="piece__top">
          {#if post.author.avatar}
            <img
              class="piece__av"
              src={post.author.avatar}
              alt={post.author.displayName ?? post.author.handle}
              width={18}
              height={18}
            />
          {:else}
            <span class="piece__av"></span>
          {/if}
          <a
            class="piece__artist"
            href={`/profile/${encodeURIComponent(post.author.handle)}`}
          >
            @{post.author.handle}
          </a>
        </div>
      {/if}

      <div
        class={cn(
          "relative overflow-hidden",
          veilFrameClass(covered ? contentVeil.veil : null, {
            animated: contentVeil.animated,
          }),
        )}
        style:aspect-ratio={imgAspect}
      >
        <a
          class="piece__open absolute inset-0"
          {href}
          aria-label={covered ? "Filtered artwork" : title}
        >
          <img
            class="canvas h-full w-full object-cover"
            src={coverSrc}
            alt={coverAlt}
            loading="lazy"
          />
        </a>
        {#if contentVeil.veil}
          <ArtworkVeil
            variant={contentVeil.veil}
            peeked={contentVeil.peeked}
            animated={contentVeil.animated}
            onReveal={() => contentVeil.reveal()}
            label="Uncensor filtered artwork"
          />
        {/if}
      </div>

      <div class="piece__bar">
        <EngagementButton
          postUri={post.uri}
          postCid={post.cid}
          likeCount={post.likeCount ?? 0}
          viewerLikeUri={post.viewerLike}
          size="sm"
        />
      </div>
    </div>
  </article>
{/if}
