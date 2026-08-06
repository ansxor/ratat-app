import { array, document, integer, object, required, string } from "@atcute/lexicon-doc/builder";

export default document({
  id: "net.ratat.actor.defs",
  defs: {
    profileViewBasic: object({
      description: "The byline shape: enough to render an artist next to their work.",
      properties: {
        did: required(string({ format: "did" })),
        handle: required(string({ format: "handle" })),
        displayName: string({ maxLength: 800, maxGraphemes: 80 }),
        avatar: string({ description: "CDN URL, not a blob ref.", format: "uri" }),
      },
    }),
    profileView: object({
      description: "An artist's profile, hydrated from their Bluesky profile record.",
      properties: {
        did: required(string({ format: "did" })),
        handle: required(string({ format: "handle" })),
        displayName: string({ maxLength: 800, maxGraphemes: 80 }),
        description: string({ maxLength: 20000, maxGraphemes: 2000 }),
        avatar: string({ format: "uri" }),
        banner: string({ format: "uri" }),
        followersCount: integer(),
        followsCount: integer(),
        postsCount: integer({
          description:
            "Posts of every kind in the actor's repo, as Bluesky counts them — not the size of this actor's Ratat portfolio, which holds only posts with media.",
        }),
        labels: array({
          description:
            "Moderation label values on the account, from its self-labels and from the labelers the Bluesky appview applies. Negations are already resolved away.",
          items: string({ maxLength: 128 }),
        }),
        bskyUrl: required(
          string({ description: "Permalink to the Bluesky profile.", format: "uri" }),
        ),
        indexedAt: string({ format: "datetime" }),
      },
    }),
  },
});
