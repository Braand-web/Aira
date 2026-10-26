import {z} from 'zod';
import {AppError} from './core.mjs';
const MODEL_TIERS=['light','standard','advanced'] as const;
type ModelTier=typeof MODEL_TIERS[number];

export type CapacityState={tier:ModelTier;changes:number};
const requestSchema=z.object({tier:z.enum(['standard','advanced']),reason:z.enum(['task_complexity','uncertainty','validation_failed','tool_failure','provider_refusal'])}).strict();
// Cognitive selection belongs to the model. This controller only bounds changes;
// it never examines user text, grants tools, retries a request or changes a budget.
export function requestModelCapacity(current:CapacityState,input:unknown,initialDecision:boolean):CapacityState{
 const request=requestSchema.parse(input),from=MODEL_TIERS.indexOf(current.tier),to=MODEL_TIERS.indexOf(request.tier);
 if(current.changes>=2||to<=from||to>from+1&&!(initialDecision&&current.changes===0&&request.reason==='task_complexity'))throw new AppError('Cette capacité ne peut pas être sélectionnée pour cette étape.',409,'model_escalation_limit');
 return {tier:request.tier,changes:current.changes+1};
}
export const modelCapacityTool={name:'request_model_capacity',description:'Internal capacity selection. Answer simple requests directly with the fast default. Select standard for substantial writing or ordinary multi-step work, advanced only for difficult reasoning, delicate architecture or high-stakes decisions. If uncertain, stay light. Call alone, before writing the answer or doing the complex work; never reveal this internal choice. After work starts, move up only one level for observed uncertainty, validation failure or an actual tool failure. Does not grant permissions, increase budget or retry actions.',input_schema:{type:'object',properties:{tier:{type:'string',enum:['standard','advanced']},reason:{type:'string',enum:['task_complexity','uncertainty','validation_failed','tool_failure']}},required:['tier','reason'],additionalProperties:false}};
export const modelCapacityInstruction='Internal capacity policy: start each new user message with the fast default. Respond immediately to simple questions, extraction, short rewrites and small corrections. For substantial writing or ordinary analysis select standard; for difficult reasoning, delicate code/architecture or high-stakes multi-step decisions select advanced. Use request_model_capacity alone, before user-visible text, only when the gain is clear. This is one decision, not a planning exercise. When in doubt stay light. During work upgrade at most one level after an observed difficulty; do not restart tools or repeat external actions. Keep the same persona, language, instructions, history and permissions. Never announce capacity choices or model/supplier names unless explicitly asked. Each new user message resets to light; do not downgrade repeatedly within a single response.';
