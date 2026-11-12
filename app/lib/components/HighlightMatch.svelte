<script lang="ts">
  let {
    text,
    match,
  }: {
    text: string;
    match: string;
  } = $props();

  const needle = $derived(match.trim());
  const at = $derived(needle.length > 0 ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1);
</script>

{#if at < 0}
  {text}
{:else}
  {text.slice(0, at)}<mark>{text.slice(at, at + needle.length)}</mark>{text.slice(at + needle.length)}
{/if}
