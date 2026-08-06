import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';

const _profileViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("art.ratat.actor.defs#profileView")),
		"avatar": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
		"banner": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
		/**
		 * Permalink to the Bluesky profile.
		 */
		"bskyUrl": /*#__PURE__*/ v.genericUriString(),
		/**
		 * @maxLength 20000
		 * @maxGraphemes 2000
		 */
		"description": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[
				/*#__PURE__*/ v.stringLength(0, 20000),
				/*#__PURE__*/ v.stringGraphemes(0, 2000)
			]
		)),
		"did": /*#__PURE__*/ v.didString(),
		/**
		 * @maxLength 800
		 * @maxGraphemes 80
		 */
		"displayName": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[
				/*#__PURE__*/ v.stringLength(0, 800),
				/*#__PURE__*/ v.stringGraphemes(0, 80)
			]
		)),
		"followersCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		"followsCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		"handle": /*#__PURE__*/ v.handleString(),
		"indexedAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
		/**
		 * Moderation label values on the account, from its self-labels and from the labelers the Bluesky appview applies. Negations are already resolved away.
		 */
		"labels": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[/*#__PURE__*/ v.stringLength(0, 128)]
		))),
		/**
		 * Posts of every kind in the actor's repo, as Bluesky counts them — not the size of this actor's Ratat portfolio, which holds only posts with media.
		 */
		"postsCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
	}
);
const _profileViewBasicSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("art.ratat.actor.defs#profileViewBasic")),
		/**
		 * CDN URL, not a blob ref.
		 */
		"avatar": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
		"did": /*#__PURE__*/ v.didString(),
		/**
		 * @maxLength 800
		 * @maxGraphemes 80
		 */
		"displayName": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
			/*#__PURE__*/ v.string(),
			[
				/*#__PURE__*/ v.stringLength(0, 800),
				/*#__PURE__*/ v.stringGraphemes(0, 80)
			]
		)),
		"handle": /*#__PURE__*/ v.handleString(),
	}
);
type profileView$schematype = typeof _profileViewSchema;
type profileViewBasic$schematype = typeof _profileViewBasicSchema;

export interface profileViewSchema extends profileView$schematype {}

export interface profileViewBasicSchema extends profileViewBasic$schematype {}
export const profileViewSchema = _profileViewSchema as profileViewSchema;
export const profileViewBasicSchema = _profileViewBasicSchema as profileViewBasicSchema;

export interface ProfileView extends v.InferInput<typeof profileViewSchema> {}

export interface ProfileViewBasic extends v.InferInput<typeof profileViewBasicSchema> {}
