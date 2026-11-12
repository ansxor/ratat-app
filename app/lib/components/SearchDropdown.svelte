<script module lang="ts">
  import type { ProfileBasic } from "$lib/ratat";

  export type SearchRow = { kind: "handle" } | { kind: "actor"; actor: ProfileBasic };
</script>

<script lang="ts">
  import { imageBackground } from "$lib/artwork-media";
  import Icons from "$lib/components/Icons.svelte";
  import HighlightMatch from "$lib/components/HighlightMatch.svelte";
  import { cn } from "$lib/utils";

  let {
    id,
    rows,
    activeIndex,
    term,
    loading,
    onActivate,
    onHover,
  }: {
    id: string;
    rows: readonly SearchRow[];
    activeIndex: number;
    term: string;
    loading: boolean;
    onActivate: (index: number) => void;
    onHover: (index: number) => void;
  } = $props();

  const subject = $derived(term.trim().replace(/^@/, ""));
  const suggestions = $derived(rows.length - 1);

  const rowId = (index: number) => `${id}-row-${index}`;
</script>

<div
  class="absolute top-[calc(100%+6px)] left-0 right-0 z-70 bg-ink-raised border border-line shadow-[0_18px_36px_-18px_var(--shadow-drop)] text-paper overflow-hidden"
>
  <div
    class="max-h-[62vh] overflow-y-auto"
    {id}
    role="listbox"
    aria-label="Artist suggestions"
  >
    {#each rows as row, index (row.kind === "handle" ? "handle" : row.actor.did)}
      {@const active = index === activeIndex}
      <div role="presentation">
        {#if index === 1}
          <p class="py-[9px] px-3 pb-1 text-eyebrow tracking-eyebrow uppercase text-faint">
            Artists
          </p>
        {/if}
        <div
          id={rowId(index)}
          role="option"
          aria-selected={active}
          tabindex="-1"
          class={cn(
            "flex items-center gap-[9px] py-[7px] px-3 min-w-0 cursor-pointer",
            active && "bg-ink-hi",
          )}
          onmousedown={(event) => event.preventDefault()}
          onmouseenter={() => onHover(index)}
          onclick={() => onActivate(index)}
          onkeydown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onActivate(index);
            }
          }}
        >
          {#if row.kind === "handle"}
            <Icons name="search" size={16} class="w-4 h-4 flex-none text-mist" />
            <span class="block min-w-0 flex-1 text-[13px] [&_b]:font-bold">
              Go to <b>@{subject || "an artist"}</b>
            </span>
            <span
              class="flex-none text-[10.5px] font-bold py-[2px] px-[6px] whitespace-nowrap text-mist border border-line"
            >
              ↵ Enter
            </span>
          {:else}
            <span
              class="w-7 h-7 flex-none bg-cover bg-center border border-line-soft"
              style={imageBackground(row.actor.avatar, "var(--fixed-avatar-placeholder)")}
              aria-hidden="true"
            ></span>
            <span
              class="flex flex-col gap-[1px] min-w-0 flex-1 text-[13px] [&_mark]:bg-transparent [&_mark]:text-primary [&_mark]:font-[800]"
            >
              <span class="truncate font-semibold">
                {row.actor.displayName ?? row.actor.handle}
              </span>
              <span class="text-[11.5px] text-faint truncate">
                @<HighlightMatch text={row.actor.handle} match={subject} />
              </span>
            </span>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  {#if suggestions === 0}
    <p
      class="py-[9px] px-3 text-[11.5px] text-faint border-t border-line-soft [&_b]:text-mist [&_b]:font-bold"
    >
      {#if loading}
        Looking…
      {:else}
        No artists match. Press <b>Enter</b> to go to the handle as typed.
      {/if}
    </p>
  {/if}
</div>
