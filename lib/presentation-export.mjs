// Bounded native PresentationML for the Workers runtime. Text stays editable;
// no remote assets, macros, executable input, AI rewrite or external relations.
const a='http://schemas.openxmlformats.org/drawingml/2006/main';
const p='http://schemas.openxmlformats.org/presentationml/2006/main';
const r='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const rel='http://schemas.openxmlformats.org/package/2006/relationships';
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const xml=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const plain=value=>String(value).replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1');
const emu=inches=>Math.round(inches*914400);
const width=12192000,height=6858000;
// Conservative advance allowance for scripts with wide glyphs. Paragraphs
// preserve explicit line breaks; long URLs/tokens also wrap without dropping text.
const advance=c=>/[^\u0000-\u024f]/u.test(c)?2:/[MW@%]/.test(c)?1.4:1;
export function presentationLines(text,limit=76){
 const lines=[];
 for(const paragraph of text.replace(/\t/g,'    ').split(/\r?\n/)){
  let chars=Array.from(paragraph);
  if(!chars.length){lines.push('');continue;}
  while(chars.length){let n=0,size=0,lastSpace=-1;
   while(n<chars.length&&size+advance(chars[n])<=limit){size+=advance(chars[n]);if(chars[n]===' ')lastSpace=n;n++;}
   if(n<chars.length&&lastSpace>n/2)n=lastSpace;
   if(!n)n=1;
   lines.push(chars.slice(0,n).join(''));chars=chars.slice(n);if(chars[0]===' ')chars.shift();
  }
 }
 return lines;
}
function sections(content){
 const result=[];let section={title:'',lines:[]};
 const commit=()=>{if(section.title||section.lines.some(line=>line.trim()))result.push(section);};
 for(const line of content.split(/\r?\n/)){
  const heading=line.match(/^#{1,3}\s+(.+)$/);
  if(heading){commit();section={title:plain(heading[1]),lines:[]};}
  else section.lines.push(plain(line));
 }
 commit();return result;
}
function paragraph(text,size,color,bold=false){
 const firstStrong=text.match(/[A-Za-z\u00c0-\u02af\u0370-\u052f\u0590-\u08ff\u3040-\u9fff]/u)?.[0]||'';
 const rtl=/[\u0590-\u08ff]/u.test(firstStrong);
 return `<a:p><a:pPr algn="${rtl?'r':'l'}"${rtl?' rtl="1"':''}><a:lnSpc><a:spcPts val="${Math.round(size*1.32)}"/></a:lnSpc><a:spcAft><a:spcPts val="0"/></a:spcAft></a:pPr><a:r><a:rPr sz="${size}"${bold?' b="1"':''} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t xml:space="preserve">${xml(text)}</a:t></a:r><a:endParaRPr sz="${size}"/></a:p>`;
}
function textBox(id,name,lines,x,y,w,h,size,color,bold=false){
 return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" rIns="0" tIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${lines.map(line=>paragraph(line,size,color,bold)).join('')}</p:txBody></p:sp>`;
}
const group='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const relations=items=>declaration+`<Relationships xmlns="${rel}">${items.map(([id,type,target])=>`<Relationship Id="${id}" Type="${r}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
export function presentationFiles(title,content){
 const slides=[{cover:true,title:presentationLines(title,64),body:[]}];
 for(const section of sections(content)){
  let heading=presentationLines(section.title||title,76),body=presentationLines(section.lines.join('\n'));
  if(heading.length>2){body=[...heading,'',...body];heading=['Présentation'];}
  if(!body.length)body=[''];
  while(body.length){slides.push({title:heading,body:body.splice(0,12)});if(slides.length>40)throw new RangeError('Cette présentation dépasse 40 diapositives. Réduisez le livrable ou exportez-le en Word.');}
 }
 const types=[['/ppt/presentation.xml','presentationml.presentation.main'],['/ppt/slideMasters/slideMaster1.xml','presentationml.slideMaster'],['/ppt/slideLayouts/slideLayout1.xml','presentationml.slideLayout'],['/ppt/theme/theme1.xml','theme'],['/docProps/core.xml','core-properties']];
 slides.forEach((_,i)=>types.push([`/ppt/slides/slide${i+1}.xml`,'presentationml.slide']));
 const files={
  '[Content_Types].xml':declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+types.map(([path,type])=>`<Override PartName="${path}" ContentType="${type==='core-properties'?'application/vnd.openxmlformats-package.core-properties+xml':type==='theme'?'application/vnd.openxmlformats-officedocument.theme+xml':'application/vnd.openxmlformats-officedocument.'+type+'+xml'}"/>`).join('')+'</Types>',
  '_rels/.rels':declaration+`<Relationships xmlns="${rel}"><Relationship Id="presentation" Type="${r}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="properties" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
  'docProps/core.xml':declaration+`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title><dc:creator>Braand</dc:creator><dc:description>${xml(content)}</dc:description></cp:coreProperties>`,
  'ppt/presentation.xml':declaration+`<p:presentation xmlns:a="${a}" xmlns:r="${r}" xmlns:p="${p}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="master"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="slide${i+1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${width}" cy="${height}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`,
  'ppt/_rels/presentation.xml.rels':relations([['master','slideMaster','slideMasters/slideMaster1.xml'],...slides.map((_,i)=>[`slide${i+1}`,'slide',`slides/slide${i+1}.xml`])]),
  'ppt/slideMasters/slideMaster1.xml':declaration+`<p:sldMaster xmlns:a="${a}" xmlns:r="${r}" xmlns:p="${p}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="layout"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
  'ppt/slideMasters/_rels/slideMaster1.xml.rels':relations([['layout','slideLayout','../slideLayouts/slideLayout1.xml'],['theme','theme','../theme/theme1.xml']]),
  'ppt/slideLayouts/slideLayout1.xml':declaration+`<p:sldLayout xmlns:a="${a}" xmlns:r="${r}" xmlns:p="${p}" type="blank" preserve="1"><p:cSld name="Braand"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels':relations([['master','slideMaster','../slideMasters/slideMaster1.xml']]),
  'ppt/theme/theme1.xml':declaration+`<a:theme xmlns:a="${a}" name="Braand"><a:themeElements><a:clrScheme name="Braand">${[['dk1','182230'],['lt1','FFFFFF'],['dk2','475467'],['lt2','F8FAFC'],['accent1','168FFF'],['accent2','12715B'],['accent3','6941C6'],['accent4','B54708'],['accent5','026AA2'],['accent6','C11574'],['hlink','0066CC'],['folHlink','6941C6']].map(([tag,color])=>`<a:${tag}><a:srgbClr val="${color}"/></a:${tag}>`).join('')}</a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Braand"><a:fillStyleLst>${[1,2,3].map(()=>'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join('')}</a:fillStyleLst><a:lnStyleLst>${[6350,12700,19050].map(w=>`<a:ln w="${w}"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>`).join('')}</a:lnStyleLst><a:effectStyleLst>${[1,2,3].map(()=>'<a:effectStyle><a:effectLst/></a:effectStyle>').join('')}</a:effectStyleLst><a:bgFillStyleLst>${[1,2,3].map(()=>'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join('')}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`,
 };
 slides.forEach((slide,i)=>{
  const shapes=slide.cover?textBox(2,'Titre',slide.title,0.8,1.65,11.7,4.8,2800,'182230',true):textBox(2,'Titre',slide.title,0.8,0.6,11.7,1.2,2600,'182230',true)+textBox(3,'Contenu',slide.body,0.8,2,11.7,4.6,2000,'344054');
  files[`ppt/slides/slide${i+1}.xml`]=declaration+`<p:sld xmlns:a="${a}" xmlns:r="${r}" xmlns:p="${p}"><p:cSld><p:spTree>${group}${shapes}${textBox(4,'Pagination',[`${i+1} / ${slides.length}`],11.5,7,1,0.3,1100,'667085')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  files[`ppt/slides/_rels/slide${i+1}.xml.rels`]=relations([['layout','slideLayout','../slideLayouts/slideLayout1.xml']]);
 });
 return files;
}
