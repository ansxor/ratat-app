import type * as AppBskyActorDefs from "@atcute/bluesky/types/app/actor/defs";
import type * as AppBskyEmbedImages from "@atcute/bluesky/types/app/embed/images";
import type * as AppBskyEmbedRecordWithMedia from "@atcute/bluesky/types/app/embed/recordWithMedia";
import type * as AppBskyEmbedVideo from "@atcute/bluesky/types/app/embed/video";
import type * as AppBskyFeedDefs from "@atcute/bluesky/types/app/feed/defs";
import type * as AppBskyFeedPost from "@atcute/bluesky/types/app/feed/post";
import { bskyPostUrl, bskyProfileUrl } from "@ratat/common";
import type { ArtRatatActorDefs, ArtRatatFeedDefs } from "@ratat/lexicon";

type Media = ArtRatatFeedDefs.PostView["media"][number];

export const profileViewBasic = (
  author: AppBskyActorDefs.ProfileViewBasic,
): ArtRatatActorDefs.ProfileViewBasic => ({
  did: author.did,
  handle: author.handle,
  ...(author.displayName ? { displayName: author.displayName } : {}),
  ...(author.avatar ? { avatar: author.avatar } : {}),
});

export const profileView = (
  profile: AppBskyActorDefs.ProfileViewDetailed,
): ArtRatatActorDefs.ProfileView => ({
  did: profile.did,
  handle: profile.handle,
  ...(profile.displayName ? { displayName: profile.displayName } : {}),
  ...(profile.description ? { description: profile.description } : {}),
  ...(profile.avatar ? { avatar: profile.avatar } : {}),
  ...(profile.banner ? { banner: profile.banner } : {}),
  ...(profile.followersCount === undefined ? {} : { followersCount: profile.followersCount }),
  ...(profile.followsCount === undefined ? {} : { followsCount: profile.followsCount }),
  ...(profile.postsCount === undefined ? {} : { postsCount: profile.postsCount }),
  bskyUrl: bskyProfileUrl(profile.handle) as ArtRatatActorDefs.ProfileView["bskyUrl"],
  ...(profile.indexedAt ? { indexedAt: profile.indexedAt } : {}),
});

const imageView = (image: AppBskyEmbedImages.ViewImage): Media => ({
  $type: "art.ratat.feed.defs#imageView",
  thumb: image.thumb,
  fullsize: image.fullsize,
  ...(image.alt ? { alt: image.alt } : {}),
  ...(image.aspectRatio ? { aspectRatio: image.aspectRatio } : {}),
});

const videoView = (video: AppBskyEmbedVideo.View): Media => ({
  $type: "art.ratat.feed.defs#videoView",
  playlist: video.playlist,
  ...(video.thumbnail ? { thumbnail: video.thumbnail } : {}),
  ...(video.alt ? { alt: video.alt } : {}),
  ...(video.aspectRatio ? { aspectRatio: video.aspectRatio } : {}),
});

type Embed = NonNullable<AppBskyFeedDefs.PostView["embed"]>;

const mediaOf = (embed: Embed | undefined): Media[] => {
  switch (embed?.$type) {
    case "app.bsky.embed.images#view":
      return (embed as AppBskyEmbedImages.View).images.map(imageView);
    case "app.bsky.embed.video#view":
      return [videoView(embed as AppBskyEmbedVideo.View)];
    case "app.bsky.embed.recordWithMedia#view":
      return mediaOf((embed as AppBskyEmbedRecordWithMedia.View).media as Embed);
    default:
      return [];
  }
};

const postRecord = (record: unknown): AppBskyFeedPost.Main | undefined => {
  if (typeof record !== "object" || record === null) return undefined;
  const candidate = record as { $type?: unknown };
  return candidate.$type === "app.bsky.feed.post" ? (record as AppBskyFeedPost.Main) : undefined;
};

/**
 * Returns undefined for anything that is not a piece of the author's own artwork:
 * a repost, a post whose embed carries no media, or a post we cannot read a
 * creation time from.
 */
export const postView = (
  item: AppBskyFeedDefs.FeedViewPost,
): ArtRatatFeedDefs.PostView | undefined => {
  if (item.reason?.$type === "app.bsky.feed.defs#reasonRepost") return undefined;

  const post = item.post;
  const media = mediaOf(post.embed);
  if (media.length === 0) return undefined;

  const record = postRecord(post.record);
  const createdAt = record?.createdAt ?? post.indexedAt;
  const bskyUrl = bskyPostUrl(post.author.did, post.uri);
  if (!bskyUrl) return undefined;

  return {
    uri: post.uri,
    cid: post.cid,
    author: profileViewBasic(post.author),
    ...(record?.text ? { text: record.text } : {}),
    media: media as ArtRatatFeedDefs.PostView["media"],
    ...(post.likeCount === undefined ? {} : { likeCount: post.likeCount }),
    ...(post.replyCount === undefined ? {} : { replyCount: post.replyCount }),
    ...(post.repostCount === undefined ? {} : { repostCount: post.repostCount }),
    bskyUrl: bskyUrl as ArtRatatFeedDefs.PostView["bskyUrl"],
    createdAt,
    indexedAt: post.indexedAt,
  };
};
