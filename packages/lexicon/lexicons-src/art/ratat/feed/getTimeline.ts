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
  id: "art.ratat.feed.getTimeline",
  defs: {
    main: query({
      description:
        "The home gallery: every indexed artwork by an actor the viewer Ratat-follows, newest first. Served from the local index alone, so an artist who is followed but not yet backfilled contributes nothing until they are. [public]",
      parameters: params({
        properties: {
          viewer: required(
            string({
              description: "DID or handle whose art.ratat.graph.follow records build the timeline.",
              format: "at-identifier",
            }),
          ),
          limit: integer({ minimum: 1, maximum: 100, default: 30 }),
          page: integer({
            description:
              "1-based page number. The index is ordered, so a page is an offset; a page past the end of the timeline yields the last page.",
            minimum: 1,
            default: 1,
          }),
        },
      }),
      output: {
        encoding: "application/json",
        schema: object({
          properties: {
            feed: required(array({ items: ref({ ref: "art.ratat.feed.defs#postView" }) })),
            page: required(
              integer({
                description:
                  "The page this response holds. Lower than the requested `page` when the timeline ended first.",
              }),
            ),
            total: required(
              integer({
                description: "Artworks in the whole timeline, which is what sizes the pager.",
              }),
            ),
          },
        }),
      },
      errors: [{ name: "ProfileNotFound" }],
    }),
  },
});
