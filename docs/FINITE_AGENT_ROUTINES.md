# Finite agent routines

Braand can propose a finite repetition of a completed work mandate. The model decides whether the user's recurring request needs this capability and discovers `prepare_routine` through `capabilities(area="work")`. Ordinary conversation does not acquire a schedule. There is no activation tool exposed to the model.

The method follows the useful distinction in [xAI's skills and routines documentation](https://docs.x.ai/grok-bot/skills-routines-and-automations): establish a successful one-time task before automating its repetition. Braand retains its existing Workers/D1/R2 architecture and work runner; it does not add a virtual computer or six independent agent engines.

## Approval and execution contract

- A current completed source work, settled costs, and at least one current structurally verified saved deliverable/page are required. All present report/page artifacts must have current verification receipts. Structural verification checks stored content and references; it does **not** certify factual or business correctness.
- The server snapshots the immutable step instructions, dependencies, criteria, language, timezone and per-run cap. A digest also covers the proposed schedule and total cap. Activation requires an authorized human's exact version, digest and affirmative decision.
- Fixed intervals range from 1 to 168 elapsed hours. The first run must be at least one minute in the future; the finite schedule ends within thirty days and contains at most thirty runs. This is deliberately **not** a local wall-clock cron or a DST-aware “every Monday at 08:00” rule. The UI explains that distinction.
- `maxRuns × perRunCredits <= totalCredits` is checked in both application code and SQL. Every started occurrence permanently consumes one conservative allocation from that finite mandate. Unused allocations do not silently purchase extra occurrences. Actual usage and current holds remain separately visible; credits are reserved and settled by the existing work/metering services.
- One D1 batch creates the isolated conversation, work, steps, outbox entry and occurrence record, conditionally on the same parent version/schedule/count. Unique occurrence and work keys plus compare-and-swap prevent duplicated ticks and lost-acknowledgement replays. There is at most one unfinished occurrence per routine.
- Each occurrence uses the author's current rights and connected-account identity. The approver's permission is checked again before dispatch; its rights are never transferred to the author. Each occurrence gets a fresh conversation and a timestamped instruction to fetch current data. Retrieved data remains untrusted.
- External writes still require their own exact approval. A routine cannot carry a publication, customer-contact or payment authorization into its next occurrence. It cannot create/activate another routine from approved-mission mode.
- The next occurrence requires the previous work's completion, settled costs and current saved-artifact verification. An approval, missing information, failure, uncertain action/cost, or failed verification blocks repetition. Running/provider-processing work is allowed to finish without spawning overlapping work. Missed slots are skipped rather than replayed in a burst.
- Pause/cancel and child-work stops are transactional. Existing work guards stop the next model/tool call. In-flight provider calls must still return their usage receipts; an already accepted operation cannot be undone by pausing. Resume requires explicit approval and a completed previous work; it never replays an uncertain occurrence.

## User experience and operation

`Missions → Routines` shows the exact cadence, first/next time, expiry, per-run and total limits, consumed/reserved credits, criteria and links to the actual work/deliverables. It provides approve, pause, resume and cancel controls with loading/error feedback and keyboard access. A chat-created routine opens this view. No preparation/model-connection status is reintroduced under the composer.

The routine list uses three bounded D1 queries for up to forty routines and their finite histories, rather than querying every occurrence separately. It polls only while its panel is mounted and the document is visible. The scheduler handles at most ten eligible routines per minute and reuses the existing work outbox/queue and billing guards. No extra timer infrastructure or dependency is installed.

Apply additive migration `0017_agent_routines.sql` to an isolated staging D1 before production. Keep `ROUTINES_ENABLED` and `ROUTINES_STAGING_VERIFIED` closed until validation; both and existing verified work readiness are needed. A deployment must preserve current bindings, route, secrets, unrelated flags and existing data. Enabling the feature does not create a customer's routine or authorize a new expense on their behalf.

## Reproducible validation

- `node tests/routines.integration.mjs`: real migrated SQLite and actual work/routine/verification services, with provider and metering boundaries explicitly isolated. Covers approval, stale state, conservative budgets, concurrent dispatch, separated contexts/languages, missed slots, pause/resume, finite exhaustion, uncertain results, missing verification and revoked rights. It cannot establish live provider correctness.
- `node tests/routines-ui.browser.mjs`: real React/Chromium on desktop/mobile, local fixture data, keyboard expansion, approval gating, pause, stale-conflict feedback and overflow checks. No account creation or billable provider call.
- Standard CI runs all TypeScript, lint, production build, unit/service/HTTP/artifact tests and existing UI/auth checks, plus the routine browser check. Deploy only its verified build artifact.
- A private staging Worker can verify the real D1 batch and API runtime with clearly labelled fixture source work and **without** model/payment credentials. Record that distinction and remove its fixture data and Worker afterwards. This verifies the service transaction, not the intelligence of the model or an actual customer campaign.

## Remaining increments

Event-driven triggers, daily wall-clock schedules, email/push delivery, editable/versioned routine templates, sandboxed cloud terminal, interactive artifact editing and browser activation are separate capabilities. They are not implied by this implementation. Existing browser/media/social feature flags retain their own validation requirements. No comparison of intelligence, latency or task success with Muse/Duet/Grok is claimed without equivalent measured tasks.
