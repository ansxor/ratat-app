import { ArtworkCard } from "#/components/ArtworkCard.tsx";
import type { Post } from "#/lib/ratat.ts";
import { useVisible } from "#/lib/settings.tsx";

function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center font-[700] text-[13px] tracking-[0.01em] text-paper bg-ink-hi px-[8px] py-[7px] border border-line mb-[0.4rem]">
      {children}
    </div>
  );
}

/**
 * The rail is a fixed two-by-two, so a card that filters itself out would
 * leave a hole rather than close the gap: this one drops hidden works before
 * laying out instead of after.
 */
export function Sidebar({ moreBy }: { moreBy: Post[] }) {
  const visible = useVisible(moreBy);
  if (visible.length === 0) return null;
  return (
    <aside className="w-[326px] flex-none max-[880px]:w-full [&_section+section]:mt-[18px]">
      <section>
        <RailHeading>More by @{visible[0]?.author.handle}</RailHeading>
        <div className="grid grid-cols-2 gap-[0.4rem]">
          {visible.map((post) => (
            <ArtworkCard key={post.uri} post={post} aspect="1/1" header="none" />
          ))}
        </div>
      </section>
    </aside>
  );
}
