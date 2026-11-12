<script lang="ts">
  import Icons from "$lib/components/Icons.svelte";
  import { cn } from "$lib/utils";

  let {
    description,
    text,
    id = "expandable-text",
    class: className = "",
    collapsedClass = "",
    collapsedClassName = "",
  }: {
    description?: string;
    text?: string;
    id?: string;
    class?: string;
    collapsedClass?: string;
    collapsedClassName?: string;
  } = $props();

  const content = $derived(description ?? text ?? "");
  const collapsed = $derived(collapsedClass || collapsedClassName);

  let textEl = $state<HTMLParagraphElement | null>(null);
  let expanded = $state(false);
  let canExpand = $state(false);

  $effect(() => {
    void content;
    expanded = false;
    canExpand = false;
  });

  $effect(() => {
    const el = textEl;
    if (!el || expanded) return;
    const checkOverflow = () => {
      canExpand = el.scrollHeight > el.clientHeight + 1;
    };
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  });
</script>

<p bind:this={textEl} {id} class={cn(className, !expanded && collapsed)}>
  {content}
</p>
{#if canExpand}
  <button
    type="button"
    aria-expanded={expanded}
    aria-controls={id}
    class="mt-[3px] inline-flex cursor-pointer items-center gap-[2px] border-0 bg-transparent p-0 text-faint text-[12px] font-bold underline hover:text-paper"
    onclick={() => (expanded = !expanded)}
  >
    <Icons name={expanded ? "chevron-up" : "chevron-down"} size={12} class="size-[12px]" />
    {expanded ? "Show less" : "Show more"}
  </button>
{/if}
