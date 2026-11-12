import { defineConfig } from "@hatk/hatk/config";

const isProd = process.env.NODE_ENV === "production";
const prodDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
const scopes = [
  "atproto",
  "repo:app.bsky.feed.like?action=create&action=delete",
  "repo:net.ratat.graph.follow?action=create&action=delete",
];

export default defineConfig({
  relay: isProd ? "wss://bsky.network" : "ws://localhost:2583",
  plc: isProd ? "https://plc.directory" : "http://localhost:2582",
  port: 3000,
  databaseEngine: "sqlite",
  database: isProd ? "/data/hatk.db" : "data/hatk.db",
  collections: [
    "app.bsky.feed.post",
    "app.bsky.actor.profile",
    "app.bsky.feed.like",
    "net.ratat.graph.follow",
  ],
  backfill: {
    parallelism: 3,
    fullNetwork: false,
    signalCollections: ["net.ratat.graph.follow"],
    references: [{ collection: "net.ratat.graph.follow", field: "subject" }],
  },
  oauth: {
    issuer: isProd && prodDomain ? `https://${prodDomain}` : undefined,
    scopes,
    clients: [
      ...(prodDomain
        ? [
            {
              client_id: `https://${prodDomain}/oauth-client-metadata.json`,
              client_name: "Ratat",
              scope: scopes.join(" "),
              redirect_uris: [
                `https://${prodDomain}/oauth/callback`,
                `https://${prodDomain}/admin`,
              ],
            },
          ]
        : []),
      {
        client_id: "http://127.0.0.1:3000/oauth-client-metadata.json",
        client_name: "Ratat",
        scope: scopes.join(" "),
        redirect_uris: ["http://127.0.0.1:3000/oauth/callback"],
      },
    ],
  },
});
