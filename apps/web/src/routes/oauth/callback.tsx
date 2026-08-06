import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { completeSignIn } from "#/lib/oauth.ts";

export const Route = createFileRoute("/oauth/callback")({ component: OAuthCallback });

function OAuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await completeSignIn();
        window.location.replace("/");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Sign-in failed.");
      }
    })();
  }, []);

  return (
    <main className="wrap flex flex-col items-center pt-[64px] pb-[80px] max-[680px]:pt-[32px]">
      <section className="w-[380px] max-w-full border border-line bg-ink-raised shadow-[0_24px_48px_-32px_var(--shadow-drop)] px-[24px] py-[24px]">
        {error ? (
          <>
            <p className="m-0 text-[13px] leading-[1.5] text-[var(--danger)]" role="alert">
              Sign-in didn&apos;t complete: {error}
            </p>
            <Link to="/login" className="btn btn--ghost mt-[14px] justify-center py-[10px] w-full">
              Try again
            </Link>
          </>
        ) : (
          <p className="m-0 text-[13px] text-mist animate-pulse-soft">Finishing sign-in…</p>
        )}
      </section>
    </main>
  );
}
