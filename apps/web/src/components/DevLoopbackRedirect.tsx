import { useEffect } from "react";

/**
 * The OAuth client id is registered against 127.0.0.1, so a dev session opened
 * on localhost has to move across before sign-in can start.
 */
export function DevLoopbackRedirect() {
  useEffect(() => {
    if (import.meta.env.PROD) return;
    if (window.location.hostname !== "localhost") return;
    const url = new URL(window.location.href);
    url.hostname = "127.0.0.1";
    window.location.replace(url.toString());
  }, []);

  return null;
}
