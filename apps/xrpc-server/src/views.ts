import type * as AppBskyActorDefs from "@atcute/bluesky/types/app/actor/defs";
import type * as AppBskyFeedDefs from "@atcute/bluesky/types/app/feed/defs";
import type * as AppBskyFeedPost from "@atcute/bluesky/types/app/feed/post";
import { bskyPostUrl, bskyProfileUrl } from "@ratat/common";
import { mediaFromEmbedView } from "@ratat/common/media";
import type { ArtRatatActorDefs, ArtRatatFeedDefs } from "@ratat/lexicon";

import type { ActorRow, PostRow } from "./store.ts";

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

const postRecord = (record: unknown): AppBskyFeedPost.Main | undefined => {
  if (typeof record !== "object" || record === null) return undefined;
  const candidate = record as { $type?: unknown };
  return candidate.$type === "app.bsky.feed.post" ? (record as AppBskyFeedPost.Main) : undefined;
};

/**
 * Returns undefined for anything that is not a piece of artwork: a post whose
 * embed carries no media, or a post we cannot build a permalink for.
 */
export const artworkView = (
  post: AppBskyFeedDefs.PostView,
): ArtRatatFeedDefs.PostView | undefined => {
  const media = mediaFromEmbedView(post.embed);
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

/**
 * Returns undefined for anything that is not a piece of the author's own
 * artwork: a repost, or anything `artworkView` rejects.
 */
export const postView = (
  item: AppBskyFeedDefs.FeedViewPost,
): ArtRatatFeedDefs.PostView | undefined =>
  item.reason?.$type === "app.bsky.feed.defs#reasonRepost" ? undefined : artworkView(item.post);

type Did = ArtRatatActorDefs.ProfileViewBasic["did"];
type Handle = ArtRatatActorDefs.ProfileViewBasic["handle"];

/** The byline of an indexed post, from the actor snapshot the index holds. */
export const rowProfileViewBasic = (row: ActorRow): ArtRatatActorDefs.ProfileViewBasic => ({
  did: row.did as Did,
  handle: row.handle as Handle,
  ...(row.displayName ? { displayName: row.displayName } : {}),
  ...(row.avatar
    ? { avatar: row.avatar as NonNullable<ArtRatatActorDefs.ProfileView["avatar"]> }
    : {}),
});

/**
 * An indexed row as the lexicon's post view. `media` was stored in view shape,
 * so nothing is rebuilt here; the counts are the mirrored ones.
 */
export const rowPostView = (
  row: PostRow,
  author: ActorRow,
): ArtRatatFeedDefs.PostView | undefined => {
  if (row.media.length === 0) return undefined;
  const bskyUrl = bskyPostUrl(row.did, row.uri);
  if (!bskyUrl) return undefined;

  return {
    uri: row.uri as ArtRatatFeedDefs.PostView["uri"],
    cid: row.cid as ArtRatatFeedDefs.PostView["cid"],
    author: rowProfileViewBasic(author),
    ...(row.text ? { text: row.text } : {}),
    media: row.media as ArtRatatFeedDefs.PostView["media"],
    likeCount: row.likeCount,
    replyCount: row.replyCount,
    repostCount: row.repostCount,
    bskyUrl: bskyUrl as ArtRatatFeedDefs.PostView["bskyUrl"],
    createdAt: row.createdAt.toISOString() as ArtRatatFeedDefs.PostView["createdAt"],
    indexedAt: row.indexedAt.toISOString() as ArtRatatFeedDefs.PostView["indexedAt"],
  };
};
