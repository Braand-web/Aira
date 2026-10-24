export type EventWriter=(type:string,data:unknown)=>Promise<void>;
export function bufferedAgentEvents(write:EventWriter,delayMs=40,maxChars=256){
 let text='',first=true,timer:ReturnType<typeof setTimeout>|undefined,chain=Promise.resolve();
 const enqueue=(type:string,data:unknown)=>{chain=chain.then(()=>write(type,data));return chain;};
 const flush=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}if(text){const value=text;text='';return enqueue('text_delta',{text:value});}return chain;};
 const emit=async(type:string,data:unknown)=>{
  if(type==='text_delta'&&data&&typeof data==='object'&&'text' in data&&typeof data.text==='string'){
   text+=data.text;if(first||text.length>=maxChars){first=false;await flush();}else if(timer===undefined)timer=setTimeout(()=>{void flush().catch(()=>undefined);},delayMs);return;
  }
  await flush();await enqueue(type,data);
 };
 return {emit,flush};
}
