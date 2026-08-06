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
  id: "art.ratat.feed.getAuthorFeed",
  defs: {
    main: query({
      description:
        "An artist's portfolio, newest first: their own posts carrying media, hydrated live from the public Bluesky appview. Reposts and text-only posts are excluded. [public]",
      parameters: params({
        properties: {
          actor: required(string({ description: "DID or handle.", format: "at-identifier" })),
          limit: integer({ minimum: 1, maximum: 100, default: 30 }),
          cursor: string({
            description: "Opaque cursor from a previous page; omit for the first page.",
          }),
          page: integer({
            description:
              "1-based page number, for numbered pagination. The upstream feed is cursor-based, so the server walks cursors to reach the page; a page past the end of the feed yields the last page. Ignored when `cursor` is given.",
            minimum: 1,
            maximum: 100,
            default: 1,
          }),
          sample: boolean({
            description:
              "When true, the feed is a random sample of the artist's works rather than a page: `limit` posts drawn without order, no `cursor` or `page` in the response. `cursor` and `page` are ignored.",
            default: false,
          }),
        },
      }),
      output: {
        encoding: "application/json",
        schema: object({
          properties: {
            feed: required(array({ items: ref({ ref: "art.ratat.feed.defs#postView" }) })),
            cursor: string({
              description:
                "Absent when the upstream feed is exhausted. A page may hold fewer than `limit` posts — or none — while a cursor remains, because posts that carry no media are dropped after paging; never infer the end from the array's length.",
            }),
            page: integer({
              description:
                "The page this response holds. Lower than the requested `page` when the feed ended first. Absent when the request named a `cursor` instead, since a cursor does not say where it sits.",
            }),
          },
        }),
      },
      errors: [{ name: "ProfileNotFound" }],
    }),
  },
});
