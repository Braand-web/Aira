# Braand agent platform

This release extends the existing harness, billing ledger, Composio sessions and private browser. It does not introduce new prices, a second OAuth system or a second authorization path.

## User journeys

- Chat stays direct for simple requests. `capabilities(area)` progressively discovers the additional server tools, without adding the entire catalog to every request.
- A substantial request can prepare a short progressive brief or a persistent work mandate. Brief answers include the actual free text; neither a choice nor a stored `approved` field authorizes spending or publication.
- Missions lists persistent steps, real artifacts, decisions, consumed/reserved credits and pause/resume/cancel commands. Unknown outcomes block replay. Closing the tab is only advertised as safe while verified persistence is active.
- Studio → Publications contains calendar/list, versioned drafts, final-file selection, exact batch approval and individually approved replies. An account is a concrete destination with separately discovered capabilities. Publication retries never resend a confirmed or uncertain delivery.
- General settings contains editable brand profiles and sourced memory. Organic statistics are distinct from the existing paid advertising charts in Tableau de bord.
- The existing private browser panel remains the human handoff surface. `braand-computer-use` is an original operating method; it cannot bypass browser mandates, costs, domain restrictions or fresh observation.

## Persistent execution

Migration `0016_agent_platform.sql` is additive. Work has stable steps, an append-only event cursor, outbox, allocations linked to existing holds, work-wide local mutation receipts, commands with idempotency keys and expiring leases. Queue redelivery claims the same persisted state. An interrupted lease becomes `needs_reconciliation`; it is not automatically restarted.

The one-minute trigger dispatches work, polls existing media/render jobs and checks due publications. Existing five-minute billing, missions and operations tasks remain unchanged. Queue consumers target a specific work ID; scheduled scans recover missed dispatches. Queues use one message per batch, three retries and separate dead-letter queues.

Shared model reservations remain serialized. Read-only independent tools can run three at a time. Paid media requires its own exact quote/approval and is allocated inside the parent envelope. Cancellation prevents subsequent steps; an external operation already accepted may still finish.

## Feature activation

All newly consequential capabilities start closed. Local/mocked checks never set production verification flags.

- `WORK_ENABLED`, `WORK_STAGING_VERIFIED`: also require the queue binding or `WORK_SCHEDULER_VERIFIED`, and the existing scheduler secret. Verify an actual restart/reload and ledger settlement before activation.
- `RESEARCH_ENABLED`, `RESEARCH_STAGING_VERIFIED`: default dedicated transport uses `TAVILY_API_KEY` and a fresh `RESEARCH_PRICING_JSON`. Native transport selects a server-reviewed existing routed model through `RESEARCH_NATIVE_JSON`. It requires that model's actual key and current price; it never falls back to a different provider after uncertainty.
- `MEDIA_PERSIST_ENABLED`: generated media is ingested from reviewed public output hosts into private R2 with actual digest/type/size checks. Storage failure is distinct from generation failure.
- `MEDIA_RENDER_ENABLED`, `MEDIA_RENDER_STAGING_VERIFIED`: require the private renderer, token and fresh fixed-price contract. `services/media-render` contains the typed FFmpeg service and Dockerfile. A Worker alone cannot perform FFmpeg rendering. Never enable the flag before a real render/download/restart test.
- `SOCIAL_ENABLED`, `SOCIAL_STAGING_VERIFIED`, plus one flag for each network: require actual scoped connections and reviewed `SOCIAL_ADAPTERS_JSON` recipes. Recipes contain real Composio tool schemas and receipt paths discovered for that account, never guessed action names. Every write still requires an exact persisted delivery/reply claim.
- Browser and existing commercial flags retain their existing independent acceptance requirements.

`SOCIAL_ADAPTERS_JSON` is validated in `lib/social-adapters.ts`. Each recipe records its provenance, version, verification date, discovery/publish/poll/read schemas, limits and receipt semantics. Approving a lot binds content, file hashes, account version, adapter contract, IANA timezone and the fifteen-minute late window. Changing one post invalidates its pending consent. A stale/expired connection or a lost acknowledgement blocks publication.

## Research accounting and evidence

Standard phases are limited to five searches and ten page extractions. A work mandate may explicitly request deep research (twenty searches, forty extractions per phase); only the approved server mandate enables those higher limits.

Dedicated search/extraction retains request receipts and observed credit use. Native search reserves its whole model-context/output ceiling plus one server search fee in the same tool ledger; actual model and server-tool usage are settled together. Native protocol output is retained privately for thirty days. Unsupported or missing usage remains unresolved. OpenAI Responses and Anthropic Messages retain their own protocols; no fabricated client tool result is inserted for a server search.

Sources retain public URL, title, consultation date, available publication date, excerpt and digest. Search citations are marked `search_excerpt`; a citation does not imply a whole page was read. Native search without a configured page reader does not advertise page extraction. A private browser mandate can be proposed when an actual page interaction is needed.

Native search reference contracts: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [Anthropic web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool). Prices and supported models still require deployment-time verification.

## Data and trust

- Every API reconstructs identity/workspace from the server session and checks the existing role matrix. External connections remain isolated by their owner; approval does not confer ownership of someone else's OAuth connection.
- Server drafts use optimistic versions and seven-day expiry. Local fallback is scoped to identity/workspace/context. Actual logout clears browser storage. Conflicts preserve the user's input and offer the remote version or explicit replacement.
- Unlinked research excerpts and native research traces expire after thirty days. Sources attached to deliverables follow the deliverable lifecycle. Renderer scratch files expire after twenty-four hours and stored jobs are bounded.
- Final media is referenced by file ID, version and hash. Provider downloads use short-lived opaque grants restricted to the claimed delivery. No secret, raw CDP, arbitrary JavaScript or shell command is exposed to the model/client.
- User-provided `social-media-manager` is pinned to archive SHA-256 `c28fd89edc6fcfbafccf3e3cb1dac6c471f0eca80bd982d2d61983e111700bd9`. Only reviewed inert Markdown/JSON resources are imported; its Python script is excluded. No permissive license is asserted. The Braand overlay limits operation to L2.
- No proprietary Office/PDF skill is imported. Existing original document methods remain honest about whether a tested export engine exists.

## Release and rollback

1. Fetch and integrate current `main`; run typecheck, lint, unit, integration, HTTP, file and bundle checks, then the production build.
2. Snapshot current Worker bindings, plain variables, deployment version, schedules and public routes privately. Preserve existing secret bindings and `braand.fun/*`.
3. Apply additive migrations to staging, then production. The old Worker tolerates the added tables. Never remove user tables as an application rollback.
4. Deploy the gated build to staging and production with isolated DB/R2/queues. Verify public assets, protected endpoints, OAuth return behavior, downloads and scheduler bindings.
5. Activate each external capability only after its actual account/service/budget acceptance test. Do not count demonstrations or mocked transports as external proof.
6. To stop a capability, close its flag first. Keep receipts, unresolved holds, media and scheduled records for reconciliation. Rolling back code cannot undo an external publication.

## Acceptance evidence

`tests/agent-platform.integration.mjs` exercises the real services and additive migrations on SQLite, with injected external transports. The existing integration/HTTP/bundle suites protect prior behavior. `tests/social-time.test.mjs` covers nonexistent/repeated local times and non-hour offsets.

`evals/agent-platform.json` defines the twenty-four comparison scenarios. Real creative preference (target 75%), five-to-eight-person French usability testing (critical tasks ≥80%), actual four-network publications, a paid generation/render and private-browser recette must be recorded separately. This repository does not fabricate those results or guarantee external readiness from source tests.
