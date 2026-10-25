// Build first: inspect emitted browser/server files, including optional source maps.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';

const project=path.resolve(import.meta.dirname,'..');
const clientRoot=path.join(project,'dist/client');
const serverRoot=path.join(project,'dist/server');
function files(directory){
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):entry.isFile()?[path.join(directory,entry.name)]:[]);
}
function decodeEscapes(value){
 return value.replace(/\\u\{([a-f0-9]+)\}|\\u([a-f0-9]{4})|\\x([a-f0-9]{2})/giu,(_,wide,narrow,byte)=>String.fromCodePoint(parseInt(wide||narrow||byte,16))).replace(/\\\//gu,'/');
}
function mapText(map){
 assert.ok(map&&typeof map==='object','Emitted source map must be an object');
 return [
  map.sourceRoot||'',
  ...(map.sources||[]),
  ...(map.sourcesContent||[]).filter(value=>typeof value==='string'),
  ...(map.sections||[]).map(section=>mapText(section.map)),
 ].join('\n');
}
function surfaces(file,source){
 const result=[source];
 if(file.endsWith('.map'))result.push(mapText(JSON.parse(source)));
 // Inline maps are browser-visible even without a separate *.map artifact.
 for(const match of source.matchAll(/sourceMappingURL\s*=\s*(data:application\/json[^\s*]+)/gu)){
  const comma=match[1].indexOf(',');
  assert.ok(comma>0,'Malformed inline source map');
  const metadata=match[1].slice(0,comma),payload=match[1].slice(comma+1);
  const decoded=metadata.includes(';base64')?Buffer.from(payload,'base64').toString('utf8'):decodeURIComponent(payload);
  result.push(mapText(JSON.parse(decoded)));
 }
 return result.map(decodeEscapes);
}

// Phrases come from substantive source content, never public skill names or UI labels.
const probes=[
 {label:'adapted retention reference',source:'skills/user-adapted/braand-retention-economics/references/cohorts.md',marker:'Un dénominateur nul ne produit pas un taux nul.'},
 {label:'adapted advertising action reference',source:'skills/user-adapted/braand-campaign-operations/references/live-actions.md',marker:'ne jamais transférer silencieusement les données ou audiences d\'un client à un autre.'},
 {label:'marketing method',source:'skills/vendor/marketing/copywriting/SKILL.md',marker:'second-generation tells such as wisdom-shaped sentences and tidy closers'},
 {label:'marketing reference',source:'skills/vendor/marketing/ad-creative/references/awareness-headlines.md',marker:'A complaint supports the pain angle; it does not substantiate a numerical performance promise.'},
 {label:'design method',source:'skills/vendor/anthropic/frontend-design/SKILL.md',marker:'Spend your boldness in one place.'},
 {label:'original media method',source:'skills/braand/media/braand-media-pipeline/SKILL.md',marker:'Une création média, un export, une publication et un lancement publicitaire sont des résultats distincts'},
 {label:'original motion design reference',source:'skills/braand/media/braand-video-direction/references/motion-design.md',marker:'Une direction minutée ne garantit pas une exécution exacte par un générateur vidéo.'},
 {label:'original document method',source:'skills/braand/documents/braand-xlsx/SKILL.md',marker:'Ne pas convertir automatiquement des dates ambiguës ni fusionner des libellés proches sans justification.'},
 {label:'social moderation method',source:'skills/vendor/social/crisis-and-moderation/SKILL.md',marker:'a crisis is exactly when the agent must NOT act alone.'},
 {label:'original growth strategy',source:'skills/braand/marketing/braand-growth-strategy/SKILL.md',marker:'Une hausse de trafic ne répare pas automatiquement une offre, une conversion ou une rétention faible.'},
];
for(const probe of probes)assert.ok(readFileSync(path.join(project,probe.source),'utf8').includes(probe.marker),`Update the stale corpus probe: ${probe.label}`);
const marketingManifest=JSON.parse(readFileSync(path.join(project,'skills/vendor/marketing/manifest.json'),'utf8'));
const designManifest=JSON.parse(readFileSync(path.join(project,'skills/vendor/anthropic/frontend-design/manifest.json'),'utf8'));
const socialManifest=JSON.parse(readFileSync(path.join(project,'skills/vendor/social/manifest.json'),'utf8'));
const provenanceMarkers=[marketingManifest.source.repository,marketingManifest.source.commit,designManifest.repository,designManifest.commit,socialManifest.source.repository,socialManifest.source.commit];
for(const marker of provenanceMarkers)assert.ok(typeof marker==='string'&&marker.length>=32,'Missing full upstream provenance marker');
const internalPaths=[
 /lib[\\/]+skills[\\/]+content[\\/]+/u,
 /lib[\\/]+skills[\\/]+catalog\.generated\.mjs/u,
 /skills[\\/]+vendor[\\/]+marketing[\\/]+/u,
 /skills[\\/]+vendor[\\/]+social[\\/]+/u,
 /skills[\\/]+vendor[\\/]+anthropic[\\/]+frontend-design[\\/]+/u,
 /skills[\\/]+braand[\\/]+(?:marketing|media|documents)[\\/]+/u,
];

const clientFiles=files(clientRoot).filter(file=>/\.(?:m?js|map)$/u.test(file));
assert.ok(clientFiles.some(file=>/\.m?js$/u.test(file)),'Run npm run build before checking browser skill isolation.');
let sourceMaps=0;
for(const file of clientFiles){
 const source=readFileSync(file,'utf8');
 if(file.endsWith('.map')||source.includes('sourceMappingURL=data:application/json'))sourceMaps++;
 for(const surface of surfaces(file,source)){
  for(const probe of probes)assert.ok(!surface.includes(probe.marker),`Private ${probe.label} prose leaked into ${path.relative(project,file)}`);
  for(const marker of provenanceMarkers)assert.ok(!surface.includes(marker),`Upstream skill provenance leaked into ${path.relative(project,file)}`);
  for(const marker of internalPaths)assert.ok(!marker.test(surface),`Server-only corpus import path leaked into ${path.relative(project,file)}`);
 }
}
console.log(`PASS ${clientFiles.length} browser JavaScript/source-map artifacts contain no selected corpus prose, internal paths or upstream provenance (${sourceMaps} source-map artifacts).`);

const serverFiles=files(serverRoot).filter(file=>/\.m?js$/u.test(file));
assert.ok(serverFiles.length>0,'Run npm run build before checking the server skill corpus.');
const serverSources=serverFiles.map(file=>({file,source:decodeEscapes(readFileSync(file,'utf8'))}));
const dynamicTargets=new Set();
for(const {file,source} of serverSources){
 for(const match of source.matchAll(/\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/gu)){
  if(!match[2].startsWith('.')||match[2].includes('${'))continue;
  const target=path.resolve(path.dirname(file),match[2].split(/[?#]/u)[0]);
  const relative=path.relative(serverRoot,target);
  if(relative&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))dynamicTargets.add(target);
 }
}
for(const probe of probes){
 const matching=serverSources.filter(({source})=>source.includes(probe.marker));
 assert.ok(matching.length>0,`Compiled server corpus is missing the ${probe.label}`);
 assert.ok(matching.some(({file})=>dynamicTargets.has(file)),`The ${probe.label} must be present in a separate dynamically imported server chunk`);
}
console.log(`PASS ${probes.length} corpus probes are compiled into lazily imported server chunks; the browser does not receive them.`);
