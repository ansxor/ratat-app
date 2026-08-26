import { useId } from "react";

import { cn } from "#/lib/utils.ts";

export interface SegmentedOption<T extends string> {
  value: T;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}

const COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

/**
 * Ported from the old app's `ui/SegmentedRadio`. Base UI's `RadioGroup` and
 * tooltip are not in this app, so the segments are real radio inputs — which
 * is where arrow-key navigation comes from — and the hint that was a tooltip
 * is the button's title.
 */
export function SegmentedRadio<T extends string>({
  value,
  options,
  onValueChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onValueChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid gap-px mt-[7px] bg-line-2 border border-line-2",
        COLUMNS[options.length],
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          title={option.hint ? `${option.label} · ${option.hint}` : option.label}
          className={cn(
            "h-[27px] inline-flex items-center justify-center cursor-pointer p-0",
            "bg-ink-raised text-mist transition-colors duration-[140ms] hover:bg-ink",
            "[&_svg]:size-[15px]",
            value === option.value && "bg-primary text-primary-foreground",
            disabled && "opacity-[0.6] cursor-default",
          )}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            aria-label={option.label}
            onChange={() => onValueChange(option.value)}
          />
          {option.icon}
        </label>
      ))}
    </div>
  );
}
