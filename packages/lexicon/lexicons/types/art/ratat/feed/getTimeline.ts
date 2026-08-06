import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as ArtRatatFeedDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"art.ratat.feed.getTimeline",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * @minimum 1
				 * @maximum 100
				 * @default 30
				 */
				"limit": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 100)]
					),
					30
				),
				/**
				 * 1-based page number. The index is ordered, so a page is an offset; a page past the end of the timeline yields the last page.
				 * @minimum 1
				 * @default 1
				 */
				"page": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1)]
					),
					1
				),
				/**
				 * DID or handle whose art.ratat.graph.follow records build the timeline.
				 */
				"viewer": /*#__PURE__*/ v.actorIdentifierString(),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "feed"() {
						return /*#__PURE__*/ v.array(ArtRatatFeedDefs.postViewSchema)
					},
					/**
					 * The page this response holds. Lower than the requested `page` when the timeline ended first.
					 */
					"page": /*#__PURE__*/ v.integer(),
					/**
					 * Artworks in the whole timeline, which is what sizes the pager.
					 */
					"total": /*#__PURE__*/ v.integer(),
				}
			),
		}
	}
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"art.ratat.feed.getTimeline": mainSchema;
	}
}
