import type {Resource} from './contracts';
function resource(value:unknown):value is Resource{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const r=value as Record<string,unknown>;
 return typeof r.id==='string'&&typeof r.kind==='string'&&typeof r.title==='string'&&typeof r.status==='string'&&typeof r.version==='number'&&Number.isFinite(r.version)&&typeof r.workspace_id==='string'&&typeof r.created_at==='number'&&typeof r.updated_at==='number'&&r.data!==null&&typeof r.data==='object'&&!Array.isArray(r.data);
}
// Only native artifact envelopes may attach a second resource. Never traverse
// arbitrary connector/provider data or move results across workspace snapshots.
export function toolResultResources(value:unknown,workspaceId:string|undefined):Resource[]{
 if(!workspaceId||!resource(value)||value.workspace_id!==workspaceId)return [];
 const result=[value],file=(value as Resource&{file?:unknown}).file;
 if(value.kind==='deliverable'&&['source-project','data-analysis'].includes(String(value.data.format))&&resource(file)&&file.kind==='file'&&file.workspace_id===workspaceId&&file.id!==value.id)result.push(file);
 return result;
}
