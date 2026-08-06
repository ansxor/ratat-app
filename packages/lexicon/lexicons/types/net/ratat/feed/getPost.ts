import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as NetRatatFeedDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"net.ratat.feed.getPost",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * DID or handle.
				 */
				"actor": /*#__PURE__*/ v.actorIdentifierString(),
				/**
				 * Record key of the app.bsky.feed.post.
				 */
				"rkey": /*#__PURE__*/ v.string(),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "post"() {
						return NetRatatFeedDefs.postViewSchema
					},
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
		"net.ratat.feed.getPost": mainSchema;
	}
}
