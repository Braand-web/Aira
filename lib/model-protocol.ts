import {z} from 'zod';

export const modelRateSchema=z.object({
 model:z.string(),input:z.number().finite().nonnegative(),output:z.number().finite().nonnegative(),
 cacheWrite:z.number().finite().nonnegative(),cacheRead:z.number().finite().nonnegative(),
 usdXaf:z.number().finite().positive(),overheadXaf:z.number().finite().nonnegative(),verifiedAt:z.string(),
 cacheWriteHour:z.number().optional(),fundingFeeBps:z.number().optional(),provider:z.string().optional()
}).passthrough();
export type ModelRate=z.infer<typeof modelRateSchema>;
export type ModelMessage={role:string;content:unknown};
export type ModelUsage=Record<string,unknown>;
export type ModelCostRow={provider:string;status:string;usage:string|null;cost_xaf:number|null;rate?:string};

export const modelRecordSchema=z.record(z.unknown());
export const modelEventSchema=z.object({type:z.string()}).passthrough();
// Preserve unrecognized blocks and metadata so native provider protocol fields
// (including redacted thinking, citations and signatures) survive the next turn.
export const modelBlockSchema=z.object({
 type:z.string(),text:z.string().optional(),thinking:z.string().optional(),signature:z.string().optional(),
 id:z.string().optional(),name:z.string().optional(),input:z.unknown().optional()
}).passthrough().superRefine((block,context)=>{
 if(block.type==='tool_use'&&(typeof block.id!=='string'||typeof block.name!=='string'))context.addIssue({code:z.ZodIssueCode.custom,message:'Tool block identity is missing.'});
});
export type ModelContentBlock=z.infer<typeof modelBlockSchema>;
export type ModelToolUseBlock=ModelContentBlock&{type:'tool_use';id:string;name:string;input?:unknown};
export function isModelToolUse(block:ModelContentBlock):block is ModelToolUseBlock{return block.type==='tool_use'&&typeof block.id==='string'&&typeof block.name==='string';}
export const modelBlockStartSchema=z.object({index:z.number().int().nonnegative(),content_block:modelBlockSchema}).passthrough();
export const modelBlockStopSchema=z.object({index:z.number().int().nonnegative()}).passthrough();
const modelDeltaSchema=z.object({type:z.string(),text:z.string().optional(),partial_json:z.string().optional(),thinking:z.string().optional(),signature:z.string().optional()}).passthrough().superRefine((delta,context)=>{
 const fields:Record<string,string>={text_delta:'text',input_json_delta:'partial_json',thinking_delta:'thinking',signature_delta:'signature'};
 const field=fields[delta.type];if(field&&typeof delta[field]!=='string')context.addIssue({code:z.ZodIssueCode.custom,message:'Model delta payload is missing.'});
});
export const modelBlockDeltaSchema=z.object({index:z.number().int().nonnegative(),delta:modelDeltaSchema}).passthrough();
