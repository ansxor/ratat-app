import {
  document,
  object,
  params,
  query,
  ref,
  required,
  string,
} from "@atcute/lexicon-doc/builder";

export default document({
  id: "art.ratat.feed.getPost",
  defs: {
    main: query({
      description:
        "One artwork addressed the way the web app links to it — by the artist's identifier and the post's record key — hydrated live from the public Bluesky appview. [public]",
      parameters: params({
        properties: {
          actor: required(string({ description: "DID or handle.", format: "at-identifier" })),
          rkey: required(string({ description: "Record key of the app.bsky.feed.post." })),
        },
      }),
      output: {
        encoding: "application/json",
        schema: object({
          properties: {
            post: required(ref({ ref: "art.ratat.feed.defs#postView" })),
          },
        }),
      },
      errors: [
        { name: "ProfileNotFound" },
        {
          name: "PostNotFound",
          description: "No such post, or the post carries no media and is not an artwork.",
        },
      ],
    }),
  },
});
