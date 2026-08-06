import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as NetRatatActorDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"net.ratat.actor.searchActorsTypeahead",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * @minimum 1
				 * @maximum 25
				 * @default 8
				 */
				"limit": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 25)]
					),
					8
				),
				/**
				 * Search term, matched against handle and name.
				 */
				"q": /*#__PURE__*/ v.string(),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					get "actors"() {
						return /*#__PURE__*/ v.array(NetRatatActorDefs.profileViewBasicSchema)
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
		"net.ratat.actor.searchActorsTypeahead": mainSchema;
	}
}
