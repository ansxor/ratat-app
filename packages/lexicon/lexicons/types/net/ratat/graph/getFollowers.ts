import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _followViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("net.ratat.graph.getFollowers#followView")),
		/**
		 * CDN URL, not a blob ref.
		 */
		"avatar": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
		"createdAt": /*#__PURE__*/ v.datetimeString(),
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
		/**
		 * The following account's handle from the index snapshot; absent when the index has not resolved one yet, in which case callers fall back to the DID.
		 */
		"handle": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.handleString()),
		/**
		 * The following account's DID.
		 */
		"subject": /*#__PURE__*/ v.didString(),
		/**
		 * The follow record's at-uri.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _mainSchema = /*#__PURE__*/ v.query(
	"net.ratat.graph.getFollowers",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * DID or handle.
				 */
				"actor": /*#__PURE__*/ v.actorIdentifierString(),
				/**
				 * Opaque cursor from a previous page; omit for the first page.
				 */
				"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * @minimum 1
				 * @maximum 100
				 * @default 100
				 */
				"limit": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 100)]
					),
					100
				),
				/**
				 * Page number for numbered paging, which is what the web's follower list uses. Give page or cursor, not both.
				 */
				"page": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * Absent when the last page has been served.
					 */
					"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
					get "followers"() {
						return /*#__PURE__*/ v.array(followViewSchema)
					},
					/**
					 * The page actually served, which is the last one when paging ran out first.
					 */
					"page": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
					/**
					 * How many followers the index holds for this actor. Present when paged, since numbered paging is what needs a total.
					 */
					"total": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
				}
			),
		}
	}
);
type followView$schematype = typeof _followViewSchema;
type main$schematype = typeof _mainSchema;

export interface followViewSchema extends followView$schematype {}

export interface mainSchema extends main$schematype {}
export const followViewSchema = _followViewSchema as followViewSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface FollowView extends v.InferInput<typeof followViewSchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"net.ratat.graph.getFollowers": mainSchema;
	}
}
