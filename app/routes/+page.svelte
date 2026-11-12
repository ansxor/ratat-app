<script lang="ts">
  import ArtworkGrid from "$lib/components/ArtworkGrid.svelte";
  import FeedNotice from "$lib/components/FeedNotice.svelte";
  import LoginPanel from "$lib/components/LoginPanel.svelte";
  import Pager from "$lib/components/Pager.svelte";
  import { pageHref, pagerLinks } from "$lib/pagination.ts";
  import type { PageData } from "./$types";

  const PAGE_SIZE = 30;

  let { data }: { data: PageData } = $props();

  const pagination = $derived.by(() => {
    if (!data.timeline) return undefined;
    return pagerLinks({
      page: data.timeline.page,
      limit: PAGE_SIZE,
      total: data.timeline.total,
      itemCount: data.timeline.posts.length,
      href: (target) => pageHref("/", target),
    });
  });
</script>

{#if !data.viewer}
  <LoginPanel />
{:else}
  <main class="gallery gallery--home max-mobile:py-0">
    <div class="wrap layout">
      <div class="feed">
        {#if data.errorMessage}
          <FeedNotice>{data.errorMessage}</FeedNotice>
        {:else if !data.hasFollows && (!data.timeline || data.timeline.posts.length === 0)}
          <FeedNotice>
            You don't follow any artists on Ratat yet.
            <a href="/onboarding">Bring over the ones you follow on Bluesky</a>, or open an
            artist's portfolio and follow them there.
          </FeedNotice>
        {:else if !data.timeline || data.timeline.posts.length === 0}
          <FeedNotice>
            Nothing from the artists you follow yet — their work is still being read in. Check back
            in a minute.
          </FeedNotice>
        {:else if pagination}
          <div class="max-mobile:-mx-[var(--pad)]">
            <Pager variant="top" {pagination} />
            <ArtworkGrid posts={data.timeline.posts} header="pinned" />
            <Pager variant="bottom" {pagination} />
          </div>
        {/if}
      </div>
    </div>
  </main>
{/if}
