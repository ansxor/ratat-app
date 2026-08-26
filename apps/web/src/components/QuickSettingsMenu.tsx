import { useEffect, useRef, useState } from "react";

import { SettingRow } from "#/components/settings/SettingRow.tsx";
import { SegmentedRadio, type SegmentedOption } from "#/components/ui/SegmentedRadio.tsx";
import {
  BlackoutIcon,
  BlurIcon,
  DarkThemeIcon,
  EyeIcon,
  EyeOffIcon,
  LightThemeIcon,
  SettingsIcon,
  SystemThemeIcon,
} from "#/components/ui/icons.tsx";
import {
  CATEGORY_META,
  FILTER_CATEGORIES,
  filterSummary,
  MODE_META,
  VEIL_MODES,
  type VeilMode,
} from "#/lib/content-filter.ts";
import { useSettings } from "#/lib/settings.tsx";
import { THEME_CHOICES, THEME_META, type ThemeChoice } from "#/lib/theme.ts";
import { cn } from "#/lib/utils.ts";

const COG = { size: 17, strokeWidth: 1.9 } as const;

const MODE_ICONS: Record<VeilMode, React.ReactNode> = {
  hide: <EyeOffIcon />,
  black: <BlackoutIcon fill="currentColor" />,
  blur: <BlurIcon />,
  show: <EyeIcon />,
};

const THEME_ICONS: Record<ThemeChoice, React.ReactNode> = {
  system: <SystemThemeIcon />,
  light: <LightThemeIcon />,
  dark: <DarkThemeIcon />,
};

const VEIL_OPTIONS: readonly SegmentedOption<VeilMode>[] = VEIL_MODES.map((veil) => ({
  value: veil,
  icon: MODE_ICONS[veil],
  label: MODE_META[veil].label,
  hint: MODE_META[veil].hint,
}));

const THEME_OPTIONS: readonly SegmentedOption<ThemeChoice>[] = THEME_CHOICES.map((choice) => ({
  value: choice,
  icon: THEME_ICONS[choice],
  label: THEME_META[choice].label,
  hint: THEME_META[choice].hint,
}));

/**
 * Ported from the old app's `QuickSettingsMenu`, with the Pager's "always show
 * details" toggle folded in as the issue asks. It sits in the masthead rather
 * than on the Pager because the Pager only renders where there are works to
 * page through — and a device that has hidden everything would otherwise have
 * no way back to the setting that hid it.
 */
export function QuickSettingsMenu() {
  const {
    filters,
    theme,
    alwaysShowDetails,
    hydrated,
    setFilterMode,
    setTheme,
    setAlwaysShowDetails,
  } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="Quick settings"
        title="Quick settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={cn(
          "size-[28px] flex-none inline-flex items-center justify-center cursor-pointer p-0",
          "border-none bg-header-tint text-header-fg",
          "transition-colors duration-[140ms] hover:bg-header-tint-hi",
          open && "bg-ink text-paper",
        )}
      >
        <SettingsIcon {...COG} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Quick settings"
          className={cn(
            "absolute top-[calc(100%+8px)] right-0 z-50 w-[292px]",
            "bg-ink-raised border border-paper text-left",
            "shadow-[0_22px_40px_-20px_var(--shadow-drop)]",
          )}
        >
          <span
            aria-hidden="true"
            className="absolute -top-[5px] right-[10px] size-[8px] rotate-45 bg-ink border-l border-t border-paper"
          />
          {FILTER_CATEGORIES.map((category) => (
            <SettingRow
              key={category}
              label={CATEGORY_META[category].label}
              status={MODE_META[filters[category]].label}
              emphasised={filters[category] !== "show"}
            >
              <SegmentedRadio
                value={filters[category]}
                options={VEIL_OPTIONS}
                disabled={!hydrated}
                aria-label={`${CATEGORY_META[category].label} filter mode`}
                onValueChange={(next) => setFilterMode(category, next)}
              />
            </SettingRow>
          ))}

          <SettingRow
            label="Theme"
            status={THEME_META[theme].label}
            emphasised={theme !== "system"}
          >
            <SegmentedRadio
              value={theme}
              options={THEME_OPTIONS}
              disabled={!hydrated}
              aria-label="Colour theme"
              onValueChange={setTheme}
            />
          </SettingRow>

          <div className="px-[12px] pt-[10px] pb-[11px] border-b border-line-soft">
            <label className="flex items-center gap-[9px] cursor-pointer text-[12.5px] font-[700] tracking-[0.01em] text-paper">
              <input
                type="checkbox"
                checked={alwaysShowDetails}
                disabled={!hydrated}
                className="appearance-none flex-none w-[34px] h-[18px] rounded-full relative cursor-pointer bg-ink-hi border border-line transition-[background,border-color] duration-[150ms] after:content-[''] after:absolute after:top-px after:left-px after:size-[14px] after:rounded-full after:bg-ink-raised after:shadow-[0_1px_2px_var(--shadow)] after:transition-transform after:duration-[150ms] checked:bg-primary checked:border-primary checked:after:translate-x-[16px]"
                onChange={(event) => setAlwaysShowDetails(event.target.checked)}
              />
              <span>Always show details</span>
            </label>
          </div>

          <div className="bg-ink px-[12px] py-[8px] text-[11px] text-faint">
            {filterSummary(filters)}
          </div>
        </div>
      )}
    </div>
  );
}
