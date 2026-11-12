<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/utils.ts";

  let {
    children,
    pulse = false,
  }: {
    children: Snippet;
    pulse?: boolean;
  } = $props();
</script>

<p class={cn("text-mist py-[24px] [&_a]:underline", pulse && "animate-pulse-soft")}>
  {@render children()}
</p>
