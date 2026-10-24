import type {Metadata} from 'next';
import {LEGAL_PATHS,SITE_ORIGIN} from './legal-policy.mjs';

export function legalPageMetadata(path:string,title:string,description:string):Metadata{
  if(!LEGAL_PATHS.includes(path))throw new Error('Metadata is limited to legal pages');
  const url=SITE_ORIGIN+path;
  return {title:{absolute:title},description,alternates:{canonical:url},robots:{index:false,follow:false},openGraph:{type:'website',locale:'fr_FR',siteName:'Braand',url,title,description}};
}
export function jsonLd(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
export const organization={'@type':'Organization','@id':SITE_ORIGIN+'/#organization',name:'Braand',url:SITE_ORIGIN+'/'};
