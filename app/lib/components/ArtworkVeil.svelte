<script module lang="ts">
  import { cn } from "$lib/utils";

  export type VeilStrength = "tile" | "page";

  export function veilFrameClass(
    veil: "black" | "blur" | null,
    { animated, strength = "tile" }: { animated: boolean; strength?: VeilStrength },
  ): string {
    return cn(
      animated &&
        "[&_img]:transition-[filter,scale] [&_img]:duration-[260ms] [&_img]:ease-out [&_video]:transition-[filter,scale] [&_video]:duration-[260ms] [&_video]:ease-out",
      veil === "blur" &&
        (strength === "page"
          ? "[&_img]:blur-[52px] [&_img]:scale-[1.2] [&_video]:blur-[52px] [&_video]:scale-[1.2]"
          : "[&_img]:blur-[14px] [&_img]:scale-[1.12] [&_video]:blur-[14px] [&_video]:scale-[1.12]"),
    );
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import Icons from "$lib/components/Icons.svelte";
  import { useContentVeil } from "$lib/settings.svelte";

  let {
    labels,
    children,
    variant,
    onReveal,
    animated,
    peeked,
    iconSize = 30,
    prominent = false,
    strength = "tile",
    label = "Uncensor filtered artwork",
    class: className = "",
  }: {
    labels?: readonly string[];
    children?: Snippet;
    variant?: "black" | "blur" | null;
    onReveal?: () => void;
    animated?: boolean;
    peeked?: boolean;
    iconSize?: number;
    prominent?: boolean;
    strength?: VeilStrength;
    label?: string;
    class?: string;
  } = $props();

  const contentVeil = useContentVeil(() => labels);

  const effectiveVariant = $derived(variant !== undefined ? variant : contentVeil.veil);
  const effectivePeeked = $derived(peeked !== undefined ? peeked : contentVeil.peeked);
  const effectiveAnimated = $derived(animated !== undefined ? animated : contentVeil.animated);
  const covered = $derived(effectiveVariant !== null && !effectivePeeked);

  function handleClick(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    event.preventDefault();
    if (onReveal) onReveal();
    else contentVeil.reveal();
    if (event.detail > 0) event.currentTarget.blur();
  }
</script>

{#snippet veilButton(activeVariant: "black" | "blur")}
  <button
    type="button"
    aria-label={label}
    tabIndex={effectivePeeked ? -1 : undefined}
    onclick={handleClick}
    class={cn(
      "group absolute inset-0 z-[3] flex flex-col items-center justify-center gap-[9px]",
      "w-full cursor-pointer border-none p-0",
      effectiveAnimated && "transition-opacity duration-[260ms] ease-out",
      effectivePeeked && "opacity-0 pointer-events-none",
      activeVariant === "black"
        ? "bg-scrim-solid text-scrim-solid-fg"
        : "bg-transparent text-scrim-text",
    )}
  >
    <Icons name="eye-off" size={iconSize} strokeWidth={1.7} />
    <span
      class={cn(
        "max-w-full truncate leading-[1.5] font-[600]",
        prominent
          ? "bg-primary text-accent-ink text-[13px] tracking-[0.01em] px-[13px] py-[6px]"
          : cn(
              "bg-scrim-chip text-accent-ink text-[10.5px] tracking-[0.02em] px-[6px] py-[2px]",
              "opacity-0 transition-opacity duration-[140ms]",
              "group-hover:opacity-100 group-focus-visible:opacity-100",
            ),
      )}
    >
      Click to uncensor
    </span>
  </button>
{/snippet}

{#if children}
  <div
    class={cn(
      "relative overflow-hidden",
      veilFrameClass(covered ? effectiveVariant : null, { animated: effectiveAnimated, strength }),
      className,
    )}
  >
    {@render children()}
    {#if effectiveVariant}
      {@render veilButton(effectiveVariant)}
    {/if}
  </div>
{:else if effectiveVariant}
  {@render veilButton(effectiveVariant)}
{/if}
