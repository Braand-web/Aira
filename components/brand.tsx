import {BRAAND_BRAND} from '@/lib/brand.mjs';

/** Relais is the static brand identity; the animated chat companion stays separate. */
export function BrandMark({size=28,className}:{size?:number;className?:string}){
 return <svg className={className} data-brand-symbol="relais" width={size} height={size} viewBox={BRAAND_BRAND.symbolViewBox} fill="currentColor" aria-hidden="true" focusable="false">{BRAAND_BRAND.symbolPaths.map(d=><path key={d} d={d} fillRule="evenodd"/>)}</svg>;
}

export function BrandLogo({height=28,className}:{height?:number;className?:string}){
 return <span className={className} style={{display:'inline-flex',alignItems:'center',minWidth:0}}><svg data-brand-logo="relais" viewBox={BRAAND_BRAND.lockupViewBox} style={{display:'block',width:height*BRAAND_BRAND.lockupRatio,height,flexShrink:0}} aria-hidden="true" focusable="false"><g fill="var(--ds-accent, #4b93ff)">{BRAAND_BRAND.symbolPaths.map(d=><path key={d} d={d} fillRule="evenodd"/>)}</g><g fill="var(--ds-text, currentColor)" transform={`translate(${BRAAND_BRAND.wordX} ${BRAAND_BRAND.wordY}) scale(${BRAAND_BRAND.wordScale})`}>{BRAAND_BRAND.wordmarkPaths.map(d=><path key={d} d={d} fillRule="evenodd"/>)}</g></svg><span className="sr-only" style={{position:"absolute",width:1,height:1,padding:0,margin:-1,overflow:"hidden",clipPath:"inset(50%)",whiteSpace:"nowrap",border:0}}>Braand</span></span>;
}
