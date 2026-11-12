<script lang="ts">
  import { goto } from "$app/navigation";
  import LoginPanel from "$lib/components/LoginPanel.svelte";

  let { data } = $props();

  $effect(() => {
    if (data.viewer) {
      void goto("/", { replaceState: true });
    }
  });
</script>

{#if !data.viewer}
  <LoginPanel />
{/if}
