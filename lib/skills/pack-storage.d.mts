export type PackFile={sha256:string;bytes:number;text:boolean;mime:string};
export type PackStorage={get:(key:string)=>Promise<{size:number;arrayBuffer:()=>Promise<ArrayBuffer>}|null>};
export type PackFiles=Record<string,PackFile>;
export const PACK_PREFIX:string;
export const MAX_PACK_ASSET_BYTES:number;
export function packFile(files:PackFiles,reference:string):PackFile;
export function packedAsset(files:PackFiles,reference:string,storage?:PackStorage):Promise<{file:PackFile;bytes:ArrayBuffer}>;
export function loadPackedReference(id:string,files:PackFiles,reference?:string,storage?:PackStorage):Promise<Record<string,string>>;
