import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _followViewSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("art.ratat.graph.getFollows#followView")),
		"createdAt": /*#__PURE__*/ v.datetimeString(),
		/**
		 * The followed DID.
		 */
		"subject": /*#__PURE__*/ v.didString(),
		/**
		 * The follow record's at-uri; delete it to unfollow.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _mainSchema = /*#__PURE__*/ v.query(
	"art.ratat.graph.getFollows",
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
					get "follows"() {
						return /*#__PURE__*/ v.array(followViewSchema)
					},
					/**
					 * Whether the index has walked this actor's follow records at least once. False means the answer may be short, and a caller holding the repo should read it directly; asking marks the actor for a walk, so a later call answers fully.
					 */
					"indexed": /*#__PURE__*/ v.boolean(),
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
		"art.ratat.graph.getFollows": mainSchema;
	}
}
