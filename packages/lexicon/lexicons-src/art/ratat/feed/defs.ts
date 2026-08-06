import {
  array,
  document,
  integer,
  object,
  ref,
  required,
  string,
  union,
} from "@atcute/lexicon-doc/builder";

export default document({
  id: "art.ratat.feed.defs",
  defs: {
    imageView: object({
      description: "CDN URLs served by Bluesky; dimensions are the appview's, not the record's.",
      properties: {
        thumb: required(string({ format: "uri" })),
        fullsize: required(string({ format: "uri" })),
        alt: string({ maxLength: 10000, maxGraphemes: 1000 }),
        aspectRatio: ref({ ref: "app.bsky.embed.defs#aspectRatio" }),
      },
    }),
    videoView: object({
      properties: {
        playlist: required(string({ description: "HLS manifest URL.", format: "uri" })),
        thumbnail: string({ format: "uri" }),
        alt: string({ maxLength: 10000, maxGraphemes: 1000 }),
        aspectRatio: ref({ ref: "app.bsky.embed.defs#aspectRatio" }),
      },
    }),
    postView: object({
      description:
        "One artwork: an app.bsky.feed.post carrying media. Text-only posts are never returned.",
      properties: {
        uri: required(string({ format: "at-uri" })),
        cid: required(string({ format: "cid" })),
        author: required(ref({ ref: "art.ratat.actor.defs#profileViewBasic" })),
        text: string({ maxLength: 3000, maxGraphemes: 300 }),
        media: required(
          array({
            items: union({ refs: [ref({ ref: "#imageView" }), ref({ ref: "#videoView" })] }),
            minLength: 1,
          }),
        ),
        likeCount: integer(),
        replyCount: integer(),
        repostCount: integer(),
        bskyUrl: required(string({ description: "Permalink to the Bluesky post.", format: "uri" })),
        createdAt: required(string({ format: "datetime" })),
        indexedAt: string({ format: "datetime" }),
      },
    }),
  },
});
