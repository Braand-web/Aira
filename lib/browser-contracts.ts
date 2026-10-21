// Public DTOs deliberately exclude provider session IDs, CDP URLs and profile contents.
export type BrowserStatus = 'draft'|'queued'|'running'|'awaiting_approval'|'awaiting_login'|'paused'|'completed'|'uncertain'|'failed'|'cancelled'|'expired';
export type BrowserCommand = {
  kind:'navigate'|'click'|'fill'|'press'|'select'|'scroll'|'new_tab'|'select_tab'|'close_tab'|'upload'|'pointer'|'type';
  pageId?:string; observationId?:string; targetRef?:string; value?:string; key?:string; url?:string;
  x?:number; y?:number; deltaY?:number; fileId?:string;
};
export type BrowserTab = {id:string;title:string;url:string};
export type BrowserElement = {ref:string;role:string;name:string;inputType?:string};
export type BrowserObservation = {id:string;pageId:string;url:string;title:string;tabs:BrowserTab[];elements:BrowserElement[];text:string;fingerprint:string;capturedAt:number};
export type BrowserActionDTO = {id:string;version:number;status:string;command:BrowserCommand;description:string;expiresAt:number};
export type BrowserSessionDTO = {
  id:string;version:number;status:BrowserStatus;objective:string;conversationId:string|null;
  allowedDomains:string[];url:string;title:string;tabs:BrowserTab[];control:'agent'|'human';
  maxCredits:number;maxActions:number;maxSeconds:number;actionsUsed:number;secondsUsed:number;
  createdAt:number;updatedAt:number;expiresAt:number;pendingAction:BrowserActionDTO|null;
  observation:BrowserObservation|null;captureId:string|null;resultReview?:{summary:string;proposedAt:number}|null;lastError:string|null;profileId:string|null;
};
export type BrowserProfileDTO = {id:string;name:string;updatedAt:number;expiresAt:number};
export type BrowserEventDTO = {seq:number;type:string;status:string;domain:string|null;createdAt:number};
export type BrowserArtifactDTO = {id:string;kind:'capture'|'download';name:string;mime:string;size:number;createdAt:number;expiresAt:number;fileId:string|null};
export type BrowserReadiness = {ready:boolean;reasons:string[];limits:{maxActions:number;maxSeconds:number;humanWaitSeconds:number}};
export type BrowserReceipt = {sessionId:string;status:'complete'|'unknown';milliseconds?:number;source:'provider_history'};
export type BrowserDownload = {name:string;mime:string;bytes:Uint8Array};
export interface BrowserDriver {
 receipt(sessionId:string):Promise<BrowserReceipt>;
  open(input:{allowedDomains:string[];storageState?:string}):Promise<{sessionId:string}>;
  observe(sessionId:string,pageId?:string):Promise<BrowserObservation>;
  command(sessionId:string,command:BrowserCommand,file?:BrowserDownload):Promise<{observation:BrowserObservation;download?:BrowserDownload}>;
  capture(sessionId:string,pageId?:string):Promise<Uint8Array>;
  storageState(sessionId:string):Promise<string>;
  close(sessionId:string):Promise<BrowserReceipt>;
}
