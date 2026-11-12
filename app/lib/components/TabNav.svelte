<script module lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "$lib/components/Icons.svelte";

  export interface TabNavItem {
    key: string;
    href: string;
    label: string;
    iconName?: IconName;
    icon?: Snippet;
  }
</script>

<script lang="ts">
  import Icons from "$lib/components/Icons.svelte";
  import { cn } from "$lib/utils.ts";

  let {
    items,
    activeKey,
    ariaLabel,
  }: {
    items: readonly TabNavItem[];
    activeKey: string;
    ariaLabel: string;
  } = $props();
</script>

<nav
  class="flex gap-[2px] mt-[22px] border-b border-line overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
  aria-label={ariaLabel}
>
  {#each items as item (item.key)}
    {@const active = item.key === activeKey}
    <a
      href={item.href}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      class={cn(
        "inline-flex items-center whitespace-nowrap no-underline cursor-pointer",
        "font-body text-[14px] border-b-[3px] border-b-transparent -mb-px",
        active
          ? "gap-[7px] px-[14px] py-[9px] font-[700] text-primary border-b-primary"
          : "gap-0 px-[12px] py-[9px] font-[600] text-paper hover:text-primary",
      )}
    >
      <span class="inline-flex flex-none [&_svg]:size-[15px]">
        {#if item.icon}
          {@render item.icon()}
        {:else if item.iconName}
          <Icons name={item.iconName} size={15} />
        {/if}
      </span>
      {#if active}
        <span>{item.label}</span>
      {/if}
    </a>
  {/each}
</nav>
