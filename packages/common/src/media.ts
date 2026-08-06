import type * as AppBskyEmbedImages from "@atcute/bluesky/types/app/embed/images";
import type * as AppBskyEmbedRecordWithMedia from "@atcute/bluesky/types/app/embed/recordWithMedia";
import type * as AppBskyEmbedVideo from "@atcute/bluesky/types/app/embed/video";
import type * as AppBskyFeedDefs from "@atcute/bluesky/types/app/feed/defs";
import type { NetRatatFeedDefs } from "@ratat/lexicon";

import { blobCid, bskyImageUrl, bskyVideoPlaylistUrl, bskyVideoThumbnailUrl } from "./blob.ts";

/** One entry of a `net.ratat.feed.defs#postView`'s media array. */
export type MediaView = NetRatatFeedDefs.PostView["media"][number];

type ImageView = Extract<MediaView, { fullsize: unknown }>;
type VideoView = Extract<MediaView, { playlist: unknown }>;
type AspectRatio = NonNullable<MediaView["aspectRatio"]>;

type EmbedView = NonNullable<AppBskyFeedDefs.PostView["embed"]>;

const imageView = (image: AppBskyEmbedImages.ViewImage): MediaView => ({
  $type: "net.ratat.feed.defs#imageView",
  thumb: image.thumb,
  fullsize: image.fullsize,
  ...(image.alt ? { alt: image.alt } : {}),
  ...(image.aspectRatio ? { aspectRatio: image.aspectRatio } : {}),
});

const videoView = (video: AppBskyEmbedVideo.View): MediaView => ({
  $type: "net.ratat.feed.defs#videoView",
  playlist: video.playlist,
  ...(video.thumbnail ? { thumbnail: video.thumbnail } : {}),
  ...(video.alt ? { alt: video.alt } : {}),
  ...(video.aspectRatio ? { aspectRatio: video.aspectRatio } : {}),
});

/**
 * Media out of an appview-hydrated embed, whose URLs are already resolved.
 * Used by the live read path and by the backfill worker.
 */
export function mediaFromEmbedView(embed: EmbedView | undefined): MediaView[] {
  switch (embed?.$type) {
    case "app.bsky.embed.images#view":
      return (embed as AppBskyEmbedImages.View).images.map(imageView);
    case "app.bsky.embed.video#view":
      return [videoView(embed as AppBskyEmbedVideo.View)];
    case "app.bsky.embed.recordWithMedia#view":
      return mediaFromEmbedView((embed as AppBskyEmbedRecordWithMedia.View).media as EmbedView);
    default:
      return [];
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const aspectRatioOf = (value: unknown): AspectRatio | undefined => {
  const ratio = asRecord(value);
  if (!ratio) return undefined;
  const { width, height } = ratio;
  if (typeof width !== "number" || typeof height !== "number") return undefined;
  if (width <= 0 || height <= 0) return undefined;
  return { width, height } as AspectRatio;
};

const imageFromRecord = (did: string, value: unknown): MediaView | undefined => {
  const entry = asRecord(value);
  if (!entry) return undefined;
  const cid = blobCid(entry["image"]);
  if (!cid) return undefined;
  const alt = asString(entry["alt"]);
  const aspectRatio = aspectRatioOf(entry["aspectRatio"]);
  return {
    $type: "net.ratat.feed.defs#imageView",
    thumb: bskyImageUrl(did, cid, "feed_thumbnail") as ImageView["thumb"],
    fullsize: bskyImageUrl(did, cid, "feed_fullsize") as ImageView["fullsize"],
    ...(alt ? { alt } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
  };
};

const videoFromRecord = (did: string, embed: Record<string, unknown>): MediaView | undefined => {
  const cid = blobCid(embed["video"]);
  if (!cid) return undefined;
  const alt = asString(embed["alt"]);
  const aspectRatio = aspectRatioOf(embed["aspectRatio"]);
  return {
    $type: "net.ratat.feed.defs#videoView",
    playlist: bskyVideoPlaylistUrl(did, cid) as VideoView["playlist"],
    thumbnail: bskyVideoThumbnailUrl(did, cid) as VideoView["thumbnail"],
    ...(alt ? { alt } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
  };
};

/**
 * Media out of a raw `app.bsky.feed.post` record as jetstream delivers it,
 * where embeds carry blob refs instead of URLs. The CDN URLs are rebuilt the
 * way the Bluesky appview builds them, so a post indexed from the firehose and
 * the same post indexed from a backfill agree.
 */
export function mediaFromPostRecord(did: string, record: unknown): MediaView[] {
  const post = asRecord(record);
  return post ? mediaFromRecordEmbed(did, post["embed"]) : [];
}

function mediaFromRecordEmbed(did: string, value: unknown): MediaView[] {
  const embed = asRecord(value);
  switch (embed?.["$type"]) {
    case "app.bsky.embed.images": {
      const images = embed["images"];
      if (!Array.isArray(images)) return [];
      return images
        .map((image) => imageFromRecord(did, image))
        .filter((media): media is MediaView => media !== undefined);
    }
    case "app.bsky.embed.video": {
      const video = videoFromRecord(did, embed);
      return video ? [video] : [];
    }
    case "app.bsky.embed.recordWithMedia":
      return mediaFromRecordEmbed(did, embed["media"]);
    default:
      return [];
  }
}
