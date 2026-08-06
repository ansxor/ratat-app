import { Link } from "@tanstack/react-router";

import { EyeOffIcon } from "#/components/ui/icons.tsx";
import { categoriesOf, CATEGORY_META } from "#/lib/content-filter.ts";

function GateFrame({ children }: { children?: React.ReactNode }) {
  return (
    <main className="gallery">
      <div className="wrap layout">
        <div className="feed">
          <div className="relative h-[calc(100vh-260px)] bg-ink-raised border border-line p-[16px] flex flex-col items-center justify-center text-center gap-[10px]">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Ported from the old app's `ArtworkRatingGate`. Hiding a work removes it from
 * every feed, but a link to it is still a link somebody followed on purpose,
 * so the page says what covered it and offers the one-time reveal rather than
 * pretending the artwork does not exist.
 */
export function ArtworkGate({
  handle,
  labels,
  onReveal,
}: {
  handle: string;
  labels: readonly string[] | undefined;
  onReveal: () => void;
}) {
  const categories = categoriesOf(labels);
  const named = categories.map((category) => CATEGORY_META[category].label.toLowerCase());
  const subject = named.length > 0 ? named.join(" and ") : "this content";

  return (
    <GateFrame>
      <span className="text-faint [&_svg]:size-[40px]" aria-hidden="true">
        <EyeOffIcon strokeWidth={1.5} />
      </span>
      <h1 className="m-0 text-[20px] font-[600] tracking-[-0.01em] text-paper">Filtered</h1>
      <p className="m-0 text-[13.5px] text-mist max-w-[42ch]">
        You&apos;ve set {subject} to be hidden. This piece is by{" "}
        <Link className="underline" to="/profile/$handle" params={{ handle }}>
          @{handle}
        </Link>
        .
      </p>
      <button type="button" className="btn btn--accent mt-[4px]" onClick={onReveal}>
        Reveal
      </button>
      <p className="m-0 text-[11.5px] text-faint">Change this in Quick settings.</p>
    </GateFrame>
  );
}
