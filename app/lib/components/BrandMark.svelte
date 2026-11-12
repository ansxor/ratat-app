<script lang="ts">
  import { cn } from "$lib/utils.ts";

  let {
    class: className,
    compact = false,
  }: {
    class?: string;
    compact?: boolean;
  } = $props();
</script>

<span class={cn("brand__mark", className)}>
  ᓚᘏᕐᐷ<span class={cn(compact && "max-mobile:hidden")}>{" Ratat"}</span>
</span>
