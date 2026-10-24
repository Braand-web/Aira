import {z} from 'zod';
import {AppError} from './core.mjs';
import {createResource,getResource,updateResource} from './server';

export const deliverableInput=z.object({title:z.string().trim().min(1).max(160),content:z.string().trim().min(1).max(18000),summary:z.string().trim().min(1).max(600),category:z.enum(['marketing','sales','commerce','content','management']),sources:z.array(z.string().trim().min(1).max(500)).max(12)}).strict();

export async function saveDeliverable(tenant:string,input:unknown){
 const data=deliverableInput.parse(input);
 return createResource(tenant,'deliverable',data.title,{...data,format:'markdown',executionConfirmed:false},'draft');
}

export async function reviseDeliverable(tenant:string,input:unknown){
 const {id,version,...data}=deliverableInput.extend({id:z.string().min(1).max(160),version:z.number().int().positive()}).parse(input),current=await getResource(tenant,id);
 if(current.kind!=='deliverable'||current.status==='deleted')throw new AppError('Livrable introuvable.',404);
 const history=Array.isArray(current.data.history)?current.data.history:[];
 return updateResource(tenant,id,version,{title:data.title,status:'draft',data:{...data,format:'markdown',executionConfirmed:false,history:[...history,{version:current.version,content:current.data.content,at:Date.now()}].slice(-5)}});
}
