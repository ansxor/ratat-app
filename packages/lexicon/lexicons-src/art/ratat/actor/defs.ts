import { document, integer, object, required, string } from "@atcute/lexicon-doc/builder";

export default document({
  id: "art.ratat.actor.defs",
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
        bskyUrl: required(
          string({ description: "Permalink to the Bluesky profile.", format: "uri" }),
        ),
        indexedAt: string({ format: "datetime" }),
      },
    }),
  },
});
