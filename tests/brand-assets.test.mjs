import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {BRAAND_BRAND} from '../lib/brand.mjs';

test('Relais uses the selected two-part geometry in the component and all official SVG assets',async()=>{
 const geometry=JSON.parse(await readFile(new URL('../brand/relais.geometry.json',import.meta.url),'utf8'));
 assert.equal(geometry.provenance.selected,'Relais');assert.deepEqual(BRAAND_BRAND.symbolPaths,geometry.symbol.paths);assert.equal(BRAAND_BRAND.symbolPaths.length,2);assert.equal(BRAAND_BRAND.wordmarkPaths.length,6);
 for(const file of ['relais-symbol.svg','relais-symbol-black.svg','relais-symbol-white.svg','relais-logo.svg','relais-logo-dark.svg','relais-logo-black.svg','relais-logo-white.svg']){
  const svg=await readFile(new URL('../public/brand/'+file,import.meta.url),'utf8');
  for(const d of BRAAND_BRAND.symbolPaths)assert.ok(svg.includes(d),file);
  if(file.includes('-logo'))for(const d of BRAAND_BRAND.wordmarkPaths)assert.ok(svg.includes(d),file);
  assert.doesNotMatch(svg,/<script|<foreignObject|\bonload=|\bhref=/i);assert.match(svg,/fill-rule="evenodd"/);
 }
 const favicon=await readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');for(const d of BRAAND_BRAND.symbolPaths)assert.ok(favicon.includes(d));assert.doesNotMatch(favicon,/M24 9v30/);
});

test('the public design kit has verified contents and exports design files only',async()=>{
 const require=createRequire(path.join(process.env.BRAAND_TOOLCHAIN||path.resolve('node_modules'),'package.json'));
 const {unzipSync}=require('fflate');
 const archive=await readFile(new URL('../public/brand/braand-relais-kit-v1.zip',import.meta.url));
 const metadata=JSON.parse(await readFile(new URL('../public/brand/kit.json',import.meta.url),'utf8'));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(archive.length,metadata.archive.bytes);assert.equal(sha(archive),metadata.archive.sha256);
 const files=unzipSync(archive),prefix='braand-relais-v1/';
 const manifest=JSON.parse(Buffer.from(files[prefix+'manifest.sha256.json']).toString());
 assert.equal(Object.keys(files).length,manifest.files.length+1);
 for(const entry of manifest.files){
  assert.doesNotMatch(entry.file,/(?:^|\/)(?:\.env|\.tmp|wrangler|auth-runtime|node_modules)|\.\.\\|\.\.\//i);
  assert.match(entry.file,/^(?:LISEZ-MOI\.md|braand-charte-design-system-v1\.(?:pdf|html)|charte-graphique\.md|design-system\.md|design-tokens\.json|(?:Logos|Polices|Tokens|Composants|Sources|Licences)\/)/);
  const bytes=files[prefix+entry.file];assert.ok(bytes,entry.file);assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256,entry.file);
 }
 for(const name of ['Polices/OFL.txt','Composants/components/brand.tsx','Composants/components/ui/button.tsx','Composants/components/ui/dialog.tsx','Composants/hooks/use-mobile.ts','Logos/SVG/relais-logo-dark.svg','Sources/brand/relais.geometry.json'])assert.ok(files[prefix+name],name);
 for(const name of ['globals.css','design-tokens.css','design-system.css','appearance.css'])assert.equal(sha(files[prefix+'Tokens/'+name]),sha((await readFile(new URL('../app/'+name,import.meta.url),'utf8')).replaceAll('\r\n','\n')));
 assert.equal(Buffer.from(files[prefix+metadata.guide.file]).subarray(0,5).toString(),'%PDF-');
 assert.equal(sha(files[prefix+metadata.guide.file]),metadata.guide.sha256);
});

test('the downloadable icon sizes are real PNG files and the self-hosted font carries its license',async()=>{
 for(const [name,size]of [['apple-touch-icon.png',180],['relais-app-192.png',192],['relais-app-512.png',512],['favicon-32.png',32]]){
  const bytes=await readFile(new URL('../public/brand/'+name,import.meta.url));assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
 }
 const license=await readFile(new URL('../public/fonts/OFL.txt',import.meta.url),'utf8');assert.match(license,/SIL OPEN FONT LICENSE/);assert.match(license,/Manrope/);
 const font=await readFile(new URL('../public/fonts/Manrope.ttf',import.meta.url));assert.equal(font.readUInt32BE(0),0x00010000);
});
