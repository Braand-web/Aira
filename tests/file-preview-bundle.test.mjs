import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const chunksDirectory = path.resolve("dist/client/_next/static/chunks");
const mediaDirectory = path.resolve("dist/client/_next/static/media");
const staticDirectory = path.resolve("dist/client/_next/static");
const pdfRuntimeSignatures = /pdfjsLib|PDFWorker|WorkerMessageHandler/;

test("PDF reader and worker stay outside the initial client chunks", async () => {
  const chunkNames = await readdir(chunksDirectory);
  const readerChunks = chunkNames.filter(name => /^pdf-reader-.+\.js$/u.test(name));
  assert.equal(readerChunks.length, 1, "the reader should be emitted as one lazy chunk");

  const mediaNames = await readdir(mediaDirectory);
  assert.ok(mediaNames.some(name => /^pdf\.worker\..+\.mjs$/u.test(name)), "the PDF worker should be emitted as a separate asset");

  const matches = [];
  for (const name of chunkNames.filter(file => file.endsWith(".js"))) {
    const source = await readFile(path.join(chunksDirectory, name), "utf8");
    if (pdfRuntimeSignatures.test(source)) matches.push(name);
  }
  assert.deepEqual(matches, readerChunks, "PDF.js runtime signatures must only appear in the lazy reader chunk");

  const providerName = chunkNames.find(name => /^file-preview-provider-.+\.js$/u.test(name));
  assert.ok(providerName, "the shared preview provider should be present");
  const providerSource = await readFile(path.join(chunksDirectory, providerName), "utf8");
  assert.ok(providerSource.includes(readerChunks[0]), "the provider should reference the reader as a dynamic chunk");
});

test("Office readers and archive parser stay out of the initial client bundle", async () => {
  const chunkNames = await readdir(chunksDirectory);
  const readerNames = ["docx", "xlsx", "pptx"].map(kind => {
    const match = chunkNames.filter(name => new RegExp(`^${kind}-reader-.+\\.js$`, "u").test(name));
    assert.equal(match.length, 1, `${kind.toUpperCase()} reader should be emitted as a lazy chunk`);
    return match[0];
  });
  const providerName = chunkNames.find(name => /^file-preview-provider-.+\.js$/u.test(name));
  const providerSource = await readFile(path.join(chunksDirectory, providerName), "utf8");
  for (const name of readerNames) assert.ok(providerSource.includes(name), `provider should load ${name} dynamically`);

  const workerNames = (await readdir(staticDirectory)).filter(name => /^office-preview\.worker-.+\.js$/u.test(name));
  assert.equal(workerNames.length, 1, "Office decompression/parser should be emitted as a separate worker asset");
  const workerSource = await readFile(path.join(staticDirectory, workerNames[0]), "utf8");
  assert.ok(workerSource.includes("word/document.xml"), "worker asset should contain Office parsing code");
  assert.ok(!/\b(?:fetch|eval)\s*\(/u.test(workerSource), "Office parser worker must not fetch files or evaluate uploaded code");

  const initialNames = chunkNames.filter(name => !readerNames.includes(name) && !/^use-office-preview-/u.test(name));
  const initialSources = await Promise.all(initialNames.map(name => readFile(path.join(chunksDirectory, name), "utf8")));
  assert.ok(initialSources.every(source => !source.includes("word/document.xml")), "Office XML parser should not be included in initial client chunks");
});
