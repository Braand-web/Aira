// Deterministic bounded table processing. No eval, network, shell or formulas.
export const DATA_LIMITS=Object.freeze({rows:500,columns:40,inputBytes:131072,steps:8,cellChars:1000});
const encoder=new TextEncoder(),scale=1000000n;
const fail=message=>{throw new TypeError(message);};
export function tableData(value){
 let columns,rows;
 if(Array.isArray(value)){
  if(value.length>DATA_LIMITS.rows)fail('Les données dépassent 500 lignes.');
  if(!value.every(row=>row&&typeof row==='object'&&!Array.isArray(row)))fail('Un tableau JSON doit contenir des objets simples.');
  columns=[...new Set(value.flatMap(row=>Object.keys(row)))];rows=value.map(row=>columns.map(key=>Object.hasOwn(row,key)?row[key]:null));
 }else{columns=value?.columns;rows=value?.rows;}
 if(!Array.isArray(columns)||!columns.length||columns.length>40||columns.some(c=>typeof c!=='string'||!c.trim()||c.length>80||/[\u0000\uD800-\uDFFF]/u.test(c))||new Set(columns).size!==columns.length)fail('Les colonnes doivent être distinctes, nommées et limitées à 40.');
 if(!Array.isArray(rows)||rows.length>500||rows.some(row=>!Array.isArray(row)||row.length!==columns.length||row.some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&(!Number.isFinite(v)||Number.isInteger(v)&&!Number.isSafeInteger(v))||typeof v==='string'&&(v.length>1000||/[\u0000\uD800-\uDFFF]/u.test(v)))))fail('Lignes invalides : cellules simples uniquement, texte Unicode valide et nombres précis. Fournissez les grands entiers comme texte.');
 if(encoder.encode(JSON.stringify({columns,rows})).length>131072)fail('Les données dépassent 128 Kio.');
 return {columns:[...columns],rows:rows.map(row=>[...row])};
}
export function parseTableCSV(raw,delimiter=','){
 if(typeof raw!=='string'||encoder.encode(raw).length>131072||![',',';','\t'].includes(delimiter))fail('CSV invalide ou trop volumineux.');
 const text=raw.replace(/^\uFEFF/,''),rows=[];let row=[],cell='',quoted=false,closed=false;
 const nextCell=()=>{row.push(cell);cell='';closed=false;if(row.length>40)fail('Le CSV dépasse 40 colonnes.');};
 const nextRow=()=>{nextCell();rows.push(row);row=[];if(rows.length>501)fail('Le CSV dépasse 500 lignes de données.');};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
  else if(c===delimiter)nextCell();
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;nextRow();}
  else if(c==='"'&&!cell&&!closed)quoted=true;
  else if(closed||c==='"')fail('Guillemets CSV mal formés.');
  else cell+=c;
  if(cell.length>1000)fail('Une cellule dépasse 1 000 caractères.');
 }
 if(quoted)fail('Guillemet CSV non fermé.');
 if(cell||row.length||closed||text&&!/[\r\n]$/.test(text))nextRow();
 if(!rows.length)fail('Le CSV est vide.');
 return tableData({columns:rows[0],rows:rows.slice(1)});
}
const empty=value=>value===null||value==='';
export function decimalValue(value,format='dot'){
 if(typeof value==='boolean'||empty(value))fail('Une cellule vide ou booléenne ne constitue pas un nombre.');
 let text=typeof value==='number'?String(value):String(value).trim();
 if(format==='comma'&&typeof value!=='number'){if(text.includes('.'))fail('Format décimal ambigu : le point n’est pas une virgule décimale.');text=text.replace(',','.');}
 if(typeof value==='number'&&Number.isInteger(value)&&!Number.isSafeInteger(value))fail('Entier JSON imprécis : fournissez-le comme texte.');
 if(!/^-?(?:0|[1-9]\d{0,17})(?:\.\d{1,6})?$/.test(text))fail('Nombre ambigu ou hors limites : utilisez une décimale explicite, sans séparateur de milliers, avec au plus six décimales.');
 const negative=text.startsWith('-');if(negative)text=text.slice(1);const [whole,fraction='']=text.split('.');
 const result=BigInt(whole)*scale+BigInt(fraction.padEnd(6,'0'));return negative?-result:result;
}
const decimalText=n=>{const sign=n<0n?'-':'';if(n<0n)n=-n;return sign+String(n/scale)+(n%scale?'.'+String(n%scale).padStart(6,'0').replace(/0+$/,''):'');};
function average(sum,count){const denominator=BigInt(count),negative=sum<0n;let abs=negative?-sum:sum;abs=(abs+denominator/2n)/denominator;return negative?-abs:abs;}
export function analyzeTable(raw,steps=[],numberFormat='dot'){
 if(!Array.isArray(steps)||steps.length>8||!['dot','comma'].includes(numberFormat))fail('Plan d’analyse invalide.');
 const input=tableData(raw);let {columns,rows}=input;const notes=[];
 const column=name=>{const index=columns.indexOf(name);if(index<0)fail('Colonne absente : '+name);return index;};
 for(const step of steps){
  if(!step||typeof step!=='object')fail('Étape invalide.');
  if(step.op==='select'){
   if(!Array.isArray(step.columns)||!step.columns.length||new Set(step.columns).size!==step.columns.length)fail('Sélection de colonnes invalide.');
   const indexes=step.columns.map(column);rows=rows.map(row=>indexes.map(i=>row[i]));columns=[...step.columns];
  }else if(step.op==='filter'){
   const index=column(step.column);if(!['eq','ne','lt','lte','gt','gte','contains','empty','not_empty'].includes(step.operator))fail('Comparaison non autorisée.');
   rows=rows.filter(row=>{const v=row[index];switch(step.operator){case 'eq':return v===step.value;case 'ne':return v!==step.value;case 'contains':return !empty(v)&&String(v).includes(String(step.value));case 'empty':return empty(v);case 'not_empty':return !empty(v);default:{if(empty(v))return false;const left=decimalValue(v,numberFormat),right=decimalValue(step.value,numberFormat);return step.operator==='lt'?left<right:step.operator==='lte'?left<=right:step.operator==='gt'?left>right:left>=right;}}});
  }else if(step.op==='group'){
   if(!Array.isArray(step.by)||step.by.length>3||new Set(step.by).size!==step.by.length||!Array.isArray(step.aggregates)||!step.aggregates.length||step.aggregates.length>8)fail('Regroupement invalide.');
   const by=step.by.map(column),aggregates=step.aggregates.map(item=>{if(!['count','sum','mean','min','max'].includes(item.op)||typeof item.as!=='string'||!item.as.trim()||item.as.length>80)fail('Agrégat invalide.');return {...item,index:item.column===undefined&&item.op==='count'?null:column(item.column)};});
   const nextColumns=[...step.by,...aggregates.map(a=>a.as)];if(new Set(nextColumns).size!==nextColumns.length)fail('Noms de sortie dupliqués.');
   const groups=new Map();if(!by.length)groups.set('[]',{keys:[],items:[]});
   for(const row of rows){const keys=by.map(i=>row[i]),key=JSON.stringify(keys);if(!groups.has(key))groups.set(key,{keys,items:[]});groups.get(key).items.push(row);}
   let ignored=0;
   rows=[...groups.values()].map(group=>[...group.keys,...aggregates.map(item=>{
    const cells=item.index===null?group.items.map(()=>1):group.items.map(row=>row[item.index]);const present=cells.filter(v=>!empty(v));
    if(item.op==='count')return present.length;
    ignored+=cells.length-present.length;if(!present.length)return null;
    const values=present.map(v=>decimalValue(v,numberFormat));let result=0n;
    if(item.op==='sum'||item.op==='mean'){for(const v of values)result+=v;if(item.op==='mean')result=average(result,values.length);}
    else result=values.reduce((best,v)=>item.op==='min'?(v<best?v:best):(v>best?v:best));
    if(result>=10n**24n||result<=-(10n**24n))fail('Le résultat dépasse la limite de 18 chiffres entiers.');
    const text=decimalText(result);return numberFormat==='comma'?text.replace('.',','):text;
   })]);
   if(ignored)notes.push(`${ignored} valeur(s) vide(s) ignorée(s) dans les agrégats numériques ; un groupe sans valeur produit null.`);
   if(aggregates.some(a=>a.op==='mean'))notes.push('Moyennes arrondies à six décimales, au plus proche et à mi-chemin en s’éloignant de zéro.');
   columns=nextColumns;
  }else if(step.op==='sort'){
   const index=column(step.column);if(!['text','number'].includes(step.type)||!['asc','desc'].includes(step.direction))fail('Tri invalide.');
   rows=rows.map((row,i)=>({row,i,key:empty(row[index])?null:step.type==='number'?decimalValue(row[index],numberFormat):String(row[index])})).sort((a,b)=>{const comparison=a.key===b.key?0:a.key===null?-1:b.key===null?1:a.key<b.key?-1:1;return comparison*(step.direction==='desc'?-1:1)||a.i-b.i;}).map(item=>item.row);
  }else if(step.op==='limit'){
   if(!Number.isSafeInteger(step.count)||step.count<0||step.count>500)fail('Limite de lignes invalide.');const removed=Math.max(0,rows.length-step.count);rows=rows.slice(0,step.count);if(removed)notes.push(`${removed} ligne(s) exclue(s) par la limite explicitement demandée.`);
  }else fail('Opération non autorisée.');
 }
 return {columns,rows,inputRows:input.rows.length,outputRows:rows.length,notes};
}
export function tableCSV(table){
 const cell=value=>{const text=value===null?'':String(value),safe=/^[\s\uFEFF\u0000-\u001f]*[=+\-@]/.test(text)?"'"+text:text;return '"'+safe.replaceAll('"','""')+'"';};
 return '\uFEFF'+[table.columns,...table.rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
