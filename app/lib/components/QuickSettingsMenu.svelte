<script lang="ts">
  import type { IconName } from "$lib/components/Icons.svelte";
  import Icons from "$lib/components/Icons.svelte";
  import SegmentedRadio, { type SegmentedOption } from "$lib/components/SegmentedRadio.svelte";
  import {
    CATEGORY_META,
    FILTER_CATEGORIES,
    MODE_META,
    VEIL_MODES,
    type VeilMode,
  } from "$lib/content-filter.ts";
  import { applyThemeEffect, settings } from "$lib/settings.svelte.ts";
  import { THEME_CHOICES, THEME_META, type ThemeChoice } from "$lib/theme.ts";
  import { cn } from "$lib/utils.ts";

  const MODE_ICONS: Record<VeilMode, { iconName: IconName; iconFill?: string }> = {
    hide: { iconName: "eye-off" },
    black: { iconName: "blackout", iconFill: "currentColor" },
    blur: { iconName: "blur" },
    show: { iconName: "eye" },
  };

  const THEME_ICONS: Record<ThemeChoice, IconName> = {
    system: "system-theme",
    light: "light-theme",
    dark: "dark-theme",
  };

  const VEIL_OPTIONS: readonly SegmentedOption<VeilMode>[] = VEIL_MODES.map((veil) => ({
    value: veil,
    iconName: MODE_ICONS[veil].iconName,
    iconFill: MODE_ICONS[veil].iconFill,
    label: MODE_META[veil].label,
    hint: MODE_META[veil].hint,
  }));

  const THEME_OPTIONS: readonly SegmentedOption<ThemeChoice>[] = THEME_CHOICES.map((choice) => ({
    value: choice,
    iconName: THEME_ICONS[choice],
    label: THEME_META[choice].label,
    hint: THEME_META[choice].hint,
  }));

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Node)) return;
      if (!rootEl?.contains(event.target)) open = false;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") open = false;
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  });
</script>

<div
  bind:this={rootEl}
  class="quick-settings-root relative inline-flex max-mobile:static max-mobile:w-full max-mobile:h-full max-mobile:min-w-0"
>
  <button
    type="button"
    aria-label="Quick settings"
    title="Quick settings"
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={(event) => {
      event.stopPropagation();
      open = !open;
    }}
    class={cn(
      "size-[28px] flex-none inline-flex items-center justify-center cursor-pointer p-0 max-mobile:size-full max-mobile:min-h-[52px]",
      "border-none bg-header-tint text-header-fg",
      "transition-colors duration-[140ms] hover:bg-header-tint-hi",
      open && "bg-ink text-paper",
    )}
  >
    <Icons name="settings" size={17} strokeWidth={1.9} />
  </button>

  {#if open}
    <div
      role="dialog"
      aria-label="Quick settings"
      class={cn(
        "absolute top-[calc(100%+8px)] right-0 z-50 w-[292px]",
        "max-mobile:top-auto max-mobile:right-auto max-mobile:bottom-[calc(100%+8px)] max-mobile:left-0 max-mobile:w-full max-mobile:max-w-[100vw]",
        "bg-ink-raised border border-paper text-left",
        "shadow-[0_22px_40px_-20px_var(--shadow-drop)]",
      )}
    >
      <span
        aria-hidden="true"
        class="absolute -top-[5px] right-[10px] size-[8px] rotate-45 bg-ink border-l border-t border-paper max-mobile:hidden"
      ></span>
      {#each FILTER_CATEGORIES as category (category)}
        <div class="px-[12px] pt-[10px] pb-[11px] border-b border-line-soft">
          <div class="flex items-baseline gap-[8px]">
            <b class="text-[12.5px] font-[700] tracking-[0.01em] text-paper">
              {CATEGORY_META[category].label}
            </b>
            <span
              class={cn(
                "ml-auto text-[10.5px] tracking-[0.06em] uppercase",
                settings.filters[category] !== "show" ? "text-primary" : "text-faint",
              )}
            >
              {MODE_META[settings.filters[category]].label}
            </span>
          </div>
          <SegmentedRadio
            value={settings.filters[category]}
            options={VEIL_OPTIONS}
            disabled={!settings.hydrated}
            ariaLabel={`${CATEGORY_META[category].label} filter mode`}
            onValueChange={(next) => settings.setFilterMode(category, next)}
          />
        </div>
      {/each}

      <div class="px-[12px] pt-[10px] pb-[11px] border-b border-line-soft">
        <div class="flex items-baseline gap-[8px]">
          <b class="text-[12.5px] font-[700] tracking-[0.01em] text-paper">Theme</b>
          <span
            class={cn(
              "ml-auto text-[10.5px] tracking-[0.06em] uppercase",
              settings.theme !== "system" ? "text-primary" : "text-faint",
            )}
          >
            {THEME_META[settings.theme].label}
          </span>
        </div>
        <SegmentedRadio
          value={settings.theme}
          options={THEME_OPTIONS}
          disabled={!settings.hydrated}
          ariaLabel="Colour theme"
          onValueChange={(next) => {
            settings.setTheme(next);
            applyThemeEffect();
          }}
        />
      </div>
    </div>
  {/if}
</div>
