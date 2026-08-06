import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { BrandMark } from "#/components/BrandMark.tsx";
import { startSignIn } from "#/lib/oauth.ts";
import { useSession } from "#/lib/session.tsx";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { session, restored } = useSession();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (restored && session) void navigate({ to: "/", replace: true });
  }, [restored, session, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = identifier.trim().replace(/^@/, "");
    if (!trimmed) {
      setError("Enter the handle of the account you want to sign in with.");
      return;
    }

    setStarting(true);
    setError("");
    try {
      await startSignIn(trimmed);
    } catch {
      setError(
        `We couldn't find an account for “${trimmed}”. Check the handle — it needs to be the full one, like alice.bsky.social — and try again.`,
      );
      setStarting(false);
    }
  };

  return (
    <main className="wrap flex flex-col items-center pt-[64px] pb-[80px] max-[680px]:pt-[32px]">
      <section
        className="w-[380px] max-w-full border border-line bg-ink-raised shadow-[0_24px_48px_-32px_var(--shadow-drop)]"
        aria-labelledby="login-heading"
      >
        <h1
          id="login-heading"
          className="flex items-center m-0 bg-header border-b-2 border-header-edge px-[20px] py-[10px]"
        >
          <BrandMark className="text-header-fg" />
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col px-[24px] py-[24px]" noValidate>
          <input
            id="login-handle"
            name="handle"
            placeholder="alice.bsky.social"
            autoFocus
            autoComplete="username"
            disabled={starting}
            aria-label="Your handle"
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={error ? true : undefined}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setError("");
            }}
            className="w-full box-border bg-ink-raised border border-line px-[12px] py-[10px] text-[15px] text-paper outline-none focus:shadow-[0_0_0_2px_var(--color-primary)] disabled:opacity-60"
          />

          {error && (
            <p
              id="login-error"
              role="alert"
              className="mt-[10px] mb-0 text-[13px] text-[var(--danger)] leading-[1.5]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={starting}
            className="btn btn--accent mt-[14px] justify-center py-[10px]"
          >
            {starting ? "Taking you to your provider…" : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
