<script lang="ts">
  import { page } from "$app/state";
  import Icons from "$lib/components/Icons.svelte";
  import { LikeToggle } from "$lib/likes.svelte";
  import type { Viewer } from "$lib/ratat";
  import { cn } from "$lib/utils";

  const DETAIL_CLASS =
    "inline-flex items-center gap-[6px] text-[13px] font-[700] px-[12px] py-[7px] bg-ink-raised border text-paper transition-[background,border-color] duration-[140ms] hover:bg-ink-hi [&_svg]:size-[15px] [&_svg]:text-gold hover:border-gold disabled:cursor-default disabled:opacity-60 disabled:hover:bg-ink-raised disabled:hover:border-line max-mobile:gap-[8px] max-mobile:text-[16px] max-mobile:px-[16px] max-mobile:py-[8px] max-mobile:[&_svg]:size-[19px]";

  let {
    postUri,
    postCid,
    likeCount = 0,
    viewerLikeUri,
    size = "sm",
    variant,
  }: {
    postUri: string;
    postCid: string;
    likeCount?: number;
    viewerLikeUri?: string;
    size?: "sm" | "md";
    variant?: "card" | "detail";
  } = $props();

  const viewer = $derived((page.data?.viewer ?? null) as Viewer | null);
  const effectiveVariant = $derived(variant ?? (size === "md" ? "detail" : "card"));

  const like = new LikeToggle(() => ({
    uri: postUri,
    cid: postCid,
    count: likeCount,
    viewerLike: viewerLikeUri,
  }));

  const title = $derived(
    !viewer ? "Sign in to favourite" : like.active ? "Remove favourite" : "Favourite",
  );
</script>

<div class="relative inline-flex">
  <button
    type="button"
    class={effectiveVariant === "detail"
      ? cn(DETAIL_CLASS, like.active ? "border-gold bg-ink-hi [&_svg]:fill-gold" : "border-line")
      : cn("act act--star", like.active && "act--active")}
    {title}
    disabled={like.pending || !viewer}
    onclick={() => like.toggle(viewer?.did)}
  >
    {#key like.animationKey}
      <Icons
        name="star"
        size={effectiveVariant === "detail" ? 15 : 17}
        class={like.starAnimation ? `star-${like.starAnimation}` : ""}
      />
    {/key}
    <span>{like.count}</span>
  </button>
</div>
