import {
  array,
  boolean,
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
  id: "net.ratat.graph.getFollows",
  defs: {
    main: query({
      description:
        "The net.ratat.graph.follow records an actor holds, newest first, read from the local index. [public]",
      parameters: params({
        properties: {
          actor: required(string({ description: "DID or handle.", format: "at-identifier" })),
          limit: integer({ minimum: 1, maximum: 100, default: 100 }),
          cursor: string({
            description: "Opaque cursor from a previous page; omit for the first page.",
          }),
        },
      }),
      output: {
        encoding: "application/json",
        schema: object({
          properties: {
            follows: required(array({ items: ref({ ref: "#followView" }) })),
            cursor: string({ description: "Absent when the last page has been served." }),
            indexed: required(
              boolean({
                description:
                  "Whether the index has walked this actor's follow records at least once. False means the answer may be short, and a caller holding the repo should read it directly; asking marks the actor for a walk, so a later call answers fully.",
              }),
            ),
          },
        }),
      },
      errors: [{ name: "ProfileNotFound" }],
    }),
    followView: object({
      properties: {
        uri: required(
          string({
            description: "The follow record's at-uri; delete it to unfollow.",
            format: "at-uri",
          }),
        ),
        subject: required(string({ description: "The followed DID.", format: "did" })),
        createdAt: required(string({ format: "datetime" })),
      },
    }),
  },
});
