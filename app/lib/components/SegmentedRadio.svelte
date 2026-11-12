<script module lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "$lib/components/Icons.svelte";

  export interface SegmentedOption<T extends string> {
    value: T;
    iconName?: IconName;
    iconFill?: string;
    icon?: Snippet;
    label: string;
    hint?: string;
  }
</script>

<script lang="ts" generics="T extends string">
  import Icons from "$lib/components/Icons.svelte";
  import { cn } from "$lib/utils.ts";

  let {
    value,
    options,
    onValueChange,
    disabled = false,
    class: className,
    ariaLabel,
  }: {
    value: T;
    options: readonly SegmentedOption<T>[];
    onValueChange: (next: T) => void;
    disabled?: boolean;
    class?: string;
    ariaLabel: string;
  } = $props();

  const COLUMNS: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  const name = $props.id();
</script>

<div
  role="radiogroup"
  aria-label={ariaLabel}
  class={cn(
    "grid gap-px mt-[7px] bg-line-2 border border-line-2",
    COLUMNS[options.length],
    className,
  )}
>
  {#each options as option (option.value)}
    <label
      title={option.hint ? `${option.label} · ${option.hint}` : option.label}
      class={cn(
        "h-[27px] max-mobile:h-[44px] inline-flex items-center justify-center cursor-pointer p-0",
        "bg-ink-raised text-mist transition-colors duration-[140ms] hover:bg-ink",
        "[&_svg]:size-[15px]",
        value === option.value &&
          "bg-invert-bg text-invert-fg hover:bg-invert-bg [&_svg]:text-accent",
        disabled && "opacity-[0.6] cursor-default",
      )}
    >
      <input
        type="radio"
        {name}
        class="sr-only"
        value={option.value}
        checked={value === option.value}
        {disabled}
        aria-label={option.label}
        onchange={() => onValueChange(option.value)}
      />
      {#if option.icon}
        {@render option.icon()}
      {:else if option.iconName}
        <Icons name={option.iconName} size={15} fill={option.iconFill ?? "none"} />
      {/if}
    </label>
  {/each}
</div>
