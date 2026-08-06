export const OAUTH_SCOPE = "atproto transition:generic";

/**
 * Loopback origins get the spec's development client id, which carries its own
 * metadata in the query string; every other origin serves a metadata document.
 */
export function clientMetadata(origin: string): { client_id: string; redirect_uri: string } {
  const redirect_uri = `${origin}/oauth/callback`;

  const isLoopback = /^https?:\/\/(?:127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
  if (isLoopback) {
    const params = new URLSearchParams({ redirect_uri, scope: OAUTH_SCOPE });
    return { client_id: `http://localhost?${params.toString()}`, redirect_uri };
  }

  return { client_id: `${origin}/oauth/client-metadata.json`, redirect_uri };
}
