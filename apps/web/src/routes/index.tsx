import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { startSignIn } from "#/lib/oauth.ts";
import { useSession } from "#/lib/session.tsx";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { session, restored } = useSession();

  useEffect(() => {
    if (import.meta.env.PROD) return;
    if (window.location.hostname !== "localhost") return;
    const url = new URL(window.location.href);
    url.hostname = "127.0.0.1";
    window.location.replace(url.toString());
  }, []);

  if (restored && session) return <SignedIn handle={session.handle} />;
  return <Login />;
}

function Login() {
  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const identifier = handle.trim().replace(/^@/, "");
    if (!identifier || pending) return;
    setPending(true);
    setError(null);
    try {
      await startSignIn(identifier);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in could not start.");
      setPending(false);
    }
  };

  return (
    <main className="relative z-1 mx-auto mt-xxl w-full max-w-md px-xl">
      <h1 className="font-display text-h2 text-paper">Ratat</h1>
      <p className="mt-md text-body-sm text-mist">
        A gallery over Bluesky. Sign in with your ATProto handle to continue.
      </p>
      <form
        onSubmit={submit}
        className="mt-xl flex flex-col gap-sm rounded-md border border-line bg-ink-raised p-xl shadow-sm shadow-shadow"
      >
        <label htmlFor="handle" className="text-eyebrow uppercase text-faint">
          Handle
        </label>
        <input
          id="handle"
          name="handle"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder="artist.bsky.social"
          autoComplete="username"
          className="rounded-sm border border-line-2 bg-search-bg px-md py-sm text-body text-paper placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-sm rounded-sm bg-primary px-md py-sm text-body-sm font-semibold text-primary-foreground disabled:opacity-45"
        >
          {pending ? "Redirecting…" : "Sign in"}
        </button>
        {error ? <p className="text-body-sm text-destructive">{error}</p> : null}
      </form>
    </main>
  );
}

function SignedIn({ handle }: { handle: string | undefined }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState("");

  const visit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = target.trim().replace(/^@/, "");
    if (!trimmed) return;
    void navigate({ to: "/profile/$handle", params: { handle: trimmed } });
  };

  return (
    <main className="relative z-1 mx-auto mt-xxl w-full max-w-2xl px-xl">
      <h1 className="font-display text-h2 text-paper">Welcome back</h1>
      <p className="mt-md text-body-sm text-mist">
        The following feed lands in a later phase. For now, open an artist's portfolio.
      </p>

      <form
        onSubmit={visit}
        className="mt-xl flex gap-sm rounded-md border border-line bg-ink-raised p-xl shadow-sm shadow-shadow"
      >
        <input
          aria-label="Artist handle"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="artist.bsky.social"
          className="flex-1 rounded-sm border border-line-2 bg-search-bg px-md py-sm text-body text-paper placeholder:text-faint"
        />
        <button
          type="submit"
          className="rounded-sm bg-primary px-md py-sm text-body-sm font-semibold text-primary-foreground"
        >
          Visit
        </button>
      </form>

      {handle ? (
        <p className="mt-md text-body-sm text-faint">
          Signed in as @{handle} — your own portfolio is at /profile/{handle}.
        </p>
      ) : null}
    </main>
  );
}
