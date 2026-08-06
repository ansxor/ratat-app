import type * as ComAtprotoLabelDefs from "@atcute/atproto/types/label/defs";

/**
 * Label values as Ratat carries them: the bare strings, with negations already
 * applied. The web app filters on values alone, so the labeler's DID, the
 * signature and the timestamps are all dropped here rather than travelling
 * through the index and the lexicon for nobody to read.
 */
export function labelValues(labels: readonly ComAtprotoLabelDefs.Label[] | undefined): string[] {
  if (!labels || labels.length === 0) return [];

  const applied = new Set<string>();
  for (const label of labels) {
    if (label.neg) applied.delete(label.val);
    else applied.add(label.val);
  }
  return [...applied];
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

/**
 * The self-labels an `app.bsky.feed.post` record carries, which is all a
 * firehose event knows: labeler labels are applied downstream by the appview
 * and only reach us on a hydrated view. A post indexed from jetstream
 * therefore holds the author's own rating until a backfill or a read through
 * the appview fills in the rest.
 */
export function selfLabelValues(record: unknown): string[] {
  const labels = asRecord(asRecord(record)?.["labels"]);
  if (labels?.["$type"] !== "com.atproto.label.defs#selfLabels") return [];

  const values = labels["values"];
  if (!Array.isArray(values)) return [];

  const out: string[] = [];
  for (const entry of values) {
    const val = asRecord(entry)?.["val"];
    if (typeof val === "string" && val.length > 0 && !out.includes(val)) out.push(val);
  }
  return out;
}
