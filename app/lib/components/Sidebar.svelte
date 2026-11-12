<script lang="ts">
  import ArtworkCard from "$lib/components/ArtworkCard.svelte";
  import type { Post } from "$lib/ratat.ts";
  import { useVisible } from "$lib/settings.svelte.ts";

  let { moreBy }: { moreBy: Post[] } = $props();

  const visible = useVisible(() => moreBy);
</script>

{#if visible.items.length > 0}
  <aside
    class="w-[326px] flex-none max-mobile:-mx-[var(--pad)] max-mobile:w-[calc(100%+var(--pad)*2)] [&_section+section]:mt-[18px]"
  >
    <section>
      <div
        class="text-center font-[700] text-[13px] tracking-[0.01em] text-paper bg-ink-hi px-[8px] py-[7px] border border-line mb-[0.4rem]"
      >
        More by @{visible.items[0]?.author.handle}
      </div>
      <div class="grid grid-cols-2 gap-[0.4rem] max-mobile:gap-0">
        {#each visible.items as post (post.uri)}
          <ArtworkCard {post} aspect="1/1" header="none" />
        {/each}
      </div>
    </section>
  </aside>
{/if}
