<script lang="ts">
  import Icons from "$lib/components/Icons.svelte";
  import { categoriesOf, CATEGORY_META } from "$lib/content-filter";

  let {
    handle,
    labels,
    onReveal,
  }: {
    handle: string;
    labels: readonly string[] | undefined;
    onReveal: () => void;
  } = $props();

  const subject = $derived.by(() => {
    const categories = categoriesOf(labels);
    const named = categories.map((category) => CATEGORY_META[category].label.toLowerCase());
    return named.length > 0 ? named.join(" and ") : "this content";
  });
</script>

<main class="gallery">
  <div class="wrap layout">
    <div class="feed">
      <div
        class="relative h-[calc(100vh-260px)] bg-ink-raised border border-line p-[16px] flex flex-col items-center justify-center text-center gap-[10px]"
      >
        <span class="text-faint [&_svg]:size-[40px]" aria-hidden="true">
          <Icons name="eye-off" size={40} strokeWidth={1.5} />
        </span>
        <h1 class="m-0 text-[20px] font-[600] tracking-[-0.01em] text-paper">Filtered</h1>
        <p class="m-0 text-[13.5px] text-mist max-w-[42ch]">
          You've set {subject} to be hidden. This piece is by
          <a class="underline" href={`/profile/${encodeURIComponent(handle)}`}>@{handle}</a>.
        </p>
        <button type="button" class="btn btn--accent mt-[4px]" onclick={onReveal}>Reveal</button>
        <p class="m-0 text-[11.5px] text-faint">Change this in Quick settings.</p>
      </div>
    </div>
  </div>
</main>
