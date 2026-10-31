import type {PackFiles,PackStorage} from './pack-storage.mjs';
export function packAssetResponse(files:PackFiles,reference:string,storage?:PackStorage):Promise<Response>;
