import { document, params, query, ref, required, string } from "@atcute/lexicon-doc/builder";

export default document({
  id: "art.ratat.actor.getProfile",
  defs: {
    main: query({
      description: "An artist's profile, hydrated live from the public Bluesky appview. [public]",
      parameters: params({
        properties: {
          actor: required(string({ description: "DID or handle.", format: "at-identifier" })),
        },
      }),
      output: {
        encoding: "application/json",
        schema: ref({ ref: "art.ratat.actor.defs#profileView" }),
      },
      errors: [{ name: "ProfileNotFound" }],
    }),
  },
});
