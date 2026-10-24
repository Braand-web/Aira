import {z} from 'zod';
import {AppError} from './core.mjs';
import {modelRateSchema,type ModelRate} from './model-protocol';
import {currentPricingRate} from './model-pricing';

export const MODEL_TASKS=['conversation','orchestration','creative','campaigns','extraction','analysis','review','browser'] as const;
export type ModelTask=typeof MODEL_TASKS[number];
export const MODEL_TIERS=['light','standard','advanced'] as const;
export type ModelTier=typeof MODEL_TIERS[number];
export type RoutingRequest={task:ModelTask;tier?:ModelTier;escalation?:{reason:'validation_failed'|'contradictory_evidence'|'incomplete_result';attempt:1}};
export const REASONING_MODELS={
 sol:{provider:'openai',model:'gpt-6.1-sol'},
 haiku:{provider:'anthropic',model:'claude-haiku-5-5'},
 sonnet:{provider:'anthropic',model:'claude-sonnet-5-5'},
 astra:{provider:'openai',model:'gpt-6-astra'},
 opus:{provider:'anthropic',model:'claude-opus-5-5'},
} as const;
type ModelKey=keyof typeof REASONING_MODELS;
const taskModel:Record<ModelTask,ModelKey>={conversation:'sol',orchestration:'sol',creative:'sonnet',campaigns:'sonnet',extraction:'haiku',analysis:'astra',review:'opus',browser:'sonnet'};
const tierModel:Record<ModelTier,ModelKey>={light:'haiku',standard:'sonnet',advanced:'opus'};
const openRouterModels:Partial<Record<ModelKey,string>>={haiku:'anthropic/claude-haiku-5.5',sonnet:'anthropic/claude-sonnet-5.5',opus:'anthropic/claude-opus-5.5'};
const routingSchema=z.object({task:z.enum(MODEL_TASKS),tier:z.enum(MODEL_TIERS).optional(),escalation:z.object({reason:z.enum(['validation_failed','contradictory_evidence','incomplete_result']),attempt:z.literal(1)}).strict().optional()}).strict();
const entrySchema=z.object({enabled:z.literal(true),transport:z.enum(['direct','openrouter']).default('direct'),rate:modelRateSchema,maxInputTokens:z.number().int().min(1).max(100000),maxOutputTokens:z.number().int().min(128).max(32768)}).strict();
export type RoutedModel={key:ModelKey;provider:'openai'|'anthropic'|'openrouter';model:string;rate:ModelRate;maxInputTokens:number;maxOutputTokens:number;apiKey:string;url:string;headers:Record<string,string>;routing:RoutingRequest};
export function routingEnabled(env:Record<string,string|undefined>){return env.MODEL_ROUTING_ENABLED==='true';}
export function adaptiveRoutingEnabled(env:Record<string,string|undefined>){return routingEnabled(env)&&env.MODEL_ROUTING_POLICY==='adaptive';}
// Selection accepts a server-owned task, never user text, a model name, URL or key.
// One identified validation problem permits one higher-capability attempt. It is
// not an automatic retry policy, especially after a tool has changed a service.
export function routedModel(env:Record<string,string|undefined>,request:RoutingRequest={task:'conversation'},now=Date.now()):RoutedModel{
 const decision=routingSchema.safeParse(request);if(!decision.success)throw new AppError('Contexte de routage invalide.',400,'model_route_invalid');
 const {task,escalation}=decision.data,adaptive=adaptiveRoutingEnabled(env);
 if(decision.data.tier&&!adaptive)throw new AppError('Le routage adaptatif est désactivé.',409,'model_route_invalid');
 const tier=decision.data.tier||(task==='conversation'||task==='orchestration'||task==='extraction'?'light':'standard');
 let key=adaptive?tierModel[tier]:taskModel[task];
 if(escalation){if(adaptive){const index=MODEL_TIERS.indexOf(tier);if(index===MODEL_TIERS.length-1)throw new AppError('La limite de montée en gamme est atteinte.',409,'model_escalation_limit');key=tierModel[MODEL_TIERS[index+1]];}else{if(key==='astra'||key==='opus')throw new AppError('La limite de montée en gamme est atteinte.',409,'model_escalation_limit');key=task==='review'?'opus':'astra';}}
 let catalog:unknown;try{catalog=JSON.parse(env.MODEL_ROUTING_CATALOG_JSON||'{}');}catch{throw new AppError('Catalogue IA invalide.',503,'model_not_configured');}
 const entries=z.record(z.unknown()).safeParse(catalog),parsed=entrySchema.safeParse(entries.success?entries.data[key]:undefined);
 if(!parsed.success)throw new AppError('Le modèle requis et son tarif doivent être configurés.',503,'rate_unverified');
 const definition=REASONING_MODELS[key],entry=parsed.data;
 const provider=entry.transport==='openrouter'?'openrouter':definition.provider;
 const model=provider==='openrouter'?openRouterModels[key]:definition.model;
 if(!model)throw new AppError('Ce modèle n’est pas validé pour ce transport.',503,'model_not_configured');
 entry.rate=currentPricingRate(model,provider,now)||entry.rate;
 const age=now-Date.parse(entry.rate.verifiedAt);
 if(entry.rate.model!==model||entry.rate.provider&&entry.rate.provider!==provider||!Number.isFinite(age)||age<0||age>86400000||provider==='openrouter'&&(typeof entry.rate.fundingFeeBps!=='number'||!Number.isFinite(entry.rate.fundingFeeBps)||entry.rate.fundingFeeBps<0||entry.rate.fundingFeeBps>10000))throw new AppError('Le tarif exact du modèle et le taux de change doivent être vérifiés.',503,'rate_unverified');
 const apiKey=env[provider==='openrouter'?'OPENROUTER_API_KEY':provider==='openai'?'OPENAI_API_KEY':'ANTHROPIC_API_KEY']?.trim();if(!apiKey)throw new AppError('Le fournisseur IA requis n’est pas configuré sur le serveur.',503,'model_not_configured');
 const headers:Record<string,string>=provider==='anthropic'?{'x-api-key':apiKey,'anthropic-version':'2023-06-01','Content-Type':'application/json'}:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json',...(provider==='openrouter'?{'X-OpenRouter-Metadata':'enabled'}:{})};
 return {key,provider,model,rate:{...entry.rate,provider},maxInputTokens:Math.min(entry.maxInputTokens,typeof entry.rate.maxInputTokens==='number'?entry.rate.maxInputTokens:entry.maxInputTokens),maxOutputTokens:entry.maxOutputTokens,apiKey,url:provider==='openrouter'?'https://openrouter.ai/api/v1/messages':provider==='openai'?'https://api.openai.com/v1/responses':'https://api.anthropic.com/v1/messages',headers,routing:{...decision.data,...(adaptive?{tier:escalation?MODEL_TIERS[MODEL_TIERS.indexOf(tier)+1]:tier}:{})}};
}
