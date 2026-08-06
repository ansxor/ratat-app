import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Footer } from "#/components/Footer.tsx";
import { SearchIcon } from "#/components/ui/icons.tsx";
import { useSession } from "#/lib/session.tsx";

export const Route = createFileRoute("/")({ component: Home });

/**
 * The old app's home is a discover feed. Until a discover query exists, the
 * page keeps the gallery shell and offers the one route we can serve: an
 * artist's portfolio.
 */
function Home() {
  const { session, restored } = useSession();
  const navigate = useNavigate();
  const [handle, setHandle] = useState("");

  const visit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = handle.trim().replace(/^@/, "");
    if (!trimmed) return;
    void navigate({ to: "/profile/$handle", params: { handle: trimmed } });
  };

  return (
    <>
      <main className="gallery">
        <div className="wrap layout">
          <div className="feed">
            <section className="w-[520px] max-w-full border border-line bg-ink-raised shadow-[0_24px_48px_-32px_var(--shadow-drop)]">
              <h1 className="flex items-center m-0 bg-ink-hi border-b border-line px-[16px] py-[9px] text-[13px] font-[700] tracking-[0.01em] text-paper">
                Open an artist's portfolio
              </h1>

              <form onSubmit={visit} className="flex flex-col px-[16px] py-[16px]">
                <div className="flex items-center flex-nowrap gap-[5px] bg-search-bg border border-search-line py-[5px] pl-3 pr-2 text-faint transition-shadow duration-[180ms] focus-within:shadow-[0_0_0_2px_var(--color-primary)] [&>svg]:w-[15px] [&>svg]:h-[15px] [&>svg]:flex-none">
                  <SearchIcon />
                  <input
                    aria-label="Artist handle"
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder="alice.bsky.social"
                    autoComplete="off"
                    spellCheck={false}
                    className="bg-transparent border-none outline-none text-paper font-body text-[13.5px] flex-1 min-w-[40px] w-full placeholder:text-faint"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn--accent mt-[14px] justify-center py-[10px]"
                >
                  Open portfolio
                </button>
              </form>

              <p className="m-0 border-t border-line px-[16px] py-[10px] text-[13px] text-mist">
                {restored && session ? (
                  session.handle ? (
                    <>
                      Signed in as @{session.handle} —{" "}
                      <Link
                        to="/profile/$handle"
                        params={{ handle: session.handle }}
                        className="text-primary"
                      >
                        your own portfolio
                      </Link>
                      .
                    </>
                  ) : (
                    "Signed in."
                  )
                ) : (
                  <>
                    <Link to="/login" className="text-primary">
                      Sign in
                    </Link>{" "}
                    to favourite the work you find.
                  </>
                )}
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
