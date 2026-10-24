import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production Worker manifest retains the scheduled handler trigger and data bindings", async () => {
  const manifest = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
  assert.deepEqual(manifest.triggers?.crons, ["*/5 * * * *"]);
  assert.ok(manifest.d1_databases?.some(binding => binding.binding === "DB"));
  assert.ok(manifest.r2_buckets?.some(binding => binding.binding === "BUCKET"));
  assert.equal(manifest.browser?.binding, "BROWSER");
  assert.ok(manifest.durable_objects?.bindings?.some(binding => binding.name === "BROWSER_SESSIONS" && binding.class_name === "BrowserSession"));
  assert.ok(manifest.migrations?.some(migration => migration.new_sqlite_classes?.includes("BrowserSession")));
  const worker = await readFile("build/worker.ts", "utf8");
  assert.match(worker, /scheduled\s*\(/u);
  assert.match(worker, /export\s*\{BrowserSession\}/u);
  const builtWorker = await readFile("dist/server/" + manifest.main, "utf8");
  assert.match(builtWorker, /\bas BrowserSession\b/u);
});
