<script module lang="ts">
  interface ToastItem {
    id: number;
    kind: "error" | "info" | "success";
    message: string;
  }

  let nextId = 1;
  let toasts = $state<ToastItem[]>([]);

  function pushToast(kind: ToastItem["kind"], message: string): void {
    const id = nextId++;
    toasts = [...toasts, { id, kind, message }];
    if (typeof window !== "undefined") {
      window.setTimeout(() => dismissToast(id), 4500);
    }
  }

  function dismissToast(id: number): void {
    toasts = toasts.filter((item) => item.id !== id);
  }

  export const toast = {
    error(message: string): void {
      pushToast("error", message);
    },
    info(message: string): void {
      pushToast("info", message);
    },
    success(message: string): void {
      pushToast("success", message);
    },
  };
</script>

<script lang="ts">
  import Icons from "$lib/components/Icons.svelte";
  import { cn } from "$lib/utils.ts";
</script>

{#if toasts.length > 0}
  <div
    class="fixed bottom-[16px] right-[16px] z-100 flex flex-col gap-[8px] max-w-[360px] w-[calc(100vw-32px)] pointer-events-none max-mobile:bottom-[76px]"
    aria-live="polite"
  >
    {#each toasts as item (item.id)}
      <div
        role="status"
        class={cn(
          "pointer-events-auto flex items-start gap-[10px] px-[12px] py-[10px] bg-ink-raised border text-paper text-[13px] shadow-[0_12px_28px_-12px_var(--shadow-drop)]",
          item.kind === "error"
            ? "border-[var(--danger)]"
            : item.kind === "success"
              ? "border-up"
              : "border-paper",
        )}
      >
        <span class="flex-1 min-w-0">{item.message}</span>
        <button
          type="button"
          aria-label="Dismiss notification"
          class="flex-none text-mist hover:text-paper p-[2px]"
          onclick={() => dismissToast(item.id)}
        >
          <Icons name="x" size={14} strokeWidth={2} />
        </button>
      </div>
    {/each}
  </div>
{/if}
