# General-purpose internal engines

The main model now handles general research, data, documents, software sources,
creation, organization and operations as well as marketing. Intent remains model
selected; there is no keyword router. Existing five delegation roles are preserved,
with additional software, data and operations profile configurations on the same
bounded runtime. Ordinary conversation still needs no plan or delegation.

## Native data engine

`capabilities(area: analysis)` progressively exposes `analyze_data` and
`get_analysis_result`. The engine runs deterministic table operations in Workers:
select, filter, group/count/sum/mean/min/max, sort and explicit limits. It accepts
an inline table, owned current-version UTF-8 CSV/JSON, or a previous owned result.
Limits: 500 rows, 40 columns, 128 KiB, 8 steps and 1,000 characters per cell.

Numerical aggregation uses fixed-point BigInt arithmetic with six decimal places,
not floating point addition. Decimal conventions must be explicit; ambiguous
numbers and unsafe JSON integers are rejected. Missing values are not zero; empty
numeric groups yield null. Means round to six places, ties away from zero.
This proves the arithmetic on supplied data, not the factual truth of the dataset.

The complete result is stored privately and exported as a formula-neutralized CSV.
Input/output hashes, source identity/version and the exact plan are retained.
Tool previews are capped at 6,000 characters; paged result rows at 12,000. A row too
large for a page requires fewer selected columns. Reanalysis can use the whole
stored output without loading it into the model. No arbitrary script or provider.

## Source project engine

`capabilities(area: software)` exposes `save_source_project` and
`get_source_project`. Source projects have a current-version manifest and targeted
upserts/deletions. Unmentioned files remain; stale versions fail. The real ZIP
contains Unicode text files, hashes and explicit not-executed/not-tested/not-deployed
states. Earlier archives remain recoverable as private files.

Limits: 32 files, 128 KiB total, 40,000 characters per file. Traversal, absolute
paths, case collisions, file/directory collisions, reserved names, credentials
paths and malformed text are rejected. No arbitrary ZIP uploads are enabled.
Downloads use the existing authenticated, user/workspace-scoped signed route with
attachment disposition, CSP sandbox and nosniff. This engine delivers source code;
it does not provide Linux, npm builds, a software hosting service or video rendering.

## Shared persistence and UX

Native report/data/source exports share one R2/D1 path. It enforces access,
source version, maximum file size, same-workspace deduplication, atomic file-count
quota, storage metering and cleanup after transaction failure. Quota refusal
cannot create a file resource or storage debit. Existing report API contracts stay.

Workspace listings and ordinary resource DTOs omit raw code, table rows and inline
input. Bounded tools retrieve them explicitly. The chat surfaces the private
deliverable and associated CSV/ZIP immediately, deduplicates repeated receipts and
does not mix workspace results. Existing UI/components are reused.

## Activation and evidence

These engines require existing R2 plus write access; no new secret, migration,
dependency, paid provider or subscription. Planning cannot acquire mutation rights.
Approved work can use internal native operations under its existing mandate and
budget; external effects retain their existing approval.

Unit, actual SQLite/service, signed download, orchestration and browser fixtures
cover decimals, source revisions, ownership, read-only denial, malicious inputs,
bounded context, duplicate mutations, rollback and concurrent quota enforcement.
Provider/model I/O and R2 in local service tests are simulated; that does not prove
production model quality or supplier execution. Isolated Cloudflare evidence and
the exact CI/deployment receipts are recorded separately before release.

The user deferred paid activation. No Workers Paid subscription or Fal recharge is
created. Linux execution/builds, arbitrary code-to-MP4 rendering and generation
without funded Fal remain unavailable; a method is never evidence of a live engine.

### Isolated Cloudflare validation — 2026-10-28

The services from commit `4763b3e` ran in a temporary gated Worker, against a
separate staging D1/R2 with no model/provider credentials. Actual stored ZIPs
were downloaded, unpacked independently and checked against every file hash.
The checks covered exact `0.1 + 0.2 = 0.3`, null handling, source revisions,
retained files, stale/foreign access denial, structured rewrite denial,
context-safe DTOs and result pagination. Five generated files and all fixture
records were removed; the temporary Worker was deleted.

The upper-bound invocation created 32 source files / 128,000 text bytes and
processed 500 rows × 40 columns through eight sorts, exporting a 136,530-byte ZIP
and a 98,732-byte CSV. Combined server wall time was 7,931 ms (client 8,280 ms).
The smaller combined scenario took 11,076 ms server / 11,690 ms client, including
three writes, multiple access/version checks and storage reads. These are single
staging observations including network/storage waits, not CPU timings, per-tool
latency benchmarks, LLM performance or before/after improvement percentages.
