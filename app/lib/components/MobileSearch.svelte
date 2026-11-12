<script lang="ts">
  import Icons from "$lib/components/Icons.svelte";
  import SearchField from "$lib/components/SearchField.svelte";

  const BUTTON =
    "masthead-action size-full min-h-[52px] flex-1 inline-flex items-center justify-center cursor-pointer p-0 border-none bg-header-tint text-header-fg transition-colors duration-[140ms] hover:bg-header-tint-hi";

  let open = $state(false);
  let toggleEl = $state<HTMLButtonElement | null>(null);

  function dismiss(restoreFocus: boolean) {
    open = false;
    if (restoreFocus) toggleEl?.focus();
  }

  function handleFocusOut(event: FocusEvent & { currentTarget: HTMLDivElement }) {
    const related = event.relatedTarget as Node | null;
    if (!related || !event.currentTarget.contains(related)) {
      dismiss(false);
    }
  }
</script>

<div class="masthead-mobile-search hidden max-mobile:flex w-full h-full items-center">
  <button
    bind:this={toggleEl}
    type="button"
    aria-label="Search"
    title="Search"
    aria-expanded={open}
    class={BUTTON}
    onclick={() => (open = !open)}
  >
    <Icons name="search" size={22} strokeWidth={1.9} />
  </button>

  {#if open}
    <div
      class="masthead-mobile-search-panel absolute bottom-full left-0 right-0 z-10 flex min-h-[60px] items-center gap-[9px] bg-header px-[12px] py-[8px] shadow-[0_-8px_20px_-16px_var(--shadow-drop)]"
      onfocusout={handleFocusOut}
    >
      <SearchField
        class="masthead-mobile-search-field relative flex-1 min-w-0"
        autoFocus
        onDismiss={() => dismiss(true)}
      />
    </div>
  {/if}
</div>
