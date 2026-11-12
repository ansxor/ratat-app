<script lang="ts">
  import { goto } from "$app/navigation";
  import Icons from "$lib/components/Icons.svelte";
  import SearchDropdown, { type SearchRow } from "$lib/components/SearchDropdown.svelte";
  import { type ProfileBasic, searchActorsTypeahead } from "$lib/ratat";
  import { cn } from "$lib/utils";

  const SUGGESTION_LIMIT = 8;
  const TYPEAHEAD_DEBOUNCE_MS = 150;

  const needleOf = (typed: string): string => typed.trim().replace(/^@/, "");

  let {
    class: className = "",
    openClassName = "",
    autoFocus = false,
    onDismiss,
  }: {
    class?: string;
    openClassName?: string;
    autoFocus?: boolean;
    onDismiss?: () => void;
  } = $props();

  const uid = $props.id();
  const listboxId = `search-listbox-${uid}`;

  let input = $state("");
  let settled = $state("");
  let open = $state(false);
  let activeIndex = $state(0);
  let actors = $state<ProfileBasic[]>([]);
  let loading = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);

  const needle = $derived(needleOf(settled));

  const rows = $derived<SearchRow[]>([
    { kind: "handle" },
    ...actors.map((actor): SearchRow => ({ kind: "actor", actor })),
  ]);

  $effect(() => {
    const trimmed = input.trim();
    const timer = setTimeout(() => {
      settled = trimmed;
    }, TYPEAHEAD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    if (autoFocus) {
      inputEl?.focus();
    }
  });

  $effect(() => {
    const q = needle;
    const isOpen = open;
    if (!isOpen || q.length === 0) {
      actors = [];
      loading = false;
      return;
    }

    const controller = new AbortController();
    loading = true;
    searchActorsTypeahead(q, { limit: SUGGESTION_LIMIT, signal: controller.signal })
      .then((found) => {
        if (controller.signal.aborted) return;
        actors = found;
        loading = false;
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          actors = [];
          loading = false;
        }
      });

    return () => controller.abort();
  });

  function close() {
    open = false;
    activeIndex = 0;
  }

  function go(handle: string) {
    if (!handle) return;
    close();
    input = "";
    settled = "";
    inputEl?.blur();
    onDismiss?.();
    void goto(`/profile/${encodeURIComponent(handle)}`);
  }

  function activate(index: number) {
    const row = rows[index];
    if (!row || row.kind === "handle") {
      go(needleOf(input));
      return;
    }
    go(row.actor.handle);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      activate(activeIndex);
      return;
    }
    if (event.key === "Escape") {
      if (open) close();
      else onDismiss?.();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      activeIndex = (activeIndex + delta + rows.length) % rows.length;
      open = true;
    }
  }

  function handleFocusOut(event: FocusEvent & { currentTarget: HTMLDivElement }) {
    const related = event.relatedTarget as Node | null;
    if (!related || !event.currentTarget.contains(related)) {
      close();
    }
  }
</script>

<div class={cn(className, open && openClassName)} onfocusout={handleFocusOut}>
  <div
    class="flex items-center flex-nowrap gap-[5px] bg-search-bg border border-search-line rounded-none py-[5px] pl-3 pr-2 text-faint transition-shadow duration-[180ms] focus-within:shadow-[0_0_0_2px_var(--color-primary)] [&>svg]:w-[15px] [&>svg]:h-[15px] [&>svg]:flex-none"
  >
    <Icons name="search" size={15} />
    <input
      bind:this={inputEl}
      type="text"
      class="bg-transparent border-none outline-none text-paper font-body text-[13.5px] flex-1 min-w-[40px] w-full placeholder:text-faint"
      value={input}
      placeholder="Find an artist…"
      autocomplete="off"
      spellcheck={false}
      role="combobox"
      aria-label="Find an artist"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={open && activeIndex > 0 ? `${listboxId}-row-${activeIndex}` : undefined}
      oninput={(event) => {
        input = event.currentTarget.value;
        activeIndex = 0;
        open = true;
      }}
      onfocus={() => {
        open = true;
      }}
      onkeydown={handleKeyDown}
    />
    {#if input.length > 0}
      <button
        type="button"
        class="flex-none inline-flex items-center justify-center w-[18px] h-[18px] p-0 border-none bg-transparent text-faint text-[15px] leading-none cursor-pointer hover:text-paper"
        aria-label="Clear search"
        onmousedown={(event) => event.preventDefault()}
        onclick={() => {
          input = "";
          settled = "";
          activeIndex = 0;
          inputEl?.focus();
        }}
      >
        ×
      </button>
    {/if}
  </div>

  {#if open && input.trim().length > 0}
    <SearchDropdown
      id={listboxId}
      {rows}
      {activeIndex}
      term={input}
      {loading}
      onActivate={activate}
      onHover={(index) => {
        activeIndex = index;
      }}
    />
  {/if}
</div>
