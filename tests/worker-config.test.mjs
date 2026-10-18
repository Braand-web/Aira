import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production Worker manifest retains the scheduled handler trigger and data bindings", async () => {
  const manifest = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
  assert.deepEqual(manifest.triggers?.crons, ["*/5 * * * *"]);
  assert.ok(manifest.d1_databases?.some(binding => binding.binding === "DB"));
  assert.ok(manifest.r2_buckets?.some(binding => binding.binding === "BUCKET"));
  const worker = await readFile("build/sites-worker.ts", "utf8");
  assert.match(worker, /scheduled\s*\(/u);
});
