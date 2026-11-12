<script lang="ts">
  import FollowButton from "$lib/components/FollowButton.svelte";
  import Pager from "$lib/components/Pager.svelte";
  import type { PagerPagination } from "$lib/pagination.ts";
  import type { FollowActor } from "$lib/ratat.ts";

  let {
    actors,
    loading = false,
    pagination,
    infinite,
    anchorIndex,
    onAnchorMount,
  }: {
    actors: FollowActor[];
    loading?: boolean;
    pagination?: PagerPagination;
    infinite?: {
      enabled: boolean;
      hasNextPage: boolean;
      isLoading: boolean;
      error: unknown;
      onLoadMore: () => void;
    };
    anchorIndex?: number;
    onAnchorMount?: (el: HTMLDivElement | null) => void;
  } = $props();

  let sentinelEl = $state<HTMLDivElement | null>(null);
  let anchorEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    onAnchorMount?.(anchorEl);
  });

  $effect(() => {
    if (
      !infinite?.enabled ||
      !infinite.hasNextPage ||
      infinite.isLoading ||
      infinite.error ||
      !sentinelEl ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) infinite.onLoadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinelEl);
    return () => observer.disconnect();
  });
</script>

{#if loading && actors.length === 0}
  <p class="text-mist py-[24px]">Loading…</p>
{:else if actors.length === 0}
  <p class="text-mist py-[24px]">No accounts to show.</p>
{:else}
  <div class="border border-line bg-ink-raised max-mobile:-mx-[var(--pad)]">
    {#each actors as account, index (account.uri)}
      {@const name = account.displayName?.trim() || account.handle || account.subject}
      {@const handleOrDid = account.handle ?? account.subject}
      {@const profileHref = `/profile/${encodeURIComponent(handleOrDid)}`}
      {@const avatarBg = account.avatar ? `url(${account.avatar})` : "var(--fixed-avatar-placeholder)"}
      {#if anchorIndex === index}
        <div bind:this={anchorEl} class="h-0" aria-hidden="true"></div>
      {/if}
      <div class="flex items-center gap-[10px] px-[14px] py-[9px] max-mobile:py-[14px] border-b border-line-soft last:border-b-0">
        <a
          href={profileHref}
          class="size-[32px] flex-none bg-cover bg-center border border-line shadow-[inset_0_0_0_2px_var(--color-ink-raised)]"
          style:background-image={avatarBg}
          aria-label={name}
        ></a>
        <div class="min-w-0 flex-1">
          <a
            href={profileHref}
            class="block text-[13.5px] font-[700] leading-[1.25] truncate"
          >
            {name}
          </a>
          <span class="flex items-center gap-[4px] text-[11px] tracking-[0.02em] text-faint">
            <span class="truncate">@{handleOrDid}</span>
          </span>
        </div>
        <FollowButton
          subjectDid={account.subject}
          subjectHandle={handleOrDid}
          variant="compact"
          class="max-mobile:h-[36px] max-mobile:px-[12px] max-mobile:text-[13px] max-mobile:[&_svg]:size-[15px]"
        />
      </div>
    {/each}
  </div>

  {#if infinite?.enabled}
    <div
      bind:this={sentinelEl}
      class="flex min-h-[34px] items-center justify-center py-[12px] text-[12px] text-faint"
      aria-live="polite"
    >
      {#if infinite.isLoading}
        Loading…
      {:else if infinite.error}
        <button
          type="button"
          class="text-primary underline"
          onclick={() => infinite.onLoadMore()}
        >
          Couldn't load more — try again
        </button>
      {/if}
    </div>
  {:else if pagination}
    <Pager variant="standalone" {pagination} />
  {/if}
{/if}
