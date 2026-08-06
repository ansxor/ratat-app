import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import * as AppBskyEmbedDefs from "@atcute/bluesky/types/app/embed/defs";
import * as NetRatatActorDefs from "../actor/defs.js";

const _imageViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.ratat.feed.defs#imageView")),
		/**
		 * @maxLength 10000
		 * @maxGraphemes 1000
		 */
		"alt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[
				/*#__PURE__*/ v.stringLength(0, 10000),
				/*#__PURE__*/ v.stringGraphemes(0, 1000)
			]
		)),
		get "aspectRatio"() {
			return /*#__PURE__*/ v.optional(AppBskyEmbedDefs.aspectRatioSchema)
		},
		"fullsize": /*#__PURE__*/ v.genericUriString(),
		"thumb": /*#__PURE__*/ v.genericUriString(),
	}
);
const _postViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.ratat.feed.defs#postView")),
		get "author"() {
			return NetRatatActorDefs.profileViewBasicSchema
		},
		/**
		 * Permalink to the Bluesky post.
		 */
		"bskyUrl": /*#__PURE__*/ v.genericUriString(),
		"cid": /*#__PURE__*/ v.cidString(),
		"createdAt": /*#__PURE__*/ v.datetimeString(),
		"indexedAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
		/**
		 * Moderation label values on this post, from the poster's self-labels and from the labelers the Bluesky appview applies. Negations are already resolved away. Clients filter on these device-side.
		 */
		"labels": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[/*#__PURE__*/ v.stringLength(0, 128)]
		))),
		"likeCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		/**
		 * @minLength 1
		 */
		get "media"() {
			return /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.array(/*#__PURE__*/ v.variant([
					imageViewSchema,
					videoViewSchema
				])),
				[/*#__PURE__*/ v.arrayLength(1)]
			)
		},
		"replyCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		"repostCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		/**
		 * @maxLength 3000
		 * @maxGraphemes 300
		 */
		"text": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[
				/*#__PURE__*/ v.stringLength(0, 3000),
				/*#__PURE__*/ v.stringGraphemes(0, 300)
			]
		)),
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _videoViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.ratat.feed.defs#videoView")),
		/**
		 * @maxLength 10000
		 * @maxGraphemes 1000
		 */
		"alt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[
				/*#__PURE__*/ v.stringLength(0, 10000),
				/*#__PURE__*/ v.stringGraphemes(0, 1000)
			]
		)),
		get "aspectRatio"() {
			return /*#__PURE__*/ v.optional(AppBskyEmbedDefs.aspectRatioSchema)
		},
		/**
		 * HLS manifest URL.
		 */
		"playlist": /*#__PURE__*/ v.genericUriString(),
		"thumbnail": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
	}
);
type imageView$schematype = typeof _imageViewSchema;
type postView$schematype = typeof _postViewSchema;
type videoView$schematype = typeof _videoViewSchema;

export interface imageViewSchema extends imageView$schematype {}

export interface postViewSchema extends postView$schematype {}

export interface videoViewSchema extends videoView$schematype {}
export const imageViewSchema = _imageViewSchema as imageViewSchema;
export const postViewSchema = _postViewSchema as postViewSchema;
export const videoViewSchema = _videoViewSchema as videoViewSchema;

export interface ImageView extends v.InferInput<typeof imageViewSchema> {}

export interface PostView extends v.InferInput<typeof postViewSchema> {}

export interface VideoView extends v.InferInput<typeof videoViewSchema> {}
