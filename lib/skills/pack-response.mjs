import {AppError} from '../core.mjs';
import {packedAsset} from './pack-storage.mjs';

/** Only exact manifest members are downloadable, always as inert attachments. */
export async function packAssetResponse(files,reference,storage){
 if(!reference||reference.length>240)throw new AppError('Référence de compétence invalide.',400,'skill_reference_invalid');
 const {bytes,file}=await packedAsset(files,reference,storage);
 const filename=reference.split('/').at(-1)||'ressource';
 const ascii=filename.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100)||'ressource';
 return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(file.bytes),'Content-Disposition':'attachment; filename="'+ascii+'"; filename*=UTF-8\'\''+encodeURIComponent(filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase()),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'}});
}
