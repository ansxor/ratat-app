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
  id: "art.ratat.actor.searchActorsTypeahead",
  defs: {
    main: query({
      description:
        "As-you-type actor suggestions, proxied straight to app.bsky.actor.searchActorsTypeahead. Ratat holds no actor search of its own — everyone on Bluesky is findable, whether or not Ratat has indexed them. [public]",
      parameters: params({
        properties: {
          q: required(string({ description: "Search term, matched against handle and name." })),
          limit: integer({ minimum: 1, maximum: 25, default: 8 }),
        },
      }),
      output: {
        encoding: "application/json",
        schema: object({
          properties: {
            actors: required(
              array({ items: ref({ ref: "art.ratat.actor.defs#profileViewBasic" }) }),
            ),
          },
        }),
      },
    }),
  },
});
