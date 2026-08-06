import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { OAUTH_SCOPE } from "#/lib/oauth-metadata.ts";

export const Route = createFileRoute("/oauth/client-metadata.json")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const forwardedHost = request.headers.get("x-forwarded-host");
        const forwardedProto = request.headers.get("x-forwarded-proto");
        const host = forwardedHost ?? request.headers.get("host") ?? url.host;
        const proto = forwardedProto ?? url.protocol.replace(":", "");
        const origin = `${proto}://${host}`;

        return Response.json(
          {
            client_id: `${origin}/oauth/client-metadata.json`,
            client_name: "Ratat",
            client_uri: origin,
            redirect_uris: [`${origin}/oauth/callback`],
            scope: OAUTH_SCOPE,
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
            application_type: "web",
            dpop_bound_access_tokens: true,
          },
          { headers: { "cache-control": "public, max-age=3600" } },
        );
      },
    },
  },
});
