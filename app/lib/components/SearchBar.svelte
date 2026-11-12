<script lang="ts">
  import MobileSearch from "$lib/components/MobileSearch.svelte";
  import SearchField from "$lib/components/SearchField.svelte";

  let {
    mobile = false,
  }: {
    mobile?: boolean;
  } = $props();
</script>

{#if mobile}
  <MobileSearch />
{:else}
  <SearchField
    class="relative shrink-0 w-[340px] transition-[width] duration-[320ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] focus-within:w-[460px] motion-reduce:transition-none max-mobile:w-full max-mobile:min-w-0 max-mobile:focus-within:w-full"
  />
{/if}
