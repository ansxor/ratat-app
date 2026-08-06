import { EyeOffIcon } from "#/components/ui/icons.tsx";
import { cn } from "#/lib/utils.ts";

export type VeilStrength = "tile" | "page";

/** Blurs the image inside a frame; the cover itself is the button below. */
export function veilFrameClass(
  veil: "black" | "blur" | null,
  { animated, strength = "tile" }: { animated: boolean; strength?: VeilStrength },
): string {
  return cn(
    animated &&
      "[&_img]:transition-[filter,scale] [&_img]:duration-[260ms] [&_img]:ease-out [&_video]:transition-[filter,scale] [&_video]:duration-[260ms] [&_video]:ease-out",
    veil === "blur" &&
      (strength === "page"
        ? "[&_img]:blur-[52px] [&_img]:scale-[1.2] [&_video]:blur-[52px] [&_video]:scale-[1.2]"
        : "[&_img]:blur-[14px] [&_img]:scale-[1.12] [&_video]:blur-[14px] [&_video]:scale-[1.12]"),
  );
}

export function ArtworkVeil({
  variant,
  onReveal,
  animated = false,
  peeked = false,
  iconSize = 30,
  prominent = false,
  label = "Uncensor filtered artwork",
}: {
  variant: "black" | "blur";
  onReveal: () => void;
  animated?: boolean;
  peeked?: boolean;
  iconSize?: number;
  prominent?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={peeked ? -1 : undefined}
      onClick={(event) => {
        event.preventDefault();
        onReveal();
        if (event.detail > 0) event.currentTarget.blur();
      }}
      className={cn(
        "group absolute inset-0 z-[3] flex flex-col items-center justify-center gap-[9px]",
        "w-full cursor-pointer border-none p-0",
        animated && "transition-opacity duration-[260ms] ease-out",
        peeked && "opacity-0 pointer-events-none",
        variant === "black"
          ? "bg-scrim-solid text-scrim-solid-fg"
          : "bg-transparent text-scrim-text",
      )}
    >
      <EyeOffIcon size={iconSize} strokeWidth={1.7} />
      <span
        className={cn(
          "max-w-full truncate leading-[1.5] font-[600]",
          prominent
            ? "bg-primary text-accent-ink text-[13px] tracking-[0.01em] px-[13px] py-[6px]"
            : cn(
                "bg-scrim-chip text-accent-ink text-[10.5px] tracking-[0.02em] px-[6px] py-[2px]",
                "opacity-0 transition-opacity duration-[140ms]",
                "group-hover:opacity-100 group-focus-visible:opacity-100",
              ),
        )}
      >
        Click to uncensor
      </span>
    </button>
  );
}
