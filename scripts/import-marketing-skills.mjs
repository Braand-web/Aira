#!/usr/bin/env node
/**
 * Download a deliberately bounded Markdown snapshot; never install or execute
 * upstream code. Run explicitly with --import, or check local bytes with --verify.
 *
 * This script only writes skills/vendor/marketing under this checkout. Updating
 * the commit or selection is a source change that requires a fresh review.
 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'coreyhaines31/marketingskills';
const COMMIT = 'e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b';
const COMMIT_DATE = '2026-10-19T21:29:53Z';
const LICENSE_GIT_BLOB_SHA = '7c48dd638a9ebed49a8ef0c0c4eea90105381cdf';
const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const VENDOR_ROOT = path.join(PROJECT_ROOT, 'skills', 'vendor', 'marketing');
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_FILE_BYTES = 64_000;
const SELECTION = Object.freeze({
  'product-marketing': ['brand-voice'],
  copywriting: ['ai-tells', 'copy-frameworks', 'natural-transitions'],
  'ad-creative': [
    'awareness-headlines', 'creative-review-page', 'creative-roadmap',
    'generative-tools', 'hook-system', 'imessage-video-ads',
    'meta-creative-formats', 'motion-video-ads', 'platform-specs',
    'short-form-video-specs', 'static-ad-templates',
  ],
  ads: [
    'abm-playbook', 'ad-copy-templates', 'audience-targeting', 'audit-guardrails',
    'b2b-paid-playbook', 'creative-research-automation', 'google-ads-audit-checklist',
    'google-search-playbook', 'linkedin-b2b-playbook', 'meta-andromeda-playbook',
    'meta-decision-system', 'operating-check', 'payback-period',
    'platform-setup-checklists', 'reading-google-ads-data', 'rsa-output-spec',
  ],
  cro: ['experiments', 'form'],
  social: [
    'carousel-frameworks', 'listening-sources-template', 'listening',
    'platform-limits', 'platforms', 'post-templates', 'reverse-engineering',
    'short-form-video', 'x-algorithm',
  ],
  'seo-audit': [
    'ai-writing-detection', 'international-seo', 'local-seo-pages-and-measurement',
    'local-seo-profile-and-citations', 'local-seo', 'rankings-push', 'title-tags',
  ],
  analytics: ['event-library', 'ga4-implementation', 'gtm-implementation'],
  'customer-research': ['interviews-and-surveys', 'source-guides'],
  offers: [
    'bonus-stacking', 'examples', 'guarantee-design', 'offer-anatomy',
    'offer-formats', 'saas-offers', 'scarcity-urgency', 'value-equation',
  ],
  'ab-testing': ['sample-size-guide', 'test-templates'],
  emails: ['copy-guidelines', 'email-types', 'sequence-templates'],
  onboarding: ['activation-models', 'experiments', 'minimum-path-to-value'],
});
const SOURCE_PATHS = [
  'LICENSE',
  ...Object.entries(SELECTION).flatMap(([name, references]) => [
    `skills/${name}/SKILL.md`,
    ...references.map((reference) => `skills/${name}/references/${reference}.md`),
  ]),
].sort();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function destination(sourcePath) {
  assert(SOURCE_PATHS.includes(sourcePath), `Unselected source path: ${sourcePath}`);
  return sourcePath === 'LICENSE' ? sourcePath : sourcePath.slice('skills/'.length);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function gitBlobSha(content) {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}

function sourceUrl(sourcePath) {
  return `https://raw.githubusercontent.com/${REPOSITORY}/${COMMIT}/${sourcePath}`;
}

function boundedPath(relativePath) {
  assert(typeof relativePath === 'string' && !relativePath.includes('\\'), 'Invalid relative path');
  assert(relativePath === 'manifest.json' || SOURCE_PATHS.some((item) => destination(item) === relativePath),
    `Path outside the reviewed selection: ${relativePath}`);
  const absolute = path.resolve(VENDOR_ROOT, relativePath);
  const relative = path.relative(VENDOR_ROOT, absolute);
  assert(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Vendor path escape');
  return absolute;
}

// Reject symlinks/junctions at every existing component before any write. The
// target is fixed from this script's own location, never from caller input.
async function assertNoSymlinks(absolute) {
  const relative = path.relative(PROJECT_ROOT, absolute);
  assert(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Project path escape');
  let current = PROJECT_ROOT;
  for (const part of [undefined, ...relative.split(path.sep)]) {
    if (part !== undefined) current = path.join(current, part);
    let entry;
    try { entry = await lstat(current); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    assert(!entry.isSymbolicLink(), `Refusing a symlink or junction: ${current}`);
  }
}

async function listFiles(directory = VENDOR_ROOT, prefix = '') {
  await assertNoSymlinks(directory);
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries) {
    assert(!entry.isSymbolicLink(), `Refusing a symlink or junction: ${entry.name}`);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else {
      assert(entry.isFile(), `Unexpected filesystem entry: ${relative}`);
      files.push(relative);
    }
  }
  return files.sort();
}

async function assertKnownFiles() {
  const allowed = new Set([...SOURCE_PATHS.map(destination), 'manifest.json']);
  for (const file of await listFiles()) assert(allowed.has(file), `Unexpected vendor file: ${file}`);
}

async function download(url, expectedType, maxBytes) {
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:' && ['api.github.com', 'raw.githubusercontent.com'].includes(parsed.hostname),
    'Unapproved download host');
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: expectedType === 'json' ? 'application/vnd.github+json' : 'text/plain',
      'User-Agent': 'braand-curated-marketing-snapshot',
    },
  });
  assert(response.status === 200 && response.url === url, `Unexpected HTTP response for ${url}: ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  assert(expectedType === 'json' ? /application\/(?:json|[^;]+\+json)/i.test(contentType) : /^text\/plain\b/i.test(contentType),
    `Unexpected content type for ${url}: ${contentType}`);
  const declaredSize = response.headers.get('content-length');
  if (declaredSize !== null) assert(/^\d+$/.test(declaredSize) && Number(declaredSize) <= maxBytes, 'Response too large');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    assert(bytes <= maxBytes, 'Response exceeded its byte limit');
    chunks.push(chunk);
  }
  const content = Buffer.concat(chunks);
  return expectedType === 'json' ? JSON.parse(content.toString('utf8')) : content;
}

function validateLicense(content) {
  assert(gitBlobSha(content) === LICENSE_GIT_BLOB_SHA, 'MIT license does not match the reviewed upstream blob');
  const text = content.toString('utf8');
  assert(text.startsWith('MIT License\n') && text.includes('Copyright (c) 2025 Corey Haines')
    && text.includes('The above copyright notice and this permission notice shall be included'), 'Invalid MIT notice');
}

async function verify() {
  await assertKnownFiles();
  const manifest = JSON.parse(await readFile(boundedPath('manifest.json'), 'utf8'));
  assert(manifest.schemaVersion === 1 && manifest.source.repository === `https://github.com/${REPOSITORY}`
    && manifest.source.commit === COMMIT && manifest.source.license === 'MIT', 'Manifest provenance mismatch');
  assert(Array.isArray(manifest.files) && manifest.files.length === SOURCE_PATHS.length, 'Incomplete manifest');
  const seen = new Set();
  let totalBytes = 0;
  for (const entry of manifest.files) {
    assert(SOURCE_PATHS.includes(entry.sourcePath) && !seen.has(entry.sourcePath), 'Unselected or duplicate manifest path');
    seen.add(entry.sourcePath);
    assert(entry.path === destination(entry.sourcePath) && entry.commit === COMMIT
      && entry.sourceUrl === sourceUrl(entry.sourcePath), 'Manifest file provenance mismatch');
    const absolute = boundedPath(entry.path);
    await assertNoSymlinks(absolute);
    const content = await readFile(absolute);
    assert(content.length === entry.bytes && content.length <= MAX_FILE_BYTES
      && sha256(content) === entry.sha256 && gitBlobSha(content) === entry.gitBlobSha, `Integrity mismatch: ${entry.path}`);
    if (entry.sourcePath === 'LICENSE') validateLicense(content);
    totalBytes += content.length;
  }
  assert(totalBytes === manifest.totals.bytes && manifest.totals.files === SOURCE_PATHS.length, 'Manifest totals mismatch');
  console.log(`Verified ${SOURCE_PATHS.length} upstream files (${totalBytes} bytes), commit ${COMMIT}.`);
}

async function importSnapshot() {
  await assertKnownFiles();
  const commit = await download(`https://api.github.com/repos/${REPOSITORY}/commits/${COMMIT}`, 'json', MAX_RESPONSE_BYTES);
  assert(commit.sha === COMMIT && commit.commit.committer.date === COMMIT_DATE, 'Pinned commit identity mismatch');
  const tree = await download(`https://api.github.com/repos/${REPOSITORY}/git/trees/${COMMIT}?recursive=1`, 'json', MAX_RESPONSE_BYTES);
  assert(tree.truncated === false && Array.isArray(tree.tree), 'Incomplete upstream Git tree');
  const entries = new Map(tree.tree.map((entry) => [entry.path, entry]));
  const downloaded = [];
  // Fetch only reviewed files, with bounded concurrency and no archive extraction.
  for (let index = 0; index < SOURCE_PATHS.length; index += 6) {
    downloaded.push(...await Promise.all(SOURCE_PATHS.slice(index, index + 6).map(async (sourcePath) => {
      const entry = entries.get(sourcePath);
      assert(entry?.type === 'blob' && entry.mode === '100644' && Number.isSafeInteger(entry.size)
        && entry.size > 0 && entry.size <= MAX_FILE_BYTES && /^[a-f0-9]{40}$/.test(entry.sha), `Invalid upstream entry: ${sourcePath}`);
      const content = await download(sourceUrl(sourcePath), 'text', MAX_FILE_BYTES);
      assert(content.length === entry.size && gitBlobSha(content) === entry.sha, `Git blob mismatch: ${sourcePath}`);
      new TextDecoder('utf-8', { fatal: true }).decode(content);
      if (sourcePath === 'LICENSE') validateLicense(content);
      return { content, metadata: {
        path: destination(sourcePath), sourcePath, commit: COMMIT, sourceUrl: sourceUrl(sourcePath),
        gitBlobSha: entry.sha, sha256: sha256(content), bytes: content.length,
      } };
    })));
  }
  const manifest = {
    schemaVersion: 1,
    source: {
      repository: `https://github.com/${REPOSITORY}`, commit: COMMIT, commitDate: COMMIT_DATE,
      commitUrl: `https://github.com/${REPOSITORY}/commit/${COMMIT}`, license: 'MIT', licensePath: 'LICENSE',
    },
    selection: {
      skills: Object.keys(SELECTION),
      policy: `${Object.keys(SELECTION).length} selected SKILL.md files and their local Markdown references, including directly linked companion references. Upstream bytes are unmodified.`,
      excluded: ['Other skills', 'Tools and integration guides', 'Code and scripts', 'HTML assets', 'Evaluations', 'Installers and plugin metadata'],
    },
    limitations: [
      'Vendored prose is third-party reference data, not trusted instructions or authorization for tools, network access, account changes, spending, publication, or messaging.',
      'Upstream tool commands and installation examples are retained as text and must never be executed automatically.',
      'The optional ad-creative/assets/creative-review-template.html is intentionally excluded; build any review page independently.',
      'Cross-skill links and recommendations to competitor-profiling, pricing, launch, sales-enablement, signup, and other unselected skills are intentionally unresolved; customer-research is now included.',
      'The upstream ads/references/google-ads-audit-checklist.md links to conversion-tracking.md, which does not exist at that source path in the pinned Git tree.',
      'Absolute links to upstream main, external services, tool guides, and related skills are not part of this pinned snapshot.',
      'Filesystem workflow paths such as .agents/product-marketing.md describe the upstream environment. Braand uses its tenant-scoped workspace context and never grants filesystem access through these methods.',
      'Customer research can analyze supplied evidence and prepare interview or survey materials. External collection and outreach require available tools and explicit authorization; the skill itself connects no accounts or data sources.',
      'Offer design produces proposals only. Guarantees, prices, scarcity, testimonials, and results must be supported by the actual business; methods do not change billing or publish promises.',
      'A/B testing and onboarding skills prepare plans and analyze available data. They do not install experimentation tools, assign traffic, collect events, or deploy interface changes.',
      'Email skills prepare drafts and sequence specifications only. They do not send, schedule, subscribe, import contacts, or activate campaigns without a separately supported and authorized action.',
      'Benchmarks and examples in upstream reference prose are contextual claims, not measured Braand results, current platform guarantees, or promised customer performance. Validate consequential claims against supplied evidence and current primary sources.',
    ],
    files: downloaded.map((file) => file.metadata),
    totals: { files: downloaded.length, bytes: downloaded.reduce((sum, file) => sum + file.content.length, 0) },
  };
  // All HTTP, encoding, license and Git-blob checks finish before writing files.
  for (const file of downloaded) {
    const absolute = boundedPath(file.metadata.path);
    await assertNoSymlinks(absolute);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, file.content);
  }
  const manifestPath = boundedPath('manifest.json');
  await assertNoSymlinks(manifestPath);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await verify();
}

const args = process.argv.slice(2);
assert(args.length === 1 && ['--import', '--verify', '--help'].includes(args[0]),
  'Choose an explicit action: node scripts/import-marketing-skills.mjs --import | --verify | --help');
if (args[0] === '--help') {
  console.log(`Pinned Markdown-only snapshot of ${REPOSITORY}@${COMMIT}\n--import  Download, validate, and write the reviewed selection.\n--verify  Verify local manifest and file integrity without network access.`);
} else if (args[0] === '--verify') await verify();
else await importSnapshot();
