// Independent passwordless authentication. No trusted identity headers from clients.
import {WELCOME_UNITS, WELCOME_TTL} from './welcome-credits.mjs';
type AuthEnv = Pick<Cloudflare.Env, 'DB' | 'APP_ENV' | 'APP_ORIGIN' | 'AUTH_ENABLED' | 'AUTH_HASH_SECRET' | 'RESEND_MODE' | 'RESEND_API_KEY' | 'RESEND_FROM' | 'RESEND_TEST_RECIPIENT' | 'RESEND_LIVE_APPROVED'>;
type Challenge = {id: string; email: string; browser_hash: string; return_to: string};
export type BraandIdentity = {userId: string; email: string; displayName: string; fullName: null};
const LOGIN_COOKIE = '__Host-braand_login';
const SESSION_COOKIE = '__Host-braand_session';
const LEGACY_PREFIX = ['ai', 'ra'].join('');
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const emailPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const text = new TextEncoder();
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function safeAuthReturn(value: string | null) {
  try {
    const u = new URL(value || '/', 'https://braand.invalid');
    if (!value?.startsWith('/') || u.origin !== 'https://braand.invalid' || u.pathname.startsWith('/auth/') || u.pathname.includes('with-chatgpt')) return '/';
    if (u.searchParams.get('auth') === 'sign-in') {u.searchParams.delete('auth'); u.searchParams.delete('return_to');}
    return u.pathname + u.search + u.hash;
  } catch {return '/';}
}
function cookie(headers: Headers, name: string) {
  const cookieHeader = headers.get('cookie') || '';
  const read = (candidate: string) => {
    const values = cookieHeader.split(';').map(c => c.trim()).filter(c => c.startsWith(candidate + '=')).map(c => c.slice(candidate.length + 1));
    return values.length === 1 && tokenPattern.test(values[0]) ? values[0] : null;
  };
  return read(name) ?? read(name.replace('braand', LEGACY_PREFIX));
}
function setCookie(name: string, value: string, age: number) {return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;}
async function readForm(request: Request) {
  const reader=request.body?.getReader(); if (!reader) return null;
  const chunks: Uint8Array[]=[]; let size=0;
  while (true) {const next=await reader.read(); if (next.done) break; size+=next.value.byteLength; if (size>4096) {await reader.cancel(); return null;} chunks.push(next.value);}
  const bytes=new Uint8Array(size); let offset=0; for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new URLSearchParams(new TextDecoder().decode(bytes));
}
async function hash(value: string, env: AuthEnv) {
  if (!env.AUTH_HASH_SECRET || env.AUTH_HASH_SECRET.length < 32) throw new Error('auth_configuration_missing');
  const key = await crypto.subtle.importKey('raw', text.encode(env.AUTH_HASH_SECRET), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return encode(new Uint8Array(await crypto.subtle.sign('HMAC', key, text.encode(value))));
}
function origin(env: AuthEnv) {
  try {const u = new URL(env.APP_ORIGIN || ''); if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) return null; return u.origin;} catch {return null;}
}
function configured(env: AuthEnv) {return env.AUTH_ENABLED === 'true' && !!env.DB && !!origin(env) && (env.AUTH_HASH_SECRET?.length || 0) >= 32;}
function emailReady(env: AuthEnv) {
  if (!configured(env) || !env.RESEND_API_KEY || !emailPattern.test(env.RESEND_FROM || '')) return false;
  return env.RESEND_MODE === 'live' ? env.APP_ENV === 'production' && env.RESEND_LIVE_APPROVED === 'true' : env.RESEND_MODE === 'sandbox' && ['test','staging'].includes(env.APP_ENV || '') && emailPattern.test(env.RESEND_TEST_RECIPIENT || '');
}
function page(title: string, body: string, status = 200, cookies?: string) {
  // Preserve the POST Origin for CSRF checks without sending magic-link paths.
  const headers = new Headers({'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'private, no-store', 'Referrer-Policy':'strict-origin', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});
  if (cookies) headers.set('Set-Cookie', cookies);
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(title)} · Braand</title><link rel="stylesheet" href="/auth.css"><link rel="icon" href="/favicon.svg"></head><body><main><a class="brand" href="/">Braand</a><h1>${escape(title)}</h1>${body}<a class="back" href="/">Revenir à Braand</a></main></body></html>`, {status, headers});
}
function notice(request: Request, title: string, message: string, status = 200) {
  return request.headers.get('accept')?.includes('application/json')
    ? Response.json({title, message}, {status, headers:{'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff'}})
    : page(title, `<p>${escape(message)}</p>`, status);
}
const denied = () => page('Connexion impossible', '<p>Ce lien est expiré, a déjà été utilisé ou appartient à un autre navigateur. Demandez un nouveau lien depuis cet appareil.</p><a class="button" href="/auth/sign-in">Demander un nouveau lien</a>', 400);
function redirect(location: string, cookies?: string) {return new Response(null, {status:303, headers:{Location:location, 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', ...(cookies ? {'Set-Cookie':cookies} : {})}});}
async function rate(env: AuthEnv, category: string, value: string, max: number, period: number, now: number) {
  const slot = Math.floor(now / period), bucket = await hash(`rate:${category}:${slot}:${value}`, env);
  const row = await env.DB!.prepare('INSERT INTO auth_rate_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(bucket, (slot+1)*period, max).first<{count:number}>();
  return !!row;
}
export async function sessionIdentity(headers: Headers, env: AuthEnv, now = Date.now()): Promise<BraandIdentity | null> {
  if (!configured(env)) return null;
  const token = cookie(headers, SESSION_COOKIE); if (!token) return null;
  const row = await env.DB!.prepare('SELECT u.id,u.email FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash('session:' + token, env), now).first<{id:string; email:string}>();
  return row ? {userId:row.id, email:row.email, displayName:row.email, fullName:null} : null;
}
export async function authenticatedRequest(request: Request, env: AuthEnv) {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.startsWith('oai-authenticated-user-') || name.startsWith('x-braand-identity-')) headers.delete(name);
  const user = await sessionIdentity(headers, env);
  if (user) {headers.set('x-braand-identity-id', user.userId); headers.set('x-braand-identity-email', user.email);}
  return new Request(request, {headers});
}
export async function cleanupAuth(env: AuthEnv, now = Date.now()) {
  if (!env.DB) return;
  await env.DB.batch(['auth_challenges','auth_sessions','auth_rate_limits'].map(table => env.DB!.prepare(`DELETE FROM ${table} WHERE expires_at<=?`).bind(now)));
}
export async function handleAuth(request: Request, env: AuthEnv, now = Date.now()): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname;
  if (!path.startsWith('/auth/') && !['/signin-with-chatgpt','/signout-with-chatgpt'].includes(path)) return null;
  if (path.includes('with-chatgpt')) return redirect(path.startsWith('/signin') ? '/auth/sign-in' : '/auth/sign-out');
  if (!configured(env)) return page('Connexion bientôt disponible', '<p>La connexion Braand attend la configuration sécurisée du serveur. Votre brouillon reste sur cet appareil.</p>', 503);
  if (url.origin !== origin(env)) return page('Adresse non autorisée', '<p>Utilisez l’adresse officielle de Braand.</p>', 403);
  if (!['GET','POST'].includes(request.method)) return new Response(null, {status:405, headers:{Allow:'GET, POST'}});
  if (request.method === 'POST' && (request.headers.get('origin') !== origin(env) || request.headers.get('sec-fetch-site') === 'cross-site')) return denied();
  if (request.method === 'POST' && !request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return denied();
  // This bound applies to chunked requests too, including logout requests.
  let form: URLSearchParams | null = null;
  if (request.method === 'POST') {form=await readForm(request); if (!form) return denied();}
  if ((path === '/auth/sign-in' || path === '/auth/form') && request.method === 'GET') {
    const returnTo = safeAuthReturn(url.searchParams.get('return_to'));
    const authenticated = Boolean(await sessionIdentity(request.headers, env, now));
    if (path === '/auth/sign-in') return redirect(authenticated ? returnTo : '/?auth=sign-in&return_to=' + encodeURIComponent(returnTo));
    const headers = new Headers({'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff'});
    if (authenticated) return Response.json({authenticated:true, returnTo}, {headers});
    // Refreshes and other tabs must not invalidate a link that was already sent.
    const browser = cookie(request.headers, LOGIN_COOKIE) || random();
    headers.set('Set-Cookie', setCookie(LOGIN_COOKIE, browser, 600));
    return Response.json({authenticated:false, browser, returnTo}, {headers});
  }
  if (path === '/auth/sign-out') {
    if (request.method === 'GET') return page('Se déconnecter', '<p>Votre travail enregistré restera disponible lors de votre prochaine connexion.</p><form method="post" action="/auth/sign-out"><button type="submit">Confirmer la déconnexion</button></form>');
    const token = cookie(request.headers, SESSION_COOKIE);
    if (token) await env.DB!.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hash('session:' + token, env)).run();
    const response = redirect('/', setCookie(SESSION_COOKIE, '', 0));
    response.headers.append('Set-Cookie', setCookie(SESSION_COOKIE.replace('braand', LEGACY_PREFIX), '', 0));
    response.headers.set('Clear-Site-Data','"storage"');
    return response;
  }
  // Bound bodies before parsing; never log addresses, links or provider payloads.
  if (Number(request.headers.get('content-length') || 0) > 4096) return denied();
  if (path === '/auth/request' && form) {
    if (!emailReady(env)) return notice(request, 'Connexion indisponible', 'L’envoi du lien n’est pas encore configuré. Réessayez plus tard.', 503);
    const email = (form.get('email') || '').trim().toLowerCase(), browser = cookie(request.headers, LOGIN_COOKIE);
    if (!browser || form.get('browser') !== browser || email.length > 254 || !emailPattern.test(email)) return denied();
    const ip = request.headers.get('cf-connecting-ip');
    if (!ip && env.APP_ENV !== 'test') return notice(request, 'Connexion indisponible', 'Réessayez depuis l’adresse officielle de Braand.', 503);
    if (!await rate(env, 'ip', ip || 'offline-fixture', 10, 600_000, now) || !await rate(env, 'global', 'mail', 100, 600_000, now)) return notice(request, 'Patientez un instant', 'Trop de demandes. Réessayez dans quelques minutes.', 429);
    const generic = () => notice(request, 'Consultez votre messagerie', 'Si cette adresse est autorisée, un lien valable dix minutes vous sera envoyé. Ouvrez le lien dans ce navigateur.');
    if (env.RESEND_MODE === 'sandbox' && email !== env.RESEND_TEST_RECIPIENT?.toLowerCase()) return generic();
    if (!await rate(env, 'email', email, 1, 60_000, now)) return generic();
    const token = random(), id = crypto.randomUUID();
    await env.DB!.prepare('INSERT INTO auth_challenges(id,email,token_hash,browser_hash,expires_at,return_to,created_at) VALUES (?,?,?,?,?,?,?)').bind(id, email, await hash('challenge:' + token, env), await hash('browser:' + browser, env), now+600_000, safeAuthReturn(form.get('return_to')), now).run();
    const link = `${origin(env)}/auth/verify?id=${id}&token=${token}`;
    try {
      const response = await fetch('https://api.resend.com/emails', {method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`, 'Content-Type':'application/json', 'Idempotency-Key':`braand-auth/${id}`}, body:JSON.stringify({from:env.RESEND_FROM, to:[email], subject:'Votre lien de connexion Braand', text:`Pour retrouver votre espace Braand, ouvrez ce lien dans le navigateur où vous avez demandé la connexion :\n${link}\nCe lien expire dans dix minutes et ne peut être utilisé qu’une fois. Si vous n’avez rien demandé, ignorez ce message.`}), signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error('email_rejected');
    } catch {
      // Invalidate even an uncertain send. Never resend authentication links blindly.
      await env.DB!.prepare('DELETE FROM auth_challenges WHERE id=?').bind(id).run();
      return notice(request, 'Envoi impossible', 'Le lien n’a pas pu être envoyé. Réessayez dans une minute.', 503);
    }
    return generic();
  }
  if (path === '/auth/verify') {
    const id = form?.get('id') || url.searchParams.get('id') || '', token = form?.get('token') || url.searchParams.get('token') || '', browser = cookie(request.headers, LOGIN_COOKIE);
    if (!/^[a-f0-9-]{36}$/.test(id) || !tokenPattern.test(token) || !browser) return denied();
    const tokenHash = await hash('challenge:' + token, env), browserHash = await hash('browser:' + browser, env);
    if (request.method === 'GET') {
      // Link scanners cannot consume a challenge or create a session.
      const row = await env.DB!.prepare('SELECT id FROM auth_challenges WHERE id=? AND token_hash=? AND browser_hash=? AND expires_at>?').bind(id,tokenHash,browserHash,now).first();
      return row ? page('Confirmez votre connexion', `<p>Ce lien vous connectera à votre espace Braand.</p><form method="post" action="/auth/verify"><input type="hidden" name="id" value="${id}"><input type="hidden" name="token" value="${token}"><button type="submit">Entrer dans mon espace</button></form>`) : denied();
    }
    // Atomic consume: concurrent clicks can produce only one authenticated session.
    const challenge = await env.DB!.prepare('DELETE FROM auth_challenges WHERE id=? AND token_hash=? AND browser_hash=? AND expires_at>? RETURNING id,email,browser_hash,return_to').bind(id,tokenHash,browserHash,now).first<Challenge>();
    if (!challenge) return denied();
    const userId = crypto.randomUUID();
    // Account, personal workspace and welcome grant commit together. Every SELECT
    // is bound to the candidate ID: an existing email cannot receive another grant.
    await env.DB!.batch([
      env.DB!.prepare('INSERT INTO auth_users(id,email,verified_at,created_at) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(userId,challenge.email,now,now),
      env.DB!.prepare("INSERT OR IGNORE INTO organizations(id,name,owner_id,created_at) SELECT id,'Mon entreprise',id,created_at FROM auth_users WHERE id=?").bind(userId),
      env.DB!.prepare("INSERT OR IGNORE INTO organization_members(organization_id,user_id,role) SELECT id,id,'owner' FROM auth_users WHERE id=?").bind(userId),
      env.DB!.prepare("INSERT OR IGNORE INTO workspaces(id,name,created_at,organization_id) SELECT id,'Mon entreprise',created_at,id FROM auth_users WHERE id=?").bind(userId),
      env.DB!.prepare("INSERT OR IGNORE INTO members(id,workspace_id,user_id,role) SELECT id,id,id,'owner' FROM auth_users WHERE id=?").bind(userId),
      env.DB!.prepare('INSERT OR IGNORE INTO billing_claims(user_id,organization_id,day,units,created_at) SELECT id,id,?,?,created_at FROM auth_users WHERE id=?').bind(new Date(now).toISOString().slice(0,10),WELCOME_UNITS,userId),
      env.DB!.prepare("INSERT OR IGNORE INTO credit_lots(id,organization_id,source,source_id,granted,balance,starts_at,expires_at,created_at) SELECT 'free:'||user_id,organization_id,'free',user_id,units,units,created_at,created_at+?,created_at FROM billing_claims WHERE user_id=?").bind(WELCOME_TTL,userId),
    ]);
    const user = await env.DB!.prepare('SELECT id FROM auth_users WHERE email=?').bind(challenge.email).first<{id:string}>();
    if (!user) return denied();
    const session = random();
    await env.DB!.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(await hash('session:' + session, env), user.id, now+604_800_000, now).run();
    const response = redirect(safeAuthReturn(challenge.return_to), setCookie(SESSION_COOKIE, session, 604800));
    response.headers.append('Set-Cookie', setCookie(LOGIN_COOKIE, '', 0)); return response;
  }
  return page('Page introuvable', '<p>Cette page de connexion n’existe pas.</p>', 404);
}
