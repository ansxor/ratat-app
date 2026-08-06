import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as NetRatatActorDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query(
	"net.ratat.actor.getProfile",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * DID or handle.
				 */
				"actor": /*#__PURE__*/ v.actorIdentifierString(),
			}
		),
		"output": {
			"type": "lex",
			get "schema"() {
				return NetRatatActorDefs.profileViewSchema
			},
		}
	}
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema['params']> {}
export type $output = v.InferXRPCBodyInput<mainSchema['output']>;
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"net.ratat.actor.getProfile": mainSchema;
	}
}
