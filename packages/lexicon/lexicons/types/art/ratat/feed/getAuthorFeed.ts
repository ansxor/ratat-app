import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as ArtRatatFeedDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"art.ratat.feed.getAuthorFeed",
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
				 * 1-based page number, for numbered pagination. The upstream feed is cursor-based, so the server walks cursors to reach the page; a page past the end of the feed yields the last page. Ignored when `cursor` is given.
				 * @minimum 1
				 * @maximum 100
				 * @default 1
				 */
				"page": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 100)]
					),
					1
				),
				/**
				 * When true, the feed is a random sample of the artist's works rather than a page: `limit` posts drawn without order, no `cursor` or `page` in the response. `cursor` and `page` are ignored.
				 * @default false
				 */
				"sample": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean(), false),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * Absent when the upstream feed is exhausted. A page may hold fewer than `limit` posts — or none — while a cursor remains, because posts that carry no media are dropped after paging; never infer the end from the array's length.
					 */
					"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
					get "feed"() {
						return /*#__PURE__*/ v.array(ArtRatatFeedDefs.postViewSchema)
					},
					/**
					 * The page this response holds. Lower than the requested `page` when the feed ended first. Absent when the request named a `cursor` instead, since a cursor does not say where it sits.
					 */
					"page": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
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
		"art.ratat.feed.getAuthorFeed": mainSchema;
	}
}
