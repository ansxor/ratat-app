<script lang="ts">
  import { onMount } from "svelte";
  import { login } from "$hatk/client";
  import BrandMark from "$lib/components/BrandMark.svelte";

  let identifier = $state("");
  let error = $state("");
  let starting = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);

  onMount(() => {
    inputEl?.focus();
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = identifier.trim().replace(/^@/, "");
    if (!trimmed) {
      error = "Enter the handle of the account you want to sign in with.";
      return;
    }

    starting = true;
    error = "";
    try {
      await login(trimmed);
    } catch {
      error = `We couldn't find an account for “${trimmed}”. Check the handle — it needs to be the full one, like alice.bsky.social — and try again.`;
      starting = false;
    }
  }
</script>

<main class="wrap flex flex-col items-center pt-[64px] pb-[80px] max-[680px]:pt-[32px]">
  <section
    class="w-[380px] max-w-full border border-line bg-ink-raised shadow-[0_24px_48px_-32px_var(--shadow-drop)]"
    aria-labelledby="login-heading"
  >
    <h1
      id="login-heading"
      class="flex items-center m-0 bg-header border-b-2 border-header-edge px-[20px] py-[10px]"
    >
      <BrandMark class="text-header-fg" />
    </h1>

    <form onsubmit={handleSubmit} class="flex flex-col px-[24px] py-[24px]" novalidate>
      <input
        bind:this={inputEl}
        id="login-handle"
        name="handle"
        placeholder="alice.bsky.social"
        autocomplete="username"
        disabled={starting}
        aria-label="Your handle"
        aria-describedby={error ? "login-error" : undefined}
        aria-invalid={error ? true : undefined}
        bind:value={identifier}
        oninput={() => (error = "")}
        class="w-full box-border bg-ink-raised border border-line px-[12px] py-[10px] text-[15px] text-paper outline-none focus:shadow-[0_0_0_2px_var(--color-primary)] disabled:opacity-60"
      />

      {#if error}
        <p
          id="login-error"
          role="alert"
          class="mt-[10px] mb-0 text-[13px] text-[var(--danger)] leading-[1.5]"
        >
          {error}
        </p>
      {/if}

      <button
        type="submit"
        disabled={starting}
        class="btn btn--accent mt-[14px] justify-center py-[10px]"
      >
        {starting ? "Taking you to your provider…" : "Continue"}
      </button>
    </form>
  </section>
</main>
