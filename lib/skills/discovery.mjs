import {z} from 'zod';
// The principal model can supply reviewed catalog IDs after comparing their
// descriptions in any language. Lexical rank stays a transparent offline fallback;
// no embedding provider or unpriced network request is silently introduced.
export const discoverySchema=z.object({query:z.string().max(300).optional(),category:z.enum(['marketing','creative','documents']).optional(),semanticIds:z.array(z.string().max(64)).max(8).optional()}).strict();
export function normalizeSearch(value){return value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();}
export function lexicalRank(query,text){
 const terms=normalizeSearch(query).match(/[\p{L}\p{N}]+/gu)||[],haystack=normalizeSearch(text);if(!terms.length)return 0;
 return terms.reduce((score,term)=>score+(haystack.includes(term)?1+Math.min(term.length,12)/12:0),0);
}
