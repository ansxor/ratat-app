<script lang="ts">
  import { untrack } from "svelte";

  import FollowList from "$lib/components/FollowList.svelte";
  import ProfileHeader from "$lib/components/ProfileHeader.svelte";
  import {
    FOLLOW_LIST_PAGE_SIZE,
    type FollowListKind,
    type FollowListPageData,
  } from "$lib/follow-list-page.ts";
  import { pageHref, pagerLinks } from "$lib/pagination.ts";
  import { getFollowList, type FollowListResult } from "$lib/ratat.ts";

  let { kind, data }: { kind: FollowListKind; data: FollowListPageData } = $props();

  let isMobile = $state(false);
  let anchorEl = $state<HTMLDivElement | null>(null);
  let previousMobile = false;
  let pendingScroll = false;

  let pages = $state<FollowListResult[]>([]);
  let loadedKey = $state("");
  let isLoadingMore = $state(false);
  let loadMoreError = $state<unknown>(null);
  let requestId = 0;

  const currentKey = $derived(
    data.profile && data.list ? `${data.profile.did}:${kind}:${data.list.page ?? data.requestedPage}` : "",
  );

  $effect(() => {
    const key = currentKey;
    const initial = data.list;
    untrack(() => {
      if (key && initial && loadedKey !== key) {
        requestId += 1;
        loadedKey = key;
        pages = [initial];
        isLoadingMore = false;
        loadMoreError = null;
      }
    });
  });

  $effect(() => {
    const breakpoint =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--breakpoint-mobile")
        .trim() || "880px";
    const query = window.matchMedia(`(max-width: ${breakpoint})`);
    const update = () => {
      isMobile = query.matches;
      if (previousMobile !== query.matches) {
        previousMobile = query.matches;
        pendingScroll = true;
      }
    };
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  });

  $effect(() => {
    if (!pendingScroll || !anchorEl) return;
    pendingScroll = false;
    const el = anchorEl;
    const frame = requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  });

  const activePages = $derived(
    loadedKey === currentKey && pages.length > 0 ? pages : data.list ? [data.list] : [],
  );
  const lastPage = $derived(activePages[activePages.length - 1] ?? data.list);
  const lastPageStart = $derived(
    activePages.slice(0, -1).reduce((count, p) => count + p.actors.length, 0),
  );
  const items = $derived(activePages.flatMap((p) => p.actors));
  const hasNextPage = $derived.by(() => {
    if (!isMobile || !lastPage) return false;
    return lastPage.total === undefined
      ? lastPage.actors.length >= FOLLOW_LIST_PAGE_SIZE
      : (lastPage.page ?? 1) * FOLLOW_LIST_PAGE_SIZE < lastPage.total;
  });

  const pagination = $derived.by(() => {
    if (!lastPage) return undefined;
    const page = lastPage.page ?? data.requestedPage;
    return pagerLinks({
      page,
      limit: FOLLOW_LIST_PAGE_SIZE,
      total: lastPage.total,
      itemCount: lastPage.actors.length,
      href: (target) => pageHref(`/profile/${encodeURIComponent(data.handle)}/${kind}`, target),
    });
  });

  async function loadMore() {
    if (!isMobile || !hasNextPage || isLoadingMore || !data.profile || !lastPage) return;
    const req = ++requestId;
    const key = currentKey;
    const nextPage = (lastPage.page ?? 1) + 1;
    isLoadingMore = true;
    loadMoreError = null;
    try {
      const next = await getFollowList(kind, data.profile.did, {
        page: nextPage,
        limit: FOLLOW_LIST_PAGE_SIZE,
      });
      if (req !== requestId || loadedKey !== key) return;
      pages = [...activePages, next];
    } catch (cause) {
      if (req === requestId) loadMoreError = cause;
    } finally {
      if (req === requestId) isLoadingMore = false;
    }
  }
</script>

{#if data.errorMessage || !data.profile || !data.list}
  <main class="gallery">
    <div class="wrap layout">
      <div class="feed">
        <p class="text-mist py-[24px]">{data.errorMessage ?? "No such account on Bluesky."}</p>
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
          artCount={data.profile.postsCount ?? 0}
          section={kind}
        />
        <div class="pt-[18px] pb-[40px]">
          <FollowList
            actors={items}
            {pagination}
            infinite={{
              enabled: isMobile,
              hasNextPage,
              isLoading: isLoadingMore,
              error: loadMoreError,
              onLoadMore: () => void loadMore(),
            }}
            anchorIndex={lastPageStart}
            onAnchorMount={(el) => {
              anchorEl = el;
            }}
          />
        </div>
      </div>
    </div>
  </main>
{/if}
