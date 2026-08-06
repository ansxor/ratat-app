import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Login });

function Login() {
  return (
    <main className="relative z-1 mx-auto mt-xxl w-full max-w-md px-xl">
      <h1 className="font-display text-h2 text-paper">Ratat</h1>
      <p className="mt-md text-body-sm text-mist">Sign in with your ATProto handle to continue.</p>
      <form className="mt-xl flex flex-col gap-sm rounded-md border border-line bg-ink-raised p-xl shadow-sm shadow-shadow">
        <label htmlFor="handle" className="text-eyebrow uppercase text-faint">
          Handle
        </label>
        <input
          id="handle"
          name="handle"
          placeholder="artist.bsky.social"
          disabled
          className="rounded-sm border border-line-2 bg-search-bg px-md py-sm text-body text-paper placeholder:text-faint disabled:opacity-60"
        />
        <button
          type="submit"
          disabled
          className="mt-sm rounded-sm bg-primary px-md py-sm text-body-sm font-semibold text-primary-foreground disabled:opacity-45"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
