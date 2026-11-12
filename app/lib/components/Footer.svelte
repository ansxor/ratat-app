<script lang="ts">
  const LINKS = [
    "About",
    "Guidelines",
    "Licensing",
    "Contact",
    "Terms",
    "Privacy",
    "Content policy",
  ];
</script>

<footer class="border-t border-line py-[16px]">
  <div class="wrap flex items-center gap-[10px_22px] flex-wrap">
    <span class="brand__mark text-[20px]">
      R<b>a</b>tat
    </span>
    <nav
      class="flex flex-wrap gap-[6px_18px] [&_button]:text-mist [&_button]:text-[14px] [&_button:hover]:text-paper"
      aria-label="Footer"
    >
      {#each LINKS as label (label)}
        <button type="button">{label}</button>
      {/each}
    </nav>
    <span class="ml-auto font-mono text-[11px] tracking-[0.06em] text-faint">
      © 2026 answer
    </span>
  </div>
</footer>
