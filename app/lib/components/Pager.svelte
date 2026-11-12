<script lang="ts">
  import type { Snippet } from "svelte";

  import {
    mobileSlots,
    type PagerPagination,
    type PagerSlot,
  } from "$lib/pagination.ts";
  import { cn } from "$lib/utils.ts";

  let {
    variant = "top",
    leading,
    pagination,
    visualOnly = false,
  }: {
    variant?: "top" | "bottom" | "standalone";
    leading?: Snippet;
    pagination?: PagerPagination;
    visualOnly?: boolean;
  } = $props();

  let isMobile = $state(false);

  $effect(() => {
    const breakpoint =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--breakpoint-mobile")
        .trim() || "880px";
    const query = window.matchMedia(`(max-width: ${breakpoint})`);
    const update = () => {
      isMobile = query.matches;
    };
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  });

  const displayedSlots = $derived<Array<PagerSlot | "gap"> | undefined>(
    pagination && isMobile ? mobileSlots(pagination) : pagination?.slots,
  );

  function pageLink(
    variants: { current?: boolean; step?: boolean; disabled?: boolean } = {},
  ): string {
    return cn(
      "text-[15px] font-[600] text-mist px-[8px] py-[3px] whitespace-nowrap transition-[color,background] duration-[140ms] hover:text-paper hover:bg-ink-hi max-mobile:inline-flex max-mobile:min-h-[44px] max-mobile:min-w-[44px] max-mobile:items-center max-mobile:justify-center max-mobile:px-[10px]",
      variants.current &&
        "bg-primary !text-[var(--fixed-pager-active-ink)] hover:bg-primary hover:!text-[var(--fixed-pager-active-ink)]",
      variants.step && "text-primary hover:!text-[var(--fixed-pager-active-ink)] hover:bg-primary",
      variants.disabled && "text-faint cursor-not-allowed hover:text-faint hover:bg-transparent",
    );
  }
</script>

<div
  class={cn(
    "flex items-center gap-[8px]",
    variant !== "standalone" &&
      "bg-[color-mix(in_srgb,var(--color-ink-raised)_92%,transparent)] border border-line px-[10px] py-[4px] mb-[0.4rem] max-mobile:mb-0",
    variant === "top" && "max-mobile:hidden",
    variant === "bottom" && "mt-[0.4rem] mb-0 max-mobile:mt-0",
    variant === "standalone" && "justify-center mt-[1.5rem]",
  )}
>
  {#if leading}
    {@render leading()}
  {/if}
  {#if pagination && (pagination.slots.length > 1 || pagination.nextHref)}
    <nav
      class={cn(
        "flex min-w-0 items-center gap-[3px] max-mobile:w-full max-mobile:justify-between",
        variant !== "standalone" && "ml-auto",
      )}
      aria-label="Pagination"
    >
      {#if pagination.prevHref}
        {#if visualOnly}
          <span class={pageLink({ step: true })}>
            ‹ <span class="max-mobile:hidden">Prev</span>
          </span>
        {:else}
          <a class={pageLink({ step: true })} href={pagination.prevHref}>
            ‹ <span class="max-mobile:hidden">Prev</span>
          </a>
        {/if}
      {:else}
        <span
          class={cn(pageLink({ disabled: true }), "hidden max-mobile:inline-flex")}
          aria-disabled="true"
        >
          ‹
        </span>
      {/if}

      <div class="min-w-0 flex-1 overflow-hidden">
        <div class="flex min-w-0 items-center justify-center gap-[3px]">
          {#each displayedSlots ?? [] as slot, index (slot === "gap" ? `gap-${index}` : slot.page)}
            <div class="flex-none">
              {#if slot === "gap"}
                <span class="text-faint text-[11px] px-0" aria-hidden="true">…</span>
              {:else if slot.page === pagination.current}
                <span class={pageLink({ current: true })} aria-current="page">
                  {slot.page}
                </span>
              {:else if visualOnly}
                <span class={pageLink()}>{slot.page}</span>
              {:else}
                <a class={pageLink()} href={slot.href}>{slot.page}</a>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      {#if pagination.nextHref}
        {#if visualOnly}
          <span class={pageLink({ step: true })}>
            <span class="max-mobile:hidden">Next</span> ›
          </span>
        {:else}
          <a class={pageLink({ step: true })} href={pagination.nextHref}>
            <span class="max-mobile:hidden">Next</span> ›
          </a>
        {/if}
      {:else}
        <span class={pageLink({ disabled: true })} aria-disabled="true">
          <span class="max-mobile:hidden">Next</span> ›
        </span>
      {/if}
    </nav>
  {/if}
</div>
