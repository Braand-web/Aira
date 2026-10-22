# Task routing, conversation and catalogue v2

Implemented 22 October 2026. This change does not activate billing, Instant,
autonomous execution or a paid provider. Production still needs trusted identity,
server credentials, verified tariffs, staging acceptance and the existing gates.

## Customer experience

New 30-day sales: Essentiel 4,900 XAF / 100 credits, Pro 9,900 / 250,
Business 24,900 / 600 shared across five members and five workspaces. Essentiel
has the single-user storage/project capacity but cannot activate browser or
autonomous missions. Pro and Business retain those features' own readiness gates.
Top-ups are exactly 50 / 2,500 XAF, 125 / 5,000, and 300 / 10,000.
The prices are catalogue bases: the validated tax rule determines the final total.

No new annual sales. Existing annual allocations and prices, historical purchases,
refunds and prorated upgrades retain their original contract. Discovery remains
the existing gated, one-time 10-credit offer valid for seven days, not a daily gift.
Top-ups do not extend a subscription's rights. Advertising spend is separate.

One organization wallet pays for chat, specialist calls, media and browser use.
One credit has 100 accounting units: a small internal call is not rounded to a
whole credit. The current execution design ceiling of 4 XAF/credit is not a
supplier tariff or demonstrated margin. All supplier fees, currency costs,
infrastructure, support and unsuccessful paid requests must be accounted for.

Chat and its specialists share the accepted run hold. An approved browser
mission shares its model/browser hold. Media remains a separately quoted,
explicitly approved reservation in that same wallet; preparing a proposal never
launches a generation or extends the chat's authorized spending ceiling.

## Internal reasoning models

Set server-only `MODEL_ROUTING_ENABLED=true` only after configuring
`MODEL_ROUTING_CATALOG_JSON` and the required provider keys. With the flag absent
or false, the existing `LLM_PROVIDER` configuration remains in use.

The catalogue is an object keyed by `sol`, `haiku`, `sonnet`, `astra`, `opus`.
Each enabled entry must have:

```text
enabled: true
maxInputTokens: positive integer, at most 100000
maxOutputTokens: integer between 128 and 32768
rate:
  model: exact identifier below
  provider: openai or anthropic
  input, output, cacheWrite, cacheRead: verified USD / million tokens
  cacheWriteHour: verified one-hour cache-write rate if supported
  usdXaf: verified effective funding/conversion rate
  overheadXaf: verified additional cost per request, including explicit zero
  verifiedAt: ISO timestamp, no more than 24 hours old
```

Do not copy test rates into a live catalogue. Context ceilings are internal
limits, not the providers' commercial context-window quotas. The 100k ceiling
avoids silently applying a short-context tariff to a different price tier.

- `sol`: `gpt-6.1-sol`, OpenAI. Conversation and orchestration.
- `haiku`: `claude-haiku-5-5`, Anthropic. Bounded extraction.
- `sonnet`: `claude-sonnet-5-5`, Anthropic. Creative/campaign specialists and browser.
- `astra`: `gpt-6-astra`, OpenAI. Identified difficult analysis.
- `opus`: `claude-opus-5-5`, Anthropic. Important result review.

The model selects a bounded specialist role, not a URL, API key or arbitrary model.
There are at most three specialist delegations. An empty report permits one
identified escalation per shared budget; that attempt has no tools and must
return a final report. There is no automatic retry after an external write or an
uncertain provider result. Ordinary conversation does not create a mission.

OpenAI uses native Responses with `store:false`, private native images, encrypted
reasoning continuity and normalized tool events. Anthropic uses Messages. The
skills and tool results discovered through Composio are not filtered by this
protocol adapter. The server still enforces every tool's permissions and approvals.
Model task, provider, exact model/rate and usage are held in the private cost
ledger; a provider switch cannot reuse another model's price. Cache usage and
reasoning are counted once. A missing receipt keeps the reservation unresolved.

Secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and the catalogue belong in Workers
secrets, never client environment variables. Example operational commands (enter
values through Wrangler's private input, not shell arguments or chat):

```sh
npx wrangler secret put OPENAI_API_KEY --config dist/server/wrangler.json
npx wrangler secret put ANTHROPIC_API_KEY --config dist/server/wrangler.json
npx wrangler secret put MODEL_ROUTING_CATALOG_JSON --config dist/server/wrangler.json
```

Use a separately reviewed staging Worker configuration before any production
configuration. These commands configure secrets; they are not an instruction to
activate paid use or deploy the production Worker.

## Media selection

`prepare_media` selects from the administrator-validated `FAL_CATALOG_JSON` only.
No endpoint, price, input schema or availability is invented. Tasks include
image creation/editing, precise creation/editing, short video, narrative video
and reference-driven video. Current capability preferences support Nano Banana
2.1, GPT Image 2 / 2.5 Flare / Sunburst, Omni Flash and Seedance 2 / 2.5.

All use the existing fal queue adapter and `FAL_KEY`; direct Google/OpenAI image
credentials are not silently substituted for fal credentials. The fal catalogue
must validate the endpoint's real availability/version and its **fal** tariff,
not assume a direct provider's price. Optional `tasks` and numeric `priority`
allow further validated models. The default preferences are initial policy, not
an evaluated quality benchmark.

Each entry includes exact bounded `inputSchema`, integer quote credits,
`costCeilingXaf` and `verifiedAt` less than 24h old. Reference arrays require a
bounded `maxItems` and primitive item schema. HTTP/private/local reference URLs
are rejected before provider transport. The schema must price every permitted
resolution, duration, reference and output count.

Proposals fingerprint model, inputs, schema, credit amount and verified cost.
Changes require a new approval before reserving or generating. There is no
silent media-engine fallback after approval. Existing explicit proposals remain
supported, with the existing fresh-price and exact-input validation.

## Taxes and invoices

The server owns the quote. `amount` is always the final total for checkout;
`subtotal`, `tax`, `total`, jurisdiction, rate, treatment and configuration version
are returned for review before payment. XAF rounding uses integer arithmetic.
The client cannot supply its own price or tax rate. Changes invalidate a quote.

Configure `BILLING_TAX_JSON` with `mode` (`exclusive` adds tax to the catalogue
base; `inclusive` extracts tax from it), integer `rateBps`, `jurisdiction`,
`version`, `validatedAt`, and set `BILLING_TAX_VALIDATED=true` only after confirming
the treatment that applies to this seller and intended customers. A validated
zero rate must be explicit; unknown does not mean tax-free. This is a configured
tax rule, **not** automatic worldwide tax registration or country determination.

Cameroon's DGI publishes a general VAT rate of 19.25%, including additional
communal centimes. Its applicability depends on the seller's status and the
taxable transaction; the operator's residence alone cannot set the rate for all
customers. No Cameroon rate or legal validation is enabled automatically.
Source consulted 22 October 2026:
https://www.impots.cm/sites/default/files/documents/FICHE%20TVA.pdf

The complete validated legal seller identity is required before checkout.
Orders/invoices preserve the quoted identity and tax snapshot. Partial credit
notes allocate the original invoice tax cumulatively, with the final remainder
exact: splitting a refund cannot create or lose a franc of refunded tax.
Collected VAT is not service revenue or a substitute for company income tax.

Apply additive migration `0013_billing_catalog.sql` to a backed-up **staging**
database and run the regression suite before deployment. No existing contract,
invoice or credit note is rewritten by the migration. Use the configured staging
D1 binding/database name; do not substitute a production identifier blindly.

## Verification and remaining activation work

```sh
npm run typecheck
npm run lint
npm run build
npm test
```

New deterministic tests cover task routing, provider streams and mixed-rate
accounting, concurrency and cancellation, conversation/specialist continuity,
media quotes and approval changes, new/legacy billing and cumulative tax refunds.
The normal runner blocks external network and removes provider credentials.
The optional `tests/agent-ui.browser.mjs` exercises the actual React UI in
Chromium against a loopback fixture, including final tax display before payment.

Real model/media/browser calls, paid checkout, tax treatment, production margin
and deployment remain unverified until server configuration and a staging
acceptance run succeed. Instant and existing launch gates stay closed.

Official API references consulted 22 October 2026:

- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/pricing
- https://platform.claude.com/docs/en/models/overview
- https://platform.claude.com/docs/en/about-claude/pricing
- https://fal.ai/models/google/nano-banana-2.1
- https://fal.ai/models/openai/gpt-image-2.5/flare/text-to-image/api
- https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit/api
- https://fal.ai/gemini-omni
- https://fal.ai/models/bytedance/seedance-2.5/text-to-video/api
