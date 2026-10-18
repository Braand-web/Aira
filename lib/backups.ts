import {config, db, uid} from './server';
import {AppError} from './core.mjs';

// Internal limits for the bounded recovery drill. Not Cloudflare service limits.
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 10000;
const MAX_OBJECTS = 100;
const MAX_TABLES = 100;
type SchemaEntry = {type: string; name: string; sql: string};
type Cell = string | number | null | {blob: string};
type Snapshot = {
  format: 'aira-backup-v1'; id: string; createdAt: number; schema: SchemaEntry[];
  tables: {name: string; rows: Record<string, Cell>[]}[];
  sequences: {name:string;seq:number}[];
  objects: {key: string; bytes: string; sha256: string; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string,string>}[];
};
type BackupBindings = {BUCKET?: R2Bucket; BACKUP_BUCKET?: R2Bucket};
const bindings = () => config() as unknown as BackupBindings;
const identifier = (name: string) => {if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new AppError('Schéma de sauvegarde invalide.',409,'backup_schema_invalid'); return '"' + name + '"';};
const encoder = new TextEncoder();
function toBase64(bytes: Uint8Array) {let out = ''; for (let offset=0;offset<bytes.length;offset+=8192) out += String.fromCharCode(...bytes.subarray(offset,offset+8192)); return btoa(out);}
function fromBase64(value: string) {try {return Uint8Array.from(atob(value), char => char.charCodeAt(0));} catch {throw new AppError('Archive invalide.',409,'backup_invalid');}}
async function digest(bytes: ArrayBuffer) {return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));}

async function backupKey() {
  const key = fromBase64(config().BACKUP_ENCRYPTION_KEY || '');
  if (key.byteLength !== 32) throw new AppError('Clé de sauvegarde AES-256 manquante.',503,'backup_key_missing');
  return crypto.subtle.importKey('raw', key, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}
export function backupReadiness() {
  const c = config(), b = bindings();
  if (c.BACKUP_ENABLED !== 'true') return {ready:false,reason:'backup_disabled'};
  if (!b.BUCKET || !b.BACKUP_BUCKET || b.BUCKET === b.BACKUP_BUCKET) return {ready:false,reason:'separate_backup_bucket_required'};
  if (!c.BACKUP_ENCRYPTION_KEY) return {ready:false,reason:'backup_key_missing'};
  if (c.BACKUP_MAINTENANCE_CONFIRMED !== 'true') return {ready:false,reason:'backup_maintenance_required'};
  return {ready:true,reason:null};
}
async function schema(database: D1Database) {
  const result = await database.prepare("SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name").all<SchemaEntry>();
  if (result.results.filter(row => row.type === 'table').length > MAX_TABLES) throw new AppError('Sauvegarde trop volumineuse pour ce parcours.',409,'backup_too_large');
  for (const row of result.results) {
    identifier(row.name);
    if (!['table','index','trigger'].includes(row.type) || !/^CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|TRIGGER)\b/i.test(row.sql)) throw new AppError('Schéma non pris en charge.',409,'backup_schema_invalid');
  }
  return result.results;
}
function encodeRow(row: Record<string, unknown>): Record<string, Cell> {
  return Object.fromEntries(Object.entries(row).map(([column,value]) => {
    identifier(column);
    if (value === null || typeof value === 'string') return [column,value];
    if (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return [column,value];
    if (value instanceof ArrayBuffer) return [column,{blob:toBase64(new Uint8Array(value))}];
    if (ArrayBuffer.isView(value)) return [column,{blob:toBase64(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))}];
    throw new AppError('Type de donnée non pris en charge par la sauvegarde.',409,'backup_data_unsupported');
  }));
}
async function snapshot(id: string, now: number): Promise<Snapshot> {
  const database = db(), entries = await schema(database), tableNames = entries.filter(entry => entry.type === 'table').map(entry => entry.name);
  const sequenceTable = await database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'").first();
  const queries = tableNames.map(name => database.prepare('SELECT * FROM ' + identifier(name) + ' LIMIT ' + (MAX_ROWS+1)));
  if (sequenceTable) queries.push(database.prepare('SELECT name,seq FROM sqlite_sequence'));
  const results = await database.batch(queries);
  const sequences = sequenceTable ? (results.pop()!.results || []) as {name:string;seq:number}[] : [];
  let count = 0;
  const tables = results.map((result,index) => {
    const rows = (result.results || []) as Record<string,unknown>[];
    count += rows.length;
    if (count > MAX_ROWS) throw new AppError('Sauvegarde trop volumineuse pour ce parcours.',409,'backup_too_large');
    return {name:tableNames[index],rows:rows.map(encodeRow)};
  });
  const source = bindings().BUCKET!;
  const objects: Snapshot['objects'] = [];
  let cursor: string | undefined, size = encoder.encode(JSON.stringify({entries,tables})).byteLength;
  do {
    const listOptions: R2ListOptions & {include:string[]} = {limit:100,cursor,include:['httpMetadata','customMetadata']};
    const page = await source.list(listOptions);
    for (const item of page.objects) {
      if (objects.length >= MAX_OBJECTS || size + item.size * 4/3 > MAX_ARCHIVE_BYTES) throw new AppError('Sauvegarde trop volumineuse pour ce parcours.',409,'backup_too_large');
      const object = await source.get(item.key,{onlyIf:{etagMatches:item.etag}});
      if (!object || !('body' in object)) throw new AppError('Les données ont changé pendant la sauvegarde.',409,'backup_changed');
      const bytes = await object.arrayBuffer();
      if (bytes.byteLength !== item.size) throw new AppError('Les données ont changé pendant la sauvegarde.',409,'backup_changed');
      objects.push({key:item.key,bytes:toBase64(new Uint8Array(bytes)),sha256:await digest(bytes),httpMetadata:object.httpMetadata,customMetadata:object.customMetadata});
      size += Math.ceil(bytes.byteLength * 4/3) + 4096;
    }
    if (page.truncated && (!page.cursor || page.cursor === cursor)) throw new AppError('Pagination de sauvegarde incohérente.',502,'backup_listing_invalid');
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return {format:'aira-backup-v1',id,createdAt:now,schema:entries,tables,sequences,objects};
}
export async function createEncryptedBackup(now = Date.now()) {
  const readiness = backupReadiness();
  if (!readiness.ready) throw new AppError('La sauvegarde nécessite une configuration et une fenêtre de maintenance validées.',503,readiness.reason || 'backup_not_ready');
  const key = await backupKey(), id = uid(), archive = await snapshot(id,now), plain = encoder.encode(JSON.stringify(archive));
  if (plain.byteLength > MAX_ARCHIVE_BYTES) throw new AppError('Sauvegarde trop volumineuse pour ce parcours.',409,'backup_too_large');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('aira-backup-v1:' + id)},key,plain));
  const stored = new Uint8Array(iv.byteLength + cipher.byteLength); stored.set(iv); stored.set(cipher,iv.byteLength);
  const objectKey = 'aira-backups/' + id + '.bin';
  const uploaded = await bindings().BACKUP_BUCKET!.put(objectKey,stored,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}});
  if (!uploaded) throw new AppError('La sauvegarde n’a pas été confirmée.',502,'backup_write_unknown');
  const rows = archive.tables.reduce((total,table) => total + table.rows.length,0);
  await db().prepare("INSERT INTO operations_backups(id,object_key,status,bytes,tables_count,rows_count,objects_count,created_at) VALUES (?,?,'completed',?,?,?,?,?)")
    .bind(id,objectKey,stored.byteLength,archive.tables.length,rows,archive.objects.length,now).run();
  return {id,bytes:stored.byteLength,tables:archive.tables.length,rows,objects:archive.objects.length};
}

// Recovery drill only. There is intentionally no production restore HTTP endpoint.
// Destination must contain no application tables or objects, so no deletion/drop is needed.
export async function restoreEncryptedBackup(id: string, destination: D1Database, targetBucket: R2Bucket) {
  const c = config(), b = bindings();
  if (!['test','staging'].includes(c.APP_ENV || '') || c.BACKUP_RESTORE_ALLOWED !== 'true') throw new AppError('Restauration réservée à un environnement de test explicitement autorisé.',403,'restore_not_allowed');
  if (!/^[a-f0-9-]{36}$/.test(id) || destination === db() || targetBucket === b.BUCKET || targetBucket === b.BACKUP_BUCKET || !b.BACKUP_BUCKET) throw new AppError('Destination de restauration distincte requise.',409,'restore_destination_invalid');
  if ((await schema(destination)).length || (await targetBucket.list({limit:1})).objects.length) throw new AppError('La destination doit être entièrement vide.',409,'restore_destination_not_empty');
  const stored = await b.BACKUP_BUCKET.get('aira-backups/' + id + '.bin');
  if (!stored || stored.size > MAX_ARCHIVE_BYTES+28) throw new AppError('Archive introuvable ou trop volumineuse.',404,'backup_invalid');
  const bytes = new Uint8Array(await stored.arrayBuffer());
  let archive: Snapshot;
  try {
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:encoder.encode('aira-backup-v1:' + id)},await backupKey(),bytes.slice(12));
    archive = JSON.parse(new TextDecoder().decode(plain)) as Snapshot;
  } catch {throw new AppError('L’intégrité ou la clé de l’archive est invalide.',409,'backup_integrity_failed');}
  if (archive.format !== 'aira-backup-v1' || archive.id !== id || !Array.isArray(archive.schema) || !Array.isArray(archive.tables) || !Array.isArray(archive.objects) || archive.tables.length > MAX_TABLES || archive.objects.length > MAX_OBJECTS) throw new AppError('Archive invalide.',409,'backup_invalid');
  const statements: D1PreparedStatement[] = [destination.prepare('PRAGMA defer_foreign_keys = ON')];
  for (const entry of archive.schema.filter(entry => entry.type === 'table')) {
    identifier(entry.name);
    if (!/^CREATE\s+TABLE\b/i.test(entry.sql) || /^CREATE\s+VIRTUAL/i.test(entry.sql)) throw new AppError('Schéma non pris en charge.',409,'backup_schema_invalid');
    statements.push(destination.prepare(entry.sql));
  }
  let rows = 0;
  for (const table of archive.tables) {
    identifier(table.name);
    if (!archive.schema.some(entry => entry.type === 'table' && entry.name === table.name) || !Array.isArray(table.rows) || (rows += table.rows.length) > MAX_ROWS) throw new AppError('Archive invalide.',409,'backup_invalid');
    for (const row of table.rows) {
      const columns = Object.keys(row), values = columns.map(column => {
        identifier(column); const value = row[column];
        if (value && typeof value === 'object' && typeof value.blob === 'string') return fromBase64(value.blob);
        if (value === null || typeof value === 'string' || typeof value === 'number' && Number.isFinite(value)) return value;
        throw new AppError('Archive invalide.',409,'backup_invalid');
      });
      statements.push(destination.prepare(`INSERT INTO ${identifier(table.name)} (${columns.map(identifier).join(',')}) VALUES (${columns.map(() => '?').join(',')})`).bind(...values));
    }
  }
  for (const sequence of archive.sequences || []) {
    if (!archive.tables.some(table => table.name === sequence.name) || !Number.isSafeInteger(sequence.seq) || sequence.seq < 0) throw new AppError('Archive invalide.',409,'backup_invalid');
    statements.push(destination.prepare('UPDATE sqlite_sequence SET seq=? WHERE name=?').bind(sequence.seq,sequence.name));
    statements.push(destination.prepare('INSERT INTO sqlite_sequence(name,seq) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM sqlite_sequence WHERE name=?)').bind(sequence.name,sequence.seq,sequence.name));
  }
  // Recreate financial triggers AFTER rows, so restoring a grant never issues it twice.
  for (const entry of archive.schema.filter(entry => entry.type !== 'table')) {
    if (!['index','trigger'].includes(entry.type) || !/^CREATE\s+(?:UNIQUE\s+)?(?:INDEX|TRIGGER)\b/i.test(entry.sql)) throw new AppError('Archive invalide.',409,'backup_schema_invalid');
    statements.push(destination.prepare(entry.sql));
  }
  const restoredObjects = [];
  for (const object of archive.objects) {
    if (typeof object.key !== 'string' || object.key.length > 2048 || object.key.length < 1) throw new AppError('Archive invalide.',409,'backup_invalid');
    const raw = fromBase64(object.bytes);
    if (await digest(raw.buffer) !== object.sha256) throw new AppError('Objet de sauvegarde altéré.',409,'backup_integrity_failed');
    restoredObjects.push({object,raw});
  }
  // Validate the entire archive before the first write. R2 and D1 cannot share a transaction.
  for (const {object,raw} of restoredObjects) {
    const metadata = {...object.httpMetadata};
    if (metadata.cacheExpiry) metadata.cacheExpiry = new Date(metadata.cacheExpiry);
    const result = await targetBucket.put(object.key,raw,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:metadata,customMetadata:object.customMetadata});
    if (!result) throw new AppError('Restauration incomplète ; conserver la destination pour diagnostic.',502,'restore_incomplete');
  }
  await destination.batch(statements);
  return {id,tables:archive.tables.length,rows,objects:archive.objects.length};
}
