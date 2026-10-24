import {parseSSE} from './core.mjs';
type StreamEvent={event:string;data:unknown;id?:string};
type RunSnapshot={run:{status:string;error?:string};events:{seq:number;type:string;data:unknown}[];nextAfter?:number;hasMore?:boolean};
export async function* recoverChatEvents(stream:ReadableStream<Uint8Array>,readRun:(runId:string,after:number)=>Promise<RunSnapshot>,signal:AbortSignal):AsyncGenerator<StreamEvent>{
 let runId='',after=0,terminal=false,sequential=false;
 try{for await(const event of parseSSE(stream)){if(signal.aborted)throw new DOMException('Arrêté','AbortError');if(event.id&&/^\d+$/.test(event.id)){const seq=Number(event.id);if(seq<=after)continue;after=seq;sequential=true;}if(event.event==='run'&&typeof event.data?.runId==='string')runId=event.data.runId;if(['done','error'].includes(event.event))terminal=true;yield event;}}
 catch(error){if(signal.aborted||!runId||!sequential)throw error;}
 if(terminal)return;if(signal.aborted)throw new DOMException('Arrêté','AbortError');if(!runId||!sequential)throw Error('Flux interrompu avant confirmation. Les résultats reçus sont conservés.');
 for(let attempt=0;attempt<20;attempt++){
  if(signal.aborted)throw new DOMException('Arrêté','AbortError');const snapshot=await readRun(runId,after);
  for(const event of snapshot.events){if(event.seq<=after)continue;after=event.seq;if(['done','error'].includes(event.type))terminal=true;yield {event:event.type,data:event.data,id:String(event.seq)};}
  if(terminal)return;
  if(!snapshot.hasMore&&snapshot.run.status!=='streaming'){if(snapshot.run.status==='completed'){yield {event:'done',data:{runId}};return;}yield {event:'error',data:{message:snapshot.run.error||'Le travail est interrompu. Les résultats enregistrés sont conservés.'}};return;}
  if(snapshot.hasMore)continue;
  await new Promise<void>((resolve,reject)=>{const done=()=>{signal.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,500),abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Arrêté','AbortError'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 }
 throw Error('La récupération du flux a atteint son délai. Les résultats restent enregistrés ; rouvrez la discussion.');
}
