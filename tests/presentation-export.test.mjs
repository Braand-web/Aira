import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationFiles,presentationLines} from '../lib/presentation-export.mjs';
import {renderDocument} from '../lib/document-export.mjs';

test('PPTX uses editable native text, resolves every package relation and preserves evidence',()=>{
 const files=presentationFiles('Bilan & priorités','## Ventes\nDonnées fictives : 4 900 FCFA.\n## Sources\nhttps://example.com/source?x=1&y=2');
 assert.ok(files['ppt/slides/slide1.xml']);assert.ok(files['ppt/slides/slide3.xml']);
 for(const [path,xml]of Object.entries(files)){
  assert.doesNotMatch(xml,/TargetMode="External"|<a:blip|vbaProject|javascript:/);
  if(!path.endsWith('.rels'))continue;
  for(const match of xml.matchAll(/Target="([^"]+)"/g)){
   const base=path==='_rels/.rels'?'':path.replace(/_rels\/[^/]+\.rels$/,'');
   const parts=(base+match[1]).split('/'),resolved=[];
   for(const part of parts){if(part==='..')resolved.pop();else if(part!=='.')resolved.push(part);}
   assert.ok(files[resolved.join('/')],`${path} has missing part ${match[1]}`);
  }
 }
 assert.match(files['docProps/core.xml'],/4 900 FCFA/);
 assert.match(files['ppt/slides/slide3.xml'],/https:\/\/example.com\/source\?x=1&amp;y=2/);
 assert.match(files['ppt/slides/slide2.xml'],/<a:t xml:space="preserve">Données fictives/);
 assert.match(files['ppt/presentation.xml'],/cx="12192000" cy="6858000"/);
 assert.equal(renderDocument('pptx','Bilan','Texte').mime,'application/vnd.openxmlformats-officedocument.presentationml.presentation');
});

test('PPTX paginates long text without silent loss, script clipping or executable links',()=>{
 const rows=Array.from({length:30},(_,i)=>`Mesure-${i} : une valeur à vérifier.`);
 const files=presentationFiles('Bilan',rows.join('\n')),slides=Object.entries(files).filter(([path])=>/^ppt\/slides\/slide\d+\.xml$/.test(path));
 assert.equal(slides.length,4);const text=slides.map(([,xml])=>xml).join('');
 for(const row of rows)assert.equal(text.split(row).length-1,1);
 for(const [,slide]of slides)assert.ok((slide.match(/name="Contenu"/g)||[]).length<=1);
 assert.deepEqual(presentationLines('界'.repeat(39)),['界'.repeat(38),'界']);
 const rtl=presentationFiles('مرحبا','## خطوات\nالعربية محفوظة');assert.match(rtl['ppt/slides/slide2.xml'],/algn="r" rtl="1"/);
 assert.throws(()=>presentationFiles('Titre','Ligne\n'.repeat(470)),/40 diapositives/);
 const untrusted=presentationFiles('<script>','<img onerror="x">\n=HYPERLINK("x")');
 assert.doesNotMatch(untrusted['ppt/slides/slide2.xml'],/<img|<script|<f>/);
 assert.match(untrusted['ppt/slides/slide2.xml'],/&lt;img/);
});
