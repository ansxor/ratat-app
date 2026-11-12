import { callXrpc } from "$hatk/client";
import { toast } from "$lib/components/Toaster.svelte";
import {
  FOLLOW_COLLECTION,
  LIKE_COLLECTION,
  Mutations,
  type RecordWriter,
} from "$lib/mutations.ts";

export const hatkRecords: RecordWriter = {
  createFollow: (repo, subject) =>
    callXrpc("dev.hatk.createRecord", {
      collection: FOLLOW_COLLECTION,
      repo,
      record: { subject, createdAt: new Date().toISOString() },
    }),
  deleteFollow: (rkey) =>
    callXrpc("dev.hatk.deleteRecord", { collection: FOLLOW_COLLECTION, rkey }).then(() => {}),
  createFollows: (subjects, createdAt) =>
    callXrpc("dev.hatk.applyWrites", {
      writes: subjects.map((subject) => ({
        $type: "dev.hatk.applyWrites#create" as const,
        collection: FOLLOW_COLLECTION,
        value: { subject, createdAt },
      })),
    }).then(() => {}),
  createLike: (repo, subject) =>
    callXrpc("dev.hatk.createRecord", {
      collection: LIKE_COLLECTION,
      repo,
      record: { subject, createdAt: new Date().toISOString() },
    }),
  deleteLike: (rkey) =>
    callXrpc("dev.hatk.deleteRecord", { collection: LIKE_COLLECTION, rkey }).then(() => {}),
};

export const mutations = new Mutations(hatkRecords, (msg) => toast.error(msg));
