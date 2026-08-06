import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useSession } from "#/lib/session.tsx";

export function Masthead() {
  const { session, restored, signOut } = useSession();
  const navigate = useNavigate();
  const [handle, setHandle] = useState("");

  const visit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = handle.trim().replace(/^@/, "");
    if (!trimmed) return;
    setHandle("");
    void navigate({ to: "/profile/$handle", params: { handle: trimmed } });
  };

  return (
    <header className="sticky top-0 z-10 border-b border-header-line bg-header text-header-fg">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[var(--maxw)] items-center gap-md px-xl">
        <Link to="/" className="font-display text-h3 tracking-tight">
          Ratat
        </Link>

        <form onSubmit={visit} className="ml-auto flex items-center gap-sm">
          <input
            aria-label="Visit an artist by handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="artist.bsky.social"
            className="w-56 rounded-pill border border-search-line bg-search-bg px-md py-xs text-body-sm text-paper placeholder:text-faint"
          />
        </form>

        {restored && session ? (
          <div className="flex items-center gap-sm">
            {session.handle ? (
              <Link
                to="/profile/$handle"
                params={{ handle: session.handle }}
                className="text-body-sm text-header-fg-dim hover:text-header-fg"
              >
                @{session.handle}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-pill bg-header-tint px-md py-xs text-body-sm hover:bg-header-tint-hi"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
