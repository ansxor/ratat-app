<script lang="ts">
  import ArtworkGrid from "$lib/components/ArtworkGrid.svelte";
  import FeedNotice from "$lib/components/FeedNotice.svelte";
  import Pager from "$lib/components/Pager.svelte";
  import ProfileHeader from "$lib/components/ProfileHeader.svelte";
  import { pageHref, pagerLinks } from "$lib/pagination.ts";
  import type { PageData } from "./$types";

  const PAGE_SIZE = 30;
  const MAX_PAGE = 100;

  let { data }: { data: PageData } = $props();

  const pagination = $derived.by(() => {
    if (!data.profile || !data.portfolio) return undefined;
    const page = data.portfolio.page ?? data.requestedPage;
    const exhausted = data.portfolio.cursor === undefined;
    const paged = (page - 1) * PAGE_SIZE + data.portfolio.posts.length;
    const exact = data.portfolio.total ?? (exhausted ? paged : undefined);
    const total =
      exact ??
      (data.profile.postsCount === undefined
        ? undefined
        : Math.max(data.profile.postsCount, page * PAGE_SIZE + 1));
    const ceiling = MAX_PAGE * PAGE_SIZE;

    return pagerLinks({
      page,
      limit: PAGE_SIZE,
      total: total === undefined ? undefined : Math.min(total, ceiling),
      totalCapped: total !== undefined && (exact === undefined || total > ceiling),
      itemCount: data.portfolio.posts.length,
      href: (target) => pageHref(`/profile/${encodeURIComponent(data.handle)}`, target),
    });
  });
</script>

{#if data.errorMessage || !data.profile || !data.portfolio}
  <main class="gallery">
    <div class="wrap layout">
      <div class="feed">
        <FeedNotice>{data.errorMessage ?? "No such account on Bluesky."}</FeedNotice>
        <div class="flex gap-[8px]">
          <a href="/" class="btn btn--ghost">Back to Ratat</a>
          <a
            class="btn btn--ghost"
            href={`https://bsky.app/profile/${encodeURIComponent(data.handle)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Look on Bluesky
          </a>
        </div>
      </div>
    </div>
  </main>
{:else}
  <main class="gallery max-mobile:pt-0">
    <div class="wrap layout">
      <div class="feed">
        <ProfileHeader
          profile={data.profile}
          artCount={pagination?.total ?? data.portfolio.posts.length}
        />

        <div class="pt-[18px] pb-[40px] max-mobile:pt-[8px]">
          {#if data.portfolio.posts.length === 0}
            <FeedNotice>
              No artworks to show yet — this artist has posted nothing with media, or Ratat is still
              reading their work in.
            </FeedNotice>
          {:else if pagination}
            <div class="max-mobile:-mx-[var(--pad)]">
              <Pager variant="top" {pagination} />
              <ArtworkGrid posts={data.portfolio.posts} header="none" />
              <Pager variant="bottom" {pagination} />
            </div>
          {/if}
        </div>
      </div>
    </div>
  </main>
{/if}
