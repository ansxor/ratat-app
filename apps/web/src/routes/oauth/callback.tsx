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
    <main className="mx-auto mt-xxl w-full max-w-md px-xl text-center">
      {error ? (
        <>
          <p className="text-body text-paper">Sign-in didn&apos;t complete: {error}</p>
          <Link
            to="/"
            className="mt-lg inline-block rounded-sm border border-line-2 px-md py-sm text-body-sm text-mist"
          >
            Back to Ratat
          </Link>
        </>
      ) : (
        <p className="text-body text-mist">Finishing sign-in…</p>
      )}
    </main>
  );
}
