import {escapeHTML} from "./core.mjs";
import {pageSchema} from "./contracts";
export function renderPage(input:unknown){
 const p=pageSchema.parse(input),e=escapeHTML;
 return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="'+(p.noindex?'noindex,nofollow':'index,follow')+'"><title>'+e(p.title)+'</title><meta name="description" content="'+e(p.description)+'"><style>body{margin:0;font-family:system-ui,sans-serif;background:#fafaf8;color:#1c2425}main{max-width:900px;margin:auto;padding:50px 24px}section{padding:48px 0;border-bottom:1px solid #ddd}h1{font-size:clamp(36px,6vw,62px);line-height:1.1;letter-spacing:-.04em}h2{font-size:28px}p,li{font-size:18px;line-height:1.7;white-space:pre-line}a{display:inline-block;background:'+p.accent+';color:#fff;border-radius:12px;padding:16px 24px;text-decoration:none;font-weight:600}</style></head><body><main>'+p.sections.map((s,i)=>'<section><'+(i===0?'h1':'h2')+'>'+e(s.heading)+'</'+(i===0?'h1':'h2')+'><p>'+e(s.body)+'</p>'+(s.items?'<ul>'+s.items.map(v=>'<li>'+e(v)+'</li>').join("")+'</ul>':'')+(s.type==="hero"||s.type==="cta"?'<a rel="noopener noreferrer" href="'+e(p.cta.url)+'">'+e(p.cta.label)+'</a>':'')+'</section>').join("")+'</main></body></html>';
}

