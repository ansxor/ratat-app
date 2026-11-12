<script lang="ts">
  import { goto } from "$app/navigation";
  import { imageBackground } from "$lib/artwork-media";
  import { toast } from "$lib/components/Toaster.svelte";
  import {
    dismissFollowImport,
    followsStore,
    hasDismissedFollowImport,
    importFollows,
  } from "$lib/follows.svelte";
  import { cn } from "$lib/utils";

  let { data } = $props();

  let selected = $state<Set<string>>(new Set());
  let busy = $state(false);
  let error = $state("");
  let checkedDismissed = $state(false);

  $effect(() => {
    if (hasDismissedFollowImport()) {
      void goto("/", { replaceState: true });
      return;
    }
    checkedDismissed = true;
  });

  $effect(() => {
    selected = new Set(data.candidates.map((account) => account.did));
  });

  function toggle(did: string) {
    const next = new Set(selected);
    if (next.has(did)) next.delete(did);
    else next.add(did);
    selected = next;
  }

  function leave() {
    dismissFollowImport();
    void goto("/", { replaceState: true });
  }

  async function confirm() {
    const subjects = data.candidates
      .map((account) => account.did)
      .filter((did) => selected.has(did));
    if (subjects.length === 0) {
      leave();
      return;
    }

    busy = true;
    error = "";
    try {
      await importFollows(subjects);
      dismissFollowImport();
      followsStore.reload(data.viewer.did);
      await goto("/", { replaceState: true, invalidateAll: true });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "That didn't work.";
      toast.error(error);
      busy = false;
    }
  }

  const accounts = $derived(data.candidates);
  const count = $derived(selected.size);
  const primaryLabel = $derived(
    busy
      ? "Following…"
      : count > 0
        ? `Follow ${count} artist${count === 1 ? "" : "s"} →`
        : "Continue without following anyone →",
  );
</script>

{#if !checkedDismissed}
  <div class="min-h-dvh flex flex-col">
    <div class="flex-1 grid place-items-center px-4 py-16 text-mist text-[14px]">
      Preparing your setup…
    </div>
  </div>
{:else}
  <main class="flex-1 flex flex-col items-center px-pad pt-[40px] pb-[70px] w-full box-border">
    <section class="w-[1000px] max-w-full" aria-label="Import your Bluesky follows">
      <h1
        class="m-0 font-display text-[clamp(30px,4vw,42px)] font-[500] tracking-[-0.02em] leading-[1.02]"
      >
        Bring your follows over
      </h1>
      <p class="mt-[14px] text-[15.5px] text-mist max-w-[52ch]">
        {#if accounts.length > 0}
          You follow {accounts.length} account{accounts.length === 1 ? "" : "s"} on Bluesky. Pick
          the ones whose art you want in your Ratat gallery — following here is separate from
          Bluesky, so unpicking someone changes nothing there.
        {:else}
          You don't follow anyone on Bluesky yet. Open an artist's portfolio and follow them from
          there.
        {/if}
      </p>

      {#if accounts.length > 0}
        <div
          class="flex items-center gap-[10px] bg-overlay border border-line px-[10px] py-[5px] mt-[24px]"
        >
          <span class="text-[11px] font-[700] tracking-[0.1em] text-mist whitespace-nowrap uppercase">
            <b class="text-primary">{count}</b> / {accounts.length} selected
          </span>
          <div class="ml-auto flex gap-[6px]">
            <button
              type="button"
              class={cn("btn btn--ghost", "px-[10px] py-[4px] text-[12px]")}
              onclick={() => (selected = new Set(accounts.map((account) => account.did)))}
            >
              Select all
            </button>
            <button
              type="button"
              class={cn("btn btn--ghost", "px-[10px] py-[4px] text-[12px]")}
              onclick={() => (selected = new Set())}
            >
              Select none
            </button>
          </div>
        </div>

        <div class="mt-[6px] border border-line bg-ink-raised max-h-[420px] overflow-y-auto">
          {#each accounts as account (account.did)}
            {@const picked = selected.has(account.did)}
            <button
              type="button"
              class="group flex w-full items-center gap-[10px] px-[14px] py-[9px] border-b border-line-soft last:border-b-0 text-left cursor-pointer bg-transparent hover:bg-ink-hi"
              onclick={() => toggle(account.did)}
              aria-pressed={picked}
            >
              <span
                class="size-[32px] flex-none bg-cover bg-center border border-line shadow-[inset_0_0_0_2px_var(--color-ink-raised)]"
                style={imageBackground(account.avatar, "var(--fixed-avatar-placeholder)")}
              ></span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13.5px] font-[700] leading-[1.25] truncate text-paper">
                  {account.displayName?.trim() || account.handle}
                </span>
                <span class="block text-[11px] tracking-[0.02em] text-faint truncate">
                  @{account.handle}
                </span>
              </span>
              <span
                class={cn(
                  "size-[22px] flex-none flex items-center justify-center text-[13px] font-[700] border",
                  picked
                    ? "bg-primary text-accent-ink border-primary"
                    : "bg-transparent text-transparent border-line-2",
                )}
                aria-hidden="true"
              >
                ✓
              </span>
            </button>
          {/each}
        </div>
      {/if}

      {#if error}
        <p
          role="alert"
          class="mt-[14px] mb-0 text-[13px] text-[var(--danger)] leading-[1.5]"
        >
          {error}
        </p>
      {/if}

      <div
        class="flex justify-between items-center gap-[20px] mt-[40px] pt-[20px] border-t border-line max-[680px]:flex-col max-[680px]:items-stretch"
      >
        <button type="button" class="btn btn--ghost" onclick={leave} disabled={busy}>
          Skip for now
        </button>
        <button type="button" class="btn btn--accent" onclick={confirm} disabled={busy}>
          {primaryLabel}
        </button>
      </div>
    </section>
  </main>
{/if}
