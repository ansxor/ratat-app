import { HighlightMatch } from "#/components/search/HighlightMatch.tsx";
import { SearchIcon } from "#/components/ui/icons.tsx";
import { PLACEHOLDER_GRADIENT } from "#/lib/avatar.ts";
import { imageBackground } from "#/lib/image.tsx";
import type { ProfileBasic } from "#/lib/ratat.ts";
import { cn } from "#/lib/utils.ts";

/**
 * Row 0 is always the handle the visitor typed, so Enter goes where it went
 * before suggestions existed. The rest are artists.
 */
export type SearchRow = { kind: "handle" } | { kind: "actor"; actor: ProfileBasic };

const rowId = (id: string, index: number) => `${id}-row-${index}`;

export function SearchDropdown({
  id,
  rows,
  activeIndex,
  term,
  loading,
  onActivate,
  onHover,
}: {
  id: string;
  rows: readonly SearchRow[];
  activeIndex: number;
  term: string;
  loading: boolean;
  onActivate: (index: number) => void;
  onHover: (index: number) => void;
}) {
  const subject = term.trim().replace(/^@/, "");
  const suggestions = rows.length - 1;

  return (
    <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-70 bg-ink-raised border border-line shadow-[0_18px_36px_-18px_var(--shadow-drop)] text-paper overflow-hidden">
      <div
        className="max-h-[62vh] overflow-y-auto"
        id={id}
        role="listbox"
        aria-label="Artist suggestions"
      >
        {rows.map((row, index) => {
          const active = index === activeIndex;
          const heading = index === 1 ? "Artists" : undefined;

          return (
            <div key={row.kind === "handle" ? "handle" : row.actor.did} role="presentation">
              {heading && (
                <p className="py-[9px] px-3 pb-1 text-eyebrow tracking-eyebrow uppercase text-faint">
                  {heading}
                </p>
              )}
              <div
                className={cn("flex items-center gap-[9px] py-[7px] px-3", active && "bg-ink-hi")}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onHover(index)}
              >
                <div
                  id={rowId(id, index)}
                  role="option"
                  aria-selected={active}
                  tabIndex={-1}
                  className="flex items-center gap-[9px] flex-1 min-w-0 cursor-pointer"
                  onClick={() => onActivate(index)}
                >
                  {row.kind === "handle" ? (
                    <>
                      <SearchIcon className="w-4 h-4 flex-none text-mist" />
                      <span className="block min-w-0 flex-1 text-[13px] [&_b]:font-bold">
                        Go to <b>@{subject || "an artist"}</b>
                      </span>
                      <span className="flex-none text-[10.5px] font-bold py-[2px] px-[6px] whitespace-nowrap text-mist border border-line">
                        ↵ Enter
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="w-7 h-7 flex-none bg-cover bg-center border border-line-soft"
                        style={imageBackground(row.actor.avatar, PLACEHOLDER_GRADIENT)}
                        aria-hidden="true"
                      />
                      <span className="flex flex-col gap-[1px] min-w-0 flex-1 text-[13px] [&_mark]:bg-transparent [&_mark]:text-primary [&_mark]:font-[800]">
                        <span className="truncate font-semibold">
                          {row.actor.displayName ?? row.actor.handle}
                        </span>
                        <span className="text-[11.5px] text-faint truncate">
                          @<HighlightMatch text={row.actor.handle} match={subject} />
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {suggestions === 0 && (
        <p className="py-[9px] px-3 text-[11.5px] text-faint border-t border-line-soft [&_b]:text-mist [&_b]:font-bold">
          {loading ? (
            "Looking…"
          ) : (
            <>
              No artists match. Press <b>Enter</b> to go to the handle as typed.
            </>
          )}
        </p>
      )}
    </div>
  );
}
