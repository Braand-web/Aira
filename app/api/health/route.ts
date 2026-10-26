import {db} from '@/lib/server';
import {env} from 'cloudflare:workers';
import {ensureModelRates} from '@/lib/model-rate-refresh';
import {modelReadiness} from '@/lib/metering';
export async function GET(request:Request) {
  try {
    await db().prepare('SELECT 1 AS ok').first();
    if (new URL(request.url).searchParams.get('check') === 'assistant') {
      await ensureModelRates(env);
      const ready=modelReadiness().ready;
      return Response.json({status:ready?'ok':'unavailable',assistantReady:ready},{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
    }
    return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
