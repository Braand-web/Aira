import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Explicitly export public design sources; never walk the repository or environment.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'public/brand');
const require=createRequire(path.join(process.env.BRAAND_TOOLCHAIN||path.join(root,'node_modules'),'package.json'));
const {zipSync}=require('fflate');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const prefix='braand-relais-v1/';
const files={};
async function add(source,target){const bytes=await fs.readFile(path.join(root,source));files[prefix+target]=/\.(?:css|tsx?|mjs|md|json|svg|txt|html)$/.test(target)?Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n')):bytes;}
const metadata={name:'Braand Relais',version:'1.0.0',updated:'2026-10-30'};
for(const name of ['braand-charte-design-system-v1.pdf','braand-charte-design-system-v1.html','design-tokens.json'])await add('public/brand/'+name,name);
await add('docs/brand/charte-graphique.md','charte-graphique.md');
await add('docs/design-system.md','design-system.md');
await add('docs/brand/LISEZ-MOI.md','LISEZ-MOI.md');
for(const name of (await fs.readdir(out)).filter(n=>/^[a-z0-9-]+\.(svg|png)$/.test(n)).sort())await add('public/brand/'+name,'Logos/'+(name.endsWith('.svg')?'SVG/':'PNG/')+name);
await add('public/favicon.svg','Logos/favicon.svg');
await add('public/favicon.ico','Logos/favicon.ico');
for(const name of ['Manrope.ttf','OFL.txt'])await add('public/fonts/'+name,'Polices/'+name);
for(const name of ['globals.css','design-tokens.css','design-system.css','appearance.css'])await add('app/'+name,'Tokens/'+name);
await add('components/brand.tsx','Composants/components/brand.tsx');
await add('lib/brand.mjs','Composants/lib/brand.mjs');
await add('lib/utils.ts','Composants/lib/utils.ts');
await add('hooks/use-mobile.ts','Composants/hooks/use-mobile.ts');
const primitives=(await fs.readdir(path.join(root,'components/ui'))).filter(n=>/^[a-z0-9-]+\.(tsx|css)$/.test(n)).sort();
for(const name of primitives)await add('components/ui/'+name,'Composants/components/ui/'+name);
for(const name of ['relais.geometry.json'])await add('brand/'+name,'Sources/brand/'+name);
for(const name of ['build-brand-assets.mjs','build-brand-kit.mjs','package-brand-kit.mjs'])await add('scripts/'+name,'Sources/scripts/'+name);
await add('docs/brand/guide-content.mjs','Sources/docs/brand/guide-content.mjs');
await add('vendor/shadcn-tailwind-4.13.0.LICENSE.md','Licences/shadcn-tailwind.LICENSE.md');
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const names=new Set(['react','react-dom','tailwindcss','clsx','tailwind-merge']);
for(const name of primitives){const text=await fs.readFile(path.join(root,'components/ui',name),'utf8');for(const match of text.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)){const source=match[1];if(source.startsWith('.')||source.startsWith('@/'))continue;names.add(source.startsWith('@')?source.split('/').slice(0,2).join('/'):source.split('/')[0]);}}
const dependencies=Object.fromEntries([...names].sort().map(name=>[name,pkg.dependencies?.[name]||pkg.devDependencies?.[name]||'See upstream package requirements']));
files[prefix+'Composants/dependencies.json']=Buffer.from(JSON.stringify({note:'Versions declared by Braand; install only dependencies needed by the selected primitives. Not an autonomous published npm package.',dependencies},null,2)+'\n');
const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>({file:name.slice(prefix.length),bytes:bytes.length,sha256:sha(bytes)}));
files[prefix+'manifest.sha256.json']=Buffer.from(JSON.stringify({...metadata,files:entries},null,2)+'\n');
const fixedDate=new Date('2026-10-30T12:00:00Z');
const zip=zipSync(Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,[bytes,{mtime:fixedDate}]])),{level:9});
const archive='braand-relais-kit-v1.zip';await fs.writeFile(path.join(out,archive),zip);
const pdf=await fs.readFile(path.join(out,'braand-charte-design-system-v1.pdf'));
await fs.writeFile(path.join(out,'kit.json'),JSON.stringify({...metadata,archive:{file:archive,bytes:zip.length,sha256:sha(zip),entries:Object.keys(files).length},guide:{file:'braand-charte-design-system-v1.pdf',pages:24,bytes:pdf.length,sha256:sha(pdf)},primitives:primitives.length},null,2)+'\n');
console.log(JSON.stringify({archive,bytes:zip.length,files:Object.keys(files).length,primitives:primitives.length,sha256:sha(zip)}));
