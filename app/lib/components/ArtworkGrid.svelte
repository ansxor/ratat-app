<script lang="ts">
  import ArtworkCard, { type ArtworkCardHeader } from "$lib/components/ArtworkCard.svelte";
  import type { Post } from "$lib/ratat.ts";

  let {
    posts,
    header,
  }: {
    posts: Post[];
    header?: ArtworkCardHeader;
  } = $props();
</script>

<div class="masonry">
  {#each posts as post (post.uri)}
    <ArtworkCard {post} {header} />
  {/each}
</div>
