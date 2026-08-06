import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Login });

function Login() {
  return (
    <main>
      <h1>Ratat</h1>
      <p>Sign in with your ATProto handle to continue.</p>
      <form>
        <label htmlFor="handle">Handle</label>
        <input id="handle" name="handle" placeholder="artist.bsky.social" disabled />
        <button type="submit" disabled>
          Sign in
        </button>
      </form>
    </main>
  );
}
