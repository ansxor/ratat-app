import { document, object, record, required, string } from "@atcute/lexicon-doc/builder";

export default document({
  id: "art.ratat.graph.follow",
  defs: {
    main: record({
      description:
        "A Ratat follow. Immutable; delete = unfollow. Kept separate from app.bsky.graph.follow so that following an artist here never mutates the viewer's Bluesky graph, and so a Ratat feed stays art-only.",
      key: "tid",
      record: object({
        properties: {
          subject: required(string({ format: "did" })),
          createdAt: required(string({ format: "datetime" })),
        },
      }),
    }),
  },
});
