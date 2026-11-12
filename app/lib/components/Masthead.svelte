<script lang="ts">
  import { page } from "$app/state";
  import AuthControl from "$lib/components/AuthControl.svelte";
  import BrandMark from "$lib/components/BrandMark.svelte";
  import Icons from "$lib/components/Icons.svelte";
  import QuickSettingsMenu from "$lib/components/QuickSettingsMenu.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import type { Viewer } from "$lib/ratat.ts";
  import { cn } from "$lib/utils.ts";

  const HEADER = "z-50 bg-header border-header-edge box-border max-w-[100vw]";
  const DESKTOP_ROW = "masthead-row wrap flex items-center gap-[18px] h-[42px]";
  const MOBILE_ROW =
    "masthead-row wrap grid grid-cols-4 gap-1 h-[64px] p-[4px_8px] max-mobile:static";
  const NAV_LINK =
    "text-[13.5px] font-[500] px-[7px] py-[5px] rounded-[6px] transition-[color,background] duration-[180ms] text-header-fg-dim hover:text-header-fg hover:bg-header-tint";
  const NAV_LINK_ACTIVE = "text-header-fg bg-header-tint";

  let { viewer = null }: { viewer?: Viewer | null } = $props();

  const home = $derived(page.url.pathname === "/");
</script>

{#snippet mastheadBar(mobile: boolean)}
  {@const row = mobile ? MOBILE_ROW : DESKTOP_ROW}
  {@const header = mobile
    ? "masthead masthead--mobile hidden max-mobile:block relative order-2 flex-none w-full border-t-2"
    : "masthead masthead--desktop sticky top-0 border-b-2 max-mobile:hidden"}

  <header class={`${header} ${HEADER}`} aria-label={mobile ? "Mobile navigation" : undefined}>
    <div class={row}>
      {#if mobile}
        <a
          class="brand masthead-action min-w-0 w-full h-full min-h-[52px] inline-flex items-center justify-center bg-header-tint hover:bg-header-tint-hi"
          href="/"
          aria-label="Ratat home"
        >
          <BrandMark class="text-header-fg" compact />
        </a>
      {:else}
        <div class="masthead-leading flex flex-1 basis-0 items-center gap-[18px] min-w-0">
          <a class="brand" href="/" aria-label="Ratat home">
            <BrandMark class="text-header-fg" compact />
          </a>
          <nav class="flex gap-4 ml-[8px] items-center max-mobile:hidden" aria-label="Primary">
            <a
              class={cn("flex gap-2", NAV_LINK, home && NAV_LINK_ACTIVE)}
              href="/"
              aria-current={home ? "page" : undefined}
            >
              <Icons name="home" size={20} class="size-5" /> Home
            </a>
          </nav>
        </div>
      {/if}

      <div
        class={`masthead-search-slot flex items-center gap-[9px] ${mobile ? "min-w-0 w-full h-full" : ""}`}
      >
        <SearchBar {mobile} />
      </div>

      <div
        class={`masthead-actions items-center justify-end gap-[9px] ${mobile ? "contents" : "flex flex-1 basis-0"}`}
      >
        <QuickSettingsMenu />
        <AuthControl {viewer} />
      </div>
    </div>
  </header>
{/snippet}

{@render mastheadBar(false)}
{@render mastheadBar(true)}
