import { defineLexiconConfig } from "@atcute/lex-cli";

export default defineLexiconConfig({
  generate: {
    files: ["lexicons-src/**/*.ts"],
    outdir: "lexicons/",
    imports: ["@atcute/atproto", "@atcute/bluesky"],
  },
});
