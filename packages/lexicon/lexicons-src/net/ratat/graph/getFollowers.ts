import {
  array,
  document,
  integer,
  object,
  params,
  query,
  ref,
  required,
  string,
} from "@atcute/lexicon-doc/builder";

export default document({
  id: "net.ratat.graph.getFollowers",
  defs: {
    main: query({
      description:
        "The net.ratat.graph.follow records pointing at an actor, newest first, read from the local index. [public]",
      parameters: params({
        properties: {
          actor: required(string({ description: "DID or handle.", format: "at-identifier" })),
          limit: integer({ minimum: 1, maximum: 100, default: 100 }),
          page: integer({
            description:
              "Page number for numbered paging, which is what the web's follower list uses. Give page or cursor, not both.",
          }),
          cursor: string({
            description: "Opaque cursor from a previous page; omit for the first page.",
          }),
        },
      }),
      output: {
        encoding: "application/json",
        schema: object({
          properties: {
            followers: required(array({ items: ref({ ref: "#followView" }) })),
            cursor: string({ description: "Absent when the last page has been served." }),
            page: integer({
              description:
                "The page actually served, which is the last one when paging ran out first.",
            }),
            total: integer({
              description:
                "How many followers the index holds for this actor. Present when paged, since numbered paging is what needs a total.",
            }),
          },
        }),
      },
      errors: [{ name: "ProfileNotFound" }],
    }),
    followView: object({
      properties: {
        uri: required(
          string({
            description: "The follow record's at-uri.",
            format: "at-uri",
          }),
        ),
        subject: required(string({ description: "The following account's DID.", format: "did" })),
        createdAt: required(string({ format: "datetime" })),
        handle: string({
          description:
            "The following account's handle from the index snapshot; absent when the index has not resolved one yet, in which case callers fall back to the DID.",
          format: "handle",
        }),
        displayName: string({ maxLength: 800, maxGraphemes: 80 }),
        avatar: string({ description: "CDN URL, not a blob ref.", format: "uri" }),
      },
    }),
  },
});
