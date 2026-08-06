import { cn } from "#/lib/utils.ts";

/**
 * The one line a gallery shows instead of works: loading, empty, or broken.
 * Ported from the old app's `ProfileFeed` notice, which is why every such line
 * in the app looks the same.
 */
export function FeedNotice({
  children,
  pulse = false,
}: {
  children: React.ReactNode;
  pulse?: boolean;
}) {
  return (
    <p className={cn("text-mist py-[24px] [&_a]:underline", pulse && "animate-pulse-soft")}>
      {children}
    </p>
  );
}
