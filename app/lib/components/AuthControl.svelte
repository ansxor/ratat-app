<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { logout } from "$hatk/client";
  import Icons from "$lib/components/Icons.svelte";
  import { getProfile, type Viewer } from "$lib/ratat.ts";

  const AVATAR_CLASS =
    "size-[28px] rounded-none flex-none border border-line shadow-[inset_0_0_0_2px_var(--color-ink-raised)]";

  let { viewer = null }: { viewer?: Viewer | null } = $props();

  let menuOpen = $state(false);
  let menuEl = $state<HTMLDivElement | null>(null);
  let avatar = $state<string | undefined>(undefined);

  $effect(() => {
    const did = viewer?.did;
    avatar = undefined;
    if (!did) return;
    const controller = new AbortController();
    getProfile(did, { signal: controller.signal })
      .then((profile) => {
        if (!controller.signal.aborted) avatar = profile.avatar;
      })
      .catch(() => undefined);
    return () => controller.abort();
  });

  $effect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (menuEl && !menuEl.contains(event.target as Node)) menuOpen = false;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") menuOpen = false;
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  });

  async function handleSignOut() {
    menuOpen = false;
    await logout();
    await invalidateAll();
  }
</script>

{#if !viewer}
  <a
    class="btn btn--accent max-mobile:w-full max-mobile:h-full max-mobile:min-h-[52px] max-mobile:justify-center"
    href="/login"
  >
    <Icons name="sign-in" size={16} strokeWidth={2.2} />
    Sign In
  </a>
{:else}
  {@const handle = viewer.handle ?? viewer.did}
  <div class="relative flex max-mobile:w-full max-mobile:h-full" bind:this={menuEl}>
    <button
      type="button"
      class={`${AVATAR_CLASS} cursor-pointer p-0 max-mobile:w-full max-mobile:h-full max-mobile:min-h-[52px]`}
      aria-label={`Signed in as ${handle} — open account menu`}
      title={handle}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onclick={() => (menuOpen = !menuOpen)}
      style:background-image={avatar ? `url(${avatar})` : "var(--fixed-avatar-placeholder)"}
      style:background-size="cover"
      style:background-position="center"
    ></button>
    {#if menuOpen}
      <div
        class="absolute top-[calc(100%+8px)] right-0 min-w-[150px] max-mobile:top-auto max-mobile:bottom-[calc(100%+8px)] bg-ink-raised border border-line shadow-[0_12px_28px_-12px_var(--shadow-drop)] z-60 flex flex-col"
        role="menu"
      >
        {#if viewer.handle}
          <a
            class="block w-full text-left bg-none border-none border-b border-b-line-soft font-body text-[13px] font-[600] text-paper px-[12px] py-[8px] cursor-pointer last:border-b-0 hover:bg-ink-hi hover:text-paper max-mobile:inline-flex max-mobile:items-center max-mobile:min-h-[44px] max-mobile:py-[10px] max-mobile:text-[15px]"
            href={`/profile/${encodeURIComponent(viewer.handle)}`}
            role="menuitem"
            onclick={() => (menuOpen = false)}
          >
            My profile
          </a>
        {/if}
        <button
          type="button"
          class="block w-full text-left bg-none border-none border-b border-b-line-soft font-body text-[13px] font-[600] text-paper px-[12px] py-[8px] cursor-pointer last:border-b-0 hover:bg-ink-hi hover:text-paper max-mobile:inline-flex max-mobile:items-center max-mobile:min-h-[44px] max-mobile:py-[10px] max-mobile:text-[15px]"
          role="menuitem"
          onclick={handleSignOut}
        >
          Sign out
        </button>
      </div>
    {/if}
  </div>
{/if}
