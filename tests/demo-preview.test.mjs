import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { DEMO_ASSETS, DEMO_FILES, DEMO_WORKSPACE_ID, seedDemo } from "../scripts/demo/seed.mjs";

const migrationsDirectory = new URL("../drizzle/", import.meta.url);
const migrations = readdirSync(migrationsDirectory).filter(name => name.endsWith(".sql")).sort()
  .map(name => readFileSync(new URL(name, migrationsDirectory), "utf8"));

function database(t) {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const migration of migrations) sql.exec(migration);
  t.after(() => sql.close());
  return sql;
}

test("the local demo seeds a navigable, isolated workspace and is idempotent", t => {
  const sql = database(t);
  const now = Date.now();
  const first = seedDemo(sql, { now });
  const tables = ["resources", "messages", "runs", "files", "credit_lots", "credit_holds", "credit_allocations", "credit_ledger", "billing_meter"];
  const counts = () => tables.map(table => [table, sql.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count]);
  const before = counts();
  const second = seedDemo(sql, { now: now + 60_000 });
  assert.deepEqual(second, first, "reopening the demo must preserve its original timestamps and data");
  assert.deepEqual(counts(), before, "reopening must not duplicate content or billing ledger rows");
  assert.equal(sql.prepare("SELECT COUNT(*) count FROM resources").get().count, 27);
  assert.equal(sql.prepare("SELECT COUNT(*) count FROM resources WHERE kind='conversation'").get().count, 5);
  assert.equal(sql.prepare("SELECT COUNT(*) count FROM files WHERE status='ready'").get().count, 3);
  assert.deepEqual(sql.prepare("PRAGMA foreign_key_check").all(), []);
  for (const id of first.conversations) {
    const messages = sql.prepare("SELECT m.role,m.content,r.status run_status FROM messages m LEFT JOIN runs r ON r.id=m.run_id WHERE m.conversation_id=? AND m.workspace_id=? ORDER BY m.created_at").all(id, DEMO_WORKSPACE_ID);
    assert.ok(messages.some(message => message.role === "user"));
    assert.ok(messages.some(message => message.role === "assistant" && message.run_status === "completed"));
    for (const message of messages) assert.ok(JSON.parse(message.content).some(block => block.type === "text" && block.text.trim()));
  }
  assert.equal(sql.prepare("SELECT COUNT(*) count FROM resources WHERE workspace_id!=?").get(DEMO_WORKSPACE_ID).count, 0);
});

test("demo credits reconcile through the real reserve and settlement triggers", t => {
  const sql = database(t);
  seedDemo(sql);
  const wallet = sql.prepare("SELECT SUM(granted) granted,SUM(balance) balance,SUM(reserved) reserved FROM credit_lots").get();
  const consumed = sql.prepare("SELECT SUM(units) units FROM credit_ledger WHERE kind='consume'").get().units;
  assert.deepEqual({ ...wallet }, { granted: 60000, balance: 43850, reserved: 0 });
  assert.equal(consumed, 16150);
  assert.equal(wallet.granted - consumed, wallet.balance);
  assert.equal(sql.prepare("SELECT COUNT(*) count FROM credit_allocations WHERE state!='settled' OR charged!=units").get().count, 0);
  assert.equal(sql.prepare("SELECT COUNT(*) count FROM credit_holds WHERE status!='settled' OR actual!=units").get().count, 0);
  for (const table of ["billing_orders", "billing_invoices", "connections", "connector_actions", "durable_missions", "provider_usage"]) {
    assert.equal(sql.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count, 0, `${table} must not suggest a real transaction or external action`);
  }
  assert.equal(sql.prepare("SELECT COUNT(*) count FROM resources WHERE kind='proposal'").get().count, 0);
});

test("demo files and media point to the exact local bytes and asset whitelist", t => {
  const sql = database(t);
  const demo = seedDemo(sql);
  assert.equal(DEMO_FILES.length, 3);
  for (const file of DEMO_FILES) {
    const record = sql.prepare("SELECT * FROM files WHERE id=?").get(file.id);
    const resource = sql.prepare("SELECT data FROM resources WHERE id=? AND kind='file'").get(file.id);
    const data = JSON.parse(resource.data);
    assert.match(file.storageKey, /^braand_local_preview\/demo\/files\/[a-z-]+\.(?:md|csv|txt)$/u);
    assert.equal(file.size, Buffer.byteLength(file.content, "utf8"));
    assert.equal(file.sha256, createHash("sha256").update(file.content, "utf8").digest("hex"));
    assert.equal(record.storage_key, file.storageKey);
    assert.equal(record.size_bytes, file.size);
    assert.equal(record.detected_mime, file.mime);
    assert.equal(record.sha256, file.sha256);
    assert.equal(data.text, file.content);
    assert.equal(data.key, record.storage_key);
  }
  const storage = sql.prepare("SELECT SUM(quantity) bytes FROM billing_meter WHERE kind='storage'").get().bytes;
  assert.equal(storage, DEMO_FILES.reduce((sum, file) => sum + file.size, 0));
  const media = sql.prepare("SELECT data FROM resources WHERE kind='media'").all();
  const expected = new Set(DEMO_ASSETS.map(name => `/demo-assets/${name}.svg`));
  assert.equal(media.length, 6);
  assert.deepEqual(new Set(demo.assets), expected);
  for (const row of media) {
    const images = JSON.parse(row.data).output.images;
    assert.equal(images.length, 1);
    assert.ok(expected.delete(images[0].url), "each media card should use one unique, locally served asset");
  }
  assert.equal(expected.size, 0);
});

test("seeding refuses an existing non-demo workspace without changing its schema or data", t => {
  const sql = database(t);
  sql.prepare("INSERT INTO organizations(id,name,owner_id,created_at) VALUES (?,?,?,?)").run("existing-org", "Keep existing data", "existing-owner", Date.now());
  const schema = sql.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY type,name").all();
  const organizations = sql.prepare("SELECT * FROM organizations").all();
  const changes = sql.prepare("SELECT total_changes() count").get().count;
  assert.throws(() => seedDemo(sql), /new, dedicated local database/u);
  assert.deepEqual(sql.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY type,name").all(), schema);
  assert.deepEqual(sql.prepare("SELECT * FROM organizations").all(), organizations);
  assert.equal(sql.prepare("SELECT total_changes() count").get().count, changes);
  assert.equal(sql.prepare("SELECT COUNT(*) count FROM resources").get().count, 0);
});
