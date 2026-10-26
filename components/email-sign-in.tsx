"use client";

import {useCallback, useEffect, useRef, useState, type FormEvent} from "react";
import {ArrowUpRight, CheckCircle2, LoaderCircle} from "lucide-react";

type LoginForm = {authenticated: boolean; browser?: string; returnTo: string};

export function EmailSignIn({returnTo}: {returnTo?: string}) {
 const [email, setEmail] = useState("");
 const [intent, setIntent] = useState<"signin" | "signup">("signin");
 const [form, setForm] = useState<LoginForm | null>(null);
 const [error, setError] = useState("");
 const [sending, setSending] = useState(false);
 const [sent, setSent] = useState(false);
 const [revision, setRevision] = useState(0);
 const inFlight = useRef(false);
 const submission = useRef<AbortController | null>(null);
 const emailInput = useRef<HTMLInputElement>(null);

 const prepare = useCallback(async (signal: AbortSignal) => {
  const destination = new URL(window.location.href);
  destination.searchParams.delete("auth");
  destination.searchParams.delete("return_to");
  const response = await fetch("/auth/form?return_to=" + encodeURIComponent(returnTo ?? destination.pathname + destination.search + destination.hash), {credentials:"same-origin", cache:"no-store", signal});
  if (!response.ok) throw new Error("La connexion est indisponible pour le moment. Réessayez.");
  const data: LoginForm = await response.json();
  if (typeof data.returnTo !== "string" || !data.returnTo.startsWith("/") || data.returnTo.startsWith("//")) throw new Error("La connexion n’a pas pu être préparée. Réessayez.");
  if (data.authenticated) {window.location.replace(data.returnTo); return null;}
  if (!data.browser || !/^[A-Za-z0-9_-]{43}$/.test(data.browser)) throw new Error("La connexion n’a pas pu être préparée. Réessayez.");
  return data;
 }, [returnTo]);

 useEffect(() => {
  const controller = new AbortController();
  void prepare(controller.signal).then(data => {if (!controller.signal.aborted) {setForm(data); setError("");}}).catch(() => {if (!controller.signal.aborted) setError("La connexion n’a pas pu être préparée. Vérifiez votre réseau et réessayez.");});
  return () => {controller.abort(); submission.current?.abort();};
 }, [prepare, revision]);

 const submit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (inFlight.current || !form || !email.trim()) return;
  inFlight.current = true;
  setSending(true); setError("");
  const controller = new AbortController(); submission.current = controller;
  try {
   // Renew an expired browser binding before sending, including after a long idle period.
   const current = await prepare(controller.signal);
   if (!current) return;
   const response = await fetch("/auth/request", {method:"POST", credentials:"same-origin", signal:controller.signal, headers:{"Content-Type":"application/x-www-form-urlencoded", Accept:"application/json"}, body:new URLSearchParams({email:email.trim(), browser:current.browser!, return_to:current.returnTo})});
   const data = await response.json().catch(() => null) as {message?: string} | null;
   if (!response.ok) throw new Error(data?.message || "Le lien n’a pas pu être demandé. Réessayez dans une minute.");
   if (!controller.signal.aborted) setSent(true);
  } catch (failure) {
   if (!controller.signal.aborted) setError(failure instanceof Error && !(failure instanceof TypeError) ? failure.message : "Le lien n’a pas pu être demandé. Réessayez.");
  } finally {
   inFlight.current = false;
   if (!controller.signal.aborted) setSending(false);
  }
 };

 return <div className="auth-content" aria-busy={!form && !error || sending}>
  <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M20 4v32M4 20h32M8.7 8.7l22.6 22.6M8.7 31.3 31.3 8.7" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><circle cx="20" cy="20" r="5" fill="currentColor"/></svg></span>
  <h3>Gardons vos idées ensemble.</h3>
  <p>Connectez-vous ou inscrivez-vous avec votre e-mail. Aucun mot de passe à retenir.</p>
  <div className="auth-intents" role="group" aria-label="Choisir une option">
   {([['signin','Se connecter'],['signup','Créer un compte']] as const).map(([value,label])=><button key={value} type="button" className={intent===value?"selected":""} aria-pressed={intent===value} disabled={sending} onClick={()=>{setIntent(value);setSent(false);if(form)setError("");}}>{label}</button>)}
  </div>
  {sent ? <div className="auth-feedback" role="status"><CheckCircle2 size={20} aria-hidden="true"/><div><strong>Consultez votre messagerie</strong><p>Si cette adresse peut être utilisée, un lien vient d’être envoyé.</p><button type="button" className="auth-change-email" onClick={()=>{setSent(false);requestAnimationFrame(()=>emailInput.current?.focus());}}>Utiliser une autre adresse</button></div></div> : <form className="auth-form" onSubmit={submit}>
   <label htmlFor="braand-login-email">Adresse e-mail</label>
   <input ref={emailInput} id="braand-login-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event=>setEmail(event.target.value)} aria-describedby="braand-login-note" disabled={sending} placeholder="vous@exemple.com"/>
   <button type="submit" className="button primary" disabled={!form || sending || !email.trim()}>{sending ? <><LoaderCircle size={16} className="spin" aria-hidden="true"/>Envoi en cours…</> : <>{intent==="signin"?"Recevoir mon lien de connexion":"Créer mon compte"}<ArrowUpRight size={16} aria-hidden="true"/></>}</button>
   {error&&<p className="auth-error" role="alert">{error}</p>}
   {!form&&!error&&<span role="status" className="sr-only">Vérification de votre session…</span>}
   {!form&&error&&<button type="button" className="button secondary" onClick={()=>setRevision(value=>value+1)}>Réessayer</button>}
  </form>}
  <span id="braand-login-note" className="fine-print">Un lien à usage unique vérifie votre adresse. Vous reviendrez à la page ouverte avec votre brouillon.</span>
 </div>;
}
