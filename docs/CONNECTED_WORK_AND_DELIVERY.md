# Connected work and delivery

This increment extends the existing runtime; it does not introduce a second agent engine or change the billing unit (one credit = 4 XAF).

## Delivered contracts

- Approved durable work can discover connected schemas, inspect its own connections, perform verified reads and prepare exact write proposals. OAuth, raw batch execution, proxy, sandbox and paid Instant are excluded. An approved work mandate cannot approve its own proposals.
- Connected proposals are atomically attached to their work step. A repeated identical proposal returns its previous resource, including failed, rejected or uncertain receipts. Paused, cancelled or expired work cannot authorize a new external call.
- A completed connected operation resumes its original step for receipt inspection before dependent steps. Allocations accumulate per step, including the adopted legacy allocation reference. Unknown external effects and unsettled costs remain blocked.
- Conversation slots own messages, drafts, attachments, stream buffers and cancellation. Navigating to another conversation does not reassign the live stream. Explicit submissions in the tab are queued, with at most three active/queued requests, so client concurrency cannot exceed server rights. This is not parallel provider execution.
- Status notifications poll a workspace-scoped summary with one bounded D1 query every 20 seconds while the tab is visible. They report observed transitions; they do not invent autonomous work.
- Saved deliverables export as real DOCX, XLSX, PDF, HTML, CSV or Markdown. Files saved by the agent use private R2, existing quotas, provenance and workspace hash deduplication. Download-only exports do not create an R2 copy. Formats preserve source text and citations, not arbitrary executable applications.
- XLSX stores strings, never user-provided formulas; CSV neutralizes formula prefixes. HTML is escaped and has no scripts or remote assets. The minimal PDF writer supports Latin/Windows-1252 and explicitly refuses other scripts; DOCX/HTML preserve Unicode. These are bounded original exporters, not clones of proprietary document skills.

## Optional sourced research

`RESEARCH_TRANSPORT=openrouter` uses one explicitly bounded Exa fast server search with the already configured light model. The server verifies current tool pricing from the authenticated catalog before reserving model + tool cost. The feature remains subject to `RESEARCH_ENABLED` and `RESEARCH_STAGING_VERIFIED`.

Live provider probes on 2026-10-27 established:

- Search returns `text.citations` and a Messages `usage.cost` including the search charge. The parent generation endpoint can report zero for this server-tool request. It must not replace the nonzero response cost.
- The implementation requires one executed search, the explicit Exa engine, matching requested model, a complete response, and consistency between total cost, inference cost and the verified tool price. It retains this cost receipt for reconciliation, with no automatic paid replay.
- A real staging stream interruption preserved its sources and saved report. The continuation verified and exported the same report without another search. Stale pending model costs are eligible for metadata-only reconciliation only after the run is terminal and the provider receipt has an explicit final reason. A zero interim receipt cannot settle them. Unavailable metadata response bodies are cancelled to release edge connections.
- Web fetch returned a model summary without the raw page text. This transport therefore advertises `canReadPages=false`; it does not turn a summary into a confirmed page read. An existing configured page reader remains separate.

## Verification and limits

The targeted SQLite/SDK fixture tests cover exact approvals, cross-user isolation, work pause/cancellation, same-step continuation, cumulative budgets, private export storage, version conflicts, deduplication, transactional cleanup, sourced research, total cost and unknown-result replay prevention. These tests do not establish successful publication on a real social account.

Chromium fixtures cover desktop/mobile layouts, interruption, reduced motion, existing settings/billing flows and conversation switching during streaming. Full TypeScript, lint, production build and all offline suites run in GitHub CI; deploy only that exact green artifact. Production configuration and secrets must be preserved.

Outstanding external prerequisites remain explicit: expired OAuth connections must be reauthorized by their owner; final media generation/assembly needs configured provider credentials and verified prices; private browser and specialized social automation stay closed until their own acceptance evidence exists. Generic connected exact-approval actions are a separate capability from the specialized social scheduler. No test may publish, launch an ad, pay or send an email merely to demonstrate this increment.
