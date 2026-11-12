<script lang="ts">
  import { page } from "$app/state";
  import Icons from "$lib/components/Icons.svelte";
  import { followsStore } from "$lib/follows.svelte";
  import type { Viewer } from "$lib/ratat";
  import { cn } from "$lib/utils";

  const COMPACT =
    "inline-flex items-center justify-center gap-[5px] h-[27px] box-border px-[9px] text-[12px] font-[700] bg-ink-raised border border-line-2 text-paper cursor-pointer whitespace-nowrap align-middle transition-[background,border-color] duration-[180ms] hover:not-disabled:bg-ink-hi hover:not-disabled:border-up [&_svg]:size-[13px] disabled:opacity-[0.55] disabled:cursor-not-allowed";

  let {
    subjectDid,
    subjectHandle = "",
    viewerFollowUri,
    variant = "default",
    class: className = "",
  }: {
    subjectDid: string;
    subjectHandle?: string;
    viewerFollowUri?: string;
    variant?: "default" | "compact";
    class?: string;
  } = $props();

  const viewer = $derived((page.data?.viewer ?? null) as Viewer | null);

  let pending = $state(false);

  $effect(() => {
    followsStore.sync(viewer?.did);
  });

  $effect(() => {
    if (viewerFollowUri) {
      followsStore.seed(subjectDid, viewerFollowUri);
    }
  });

  const visible = $derived(
    Boolean(viewer && viewer.did !== subjectDid && (followsStore.loaded || viewerFollowUri !== undefined)),
  );
  const following = $derived(followsStore.isFollowing(subjectDid));

  async function toggle() {
    if (!viewer || pending) return;
    pending = true;
    try {
      await followsStore.toggle(viewer.did, subjectDid);
    } finally {
      pending = false;
    }
  }
</script>

{#if visible}
  {#if variant === "compact"}
    {#if following}
      <button
        type="button"
        class={cn(COMPACT, "px-[8px] text-up", className)}
        title={subjectHandle ? `Following @${subjectHandle} — click to unfollow` : "Following — click to unfollow"}
        aria-label="Following"
        onclick={toggle}
        disabled={pending}
      >
        <Icons name="check" size={13} />
      </button>
    {:else}
      <button
        type="button"
        class={cn(COMPACT, className)}
        onclick={toggle}
        disabled={pending}
      >
        <Icons name="plus" size={13} />
        <span>Follow</span>
      </button>
    {/if}
  {:else if following}
    <button
      type="button"
      class={cn("btn btn--ghost", "[&_svg]:size-[14px] text-mist", className)}
      title="Unfollow"
      aria-label="Unfollow"
      onclick={toggle}
      disabled={pending}
    >
      <Icons name="check" size={14} />
      <span class="max-mobile:hidden">Following</span>
    </button>
  {:else}
    <button
      type="button"
      class={cn("btn btn--accent", "[&_svg]:size-[14px]", className)}
      aria-label="Follow"
      onclick={toggle}
      disabled={pending}
    >
      <Icons name="plus" size={14} />
      <span class="max-mobile:hidden">Follow</span>
    </button>
  {/if}
{/if}
