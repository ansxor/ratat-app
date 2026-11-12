<script lang="ts">
  import "../app.css";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import Footer from "$lib/components/Footer.svelte";
  import Masthead from "$lib/components/Masthead.svelte";
  import Toaster from "$lib/components/Toaster.svelte";
  import { applyThemeEffect, hydrateSettings } from "$lib/settings.svelte";

  let { data, children } = $props();
  let contentEl = $state<HTMLDivElement | null>(null);

  afterNavigate(({ type }) => {
    if (type !== "popstate" && contentEl) {
      contentEl.scrollTop = 0;
    }
  });

  $effect(() => {
    hydrateSettings();
    applyThemeEffect();
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      (globalThis as unknown as { __hatk_viewer?: unknown }).__hatk_viewer =
        data.viewer ?? null;
    }
  });

  const showFooter = $derived(
    page.url.pathname !== "/login" &&
      page.url.pathname !== "/onboarding" &&
      !(page.url.pathname === "/" && !data.viewer),
  );
</script>

<div class="app-shell flex flex-col h-dvh overflow-hidden">
  <Masthead viewer={data.viewer} />
  <div
    bind:this={contentEl}
    class="app-content flex-auto min-h-0 overflow-auto overflow-x-hidden max-mobile:order-1"
  >
    {@render children()}
    {#if showFooter}
      <Footer />
    {/if}
  </div>
</div>

<Toaster />
