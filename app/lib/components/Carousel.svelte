<script lang="ts">
  import emblaCarouselSvelte from "embla-carousel-svelte";
  import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel";
  import type { Snippet } from "svelte";
  import Icons from "$lib/components/Icons.svelte";
  import { cn } from "$lib/utils";

  const carouselArrowClass = cn(
    "absolute top-1/2 z-[5] inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full",
    "border border-line bg-ink-raised text-paper transition-[background,border-color] duration-[140ms]",
    "hover:border-line-2 hover:bg-ink-hi disabled:cursor-default disabled:opacity-40",
    "disabled:hover:border-line disabled:hover:bg-ink-raised",
  );

  let {
    count,
    label = "Artwork media",
    opts = {},
    class: className = "",
    children,
  }: {
    count: number;
    label?: string;
    opts?: EmblaOptionsType;
    class?: string;
    children: Snippet;
  } = $props();

  let api = $state<EmblaCarouselType | undefined>(undefined);
  let emblaState = $state<{
    canScrollPrev: boolean;
    canScrollNext: boolean;
    current: number;
    snaps: number;
  } | null>(null);

  const canScrollPrev = $derived(emblaState?.canScrollPrev ?? false);
  const canScrollNext = $derived(emblaState ? emblaState.canScrollNext : count > 1);
  const current = $derived(emblaState?.current ?? 1);
  const total = $derived(emblaState && emblaState.snaps > 0 ? emblaState.snaps : count);

  function handleInit(event: CustomEvent<EmblaCarouselType>) {
    const embla = event.detail;
    api = embla;
    const sync = () => {
      emblaState = {
        canScrollPrev: embla.canScrollPrev(),
        canScrollNext: embla.canScrollNext(),
        current: embla.selectedScrollSnap() + 1,
        snaps: embla.scrollSnapList().length,
      };
    };
    sync();
    embla.on("reInit", sync);
    embla.on("select", sync);
  }

  function scrollPrev() {
    api?.scrollPrev();
  }

  function scrollNext() {
    api?.scrollNext();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollNext();
    }
  }
</script>

<div
  class={cn(
    "relative max-mobile:h-full max-mobile:[&_[data-slot=carousel-content]]:h-full max-mobile:[&_[data-slot=carousel-item]]:h-full",
    className,
  )}
  role="region"
  aria-roledescription="carousel"
  aria-label={label}
  data-slot="carousel"
  onkeydowncapture={handleKeyDown}
>
  <div
    class="overflow-hidden"
    data-slot="carousel-content"
    use:emblaCarouselSvelte={{
      options: {
        axis: "x",
        watchDrag: (_emblaApi, event) =>
          !(event.target as HTMLElement | null)?.closest?.("[data-embla-no-drag]"),
        ...opts,
      },
      plugins: [],
    }}
    onemblaInit={handleInit}
  >
    <div class="flex -ml-[0.4rem]">
      {@render children()}
    </div>
  </div>

  <button
    type="button"
    class={cn(carouselArrowClass, "!left-2")}
    disabled={!canScrollPrev}
    onclick={scrollPrev}
    data-slot="carousel-previous"
  >
    <Icons name="arrow-left" size={16} />
    <span class="sr-only">Previous slide</span>
  </button>

  <button
    type="button"
    class={cn(carouselArrowClass, "!right-2")}
    disabled={!canScrollNext}
    onclick={scrollNext}
    data-slot="carousel-next"
  >
    <Icons name="arrow-right" size={16} />
    <span class="sr-only">Next slide</span>
  </button>

  {#if total > 1}
    <div
      class="absolute bottom-[10px] right-[10px] z-[5] bg-scrim-chip px-[7px] py-[3px] font-[700] text-[11px] leading-[1.4] text-accent-ink tabular-nums"
      aria-hidden="true"
    >
      {current} / {total}
    </div>
  {/if}
</div>
