import { cn } from "#/lib/utils.ts";

/**
 * `compact` drops the " Ratat" word below 520px so the masthead row still fits
 * the search button and the account controls on a phone. It is opt-in because
 * the other caller is the login card's `h1`, whose accessible name is this text.
 */
export function BrandMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("brand__mark", className)}>
      ᓚᘏᕐᐷ<span className={cn(compact && "max-[520px]:hidden")}> Ratat</span>
    </span>
  );
}
