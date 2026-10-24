# Automatic model-price verification

The 24 October 2026 incident was caused by `OPENROUTER_RATE_JSON` carrying a
17 October verification timestamp. The runtime correctly rejected expired
evidence. Changing the error wording or repeatedly changing that timestamp
without checking sources would not resolve the underlying problem.

## Scope and accounting basis

An opt-in `MODEL_PRICING_REFRESH_JSON` policy enables a server-owned, fixed-model
price registry. Apply `0016_model_pricing_snapshots.sql` before enabling it.
The policy accepts only the three allowlisted OpenRouter adaptive models,
`basis: "inference_credits"`, and an input ceiling of at most 90,000 tokens.
It accepts no provider URL, key, arbitrary model name or recharge estimate.

Model prices come from https://openrouter.ai/api/v1/models. Conversion uses the
dated USD/XAF selling reference on https://www.beac.int/. This is a reference
conversion, **not the bank's actual card settlement rate**. A current source read
may use the last published business date, up to seven calendar days old. An
ambiguous, undated, future or stale quote is rejected.

OpenRouter credit purchases have separate platform fees
(https://openrouter.ai/pricing). Under this policy, `fundingFeeBps: 0` and
`overheadXaf: 0` mean **inference-credit consumption only**. They do not assert
that company funding, foreign exchange, infrastructure or card expenses are
zero. These expenses remain separate operating costs. No receipt amount is
needed for inference availability. Historical usage rows retain their original
rate. This policy does not validate commercial profitability or enable checkout.

## Persistence and availability

The D1 table stores public prices and provenance only, keyed by a SHA-256 hash
of the complete validated policy. No user content, tenant data, key or payment
receipt enters the snapshot. Models with missing tool support, unaccounted
request fees, incomplete cache prices or a price tier within the context ceiling
are rejected. Unrelated models' metadata does not affect the selected models.

The existing five-minute operations tick checks the registry. Prices normally
refresh every six hours. Concurrent requests in one worker share an in-flight
refresh. Cold workers load D1 evidence; a five-minute memory cache reduces D1
reads. Source requests have fixed hosts, no authentication headers, no redirects,
a 15-second timeout and bounded response sizes.

When sources fail, a still-valid snapshot may be used, retaining its original
timestamp and 24-hour expiry. Refresh failure backs off for five minutes within
the worker. Expired or invalid evidence fails closed before model spending.
The operations job records a failure when no valid evidence is available.

Workspace navigation and browser session controls load cached evidence only;
they do not wait for public pricing endpoints. Chat, new model calls and browser
activation perform the stronger preflight. Existing reservations, per-model cost
rows, output/context limits, unresolved-cost handling and approvals remain in
force. Paid or uncertain generations are never replayed by a pricing refresh.

## Activation and rollback

1. Run typecheck, lint, build and all offline tests.
2. Apply the additive migration to private staging; configure the policy and
   the three existing routing catalog entries with `transport: "openrouter"`.
3. Enable `MODEL_ROUTING_ENABLED=true`, `MODEL_ROUTING_POLICY=adaptive` and
   verify a real staging Worker persists a snapshot fetched from both sources.
4. Apply the migration and the same configuration to production, preserving
   the domain route, authentication and all unrelated feature gates.
5. Check the production snapshot's source dates, expiry and exact model IDs,
   public health, and anonymous API rejection. These read-only checks do not
   prove an authenticated conversation or live model generation works.

To roll back activation, remove the refresh policy and restore routing switches
and a separately verified static rate. An expired static rate remains blocked;
do not renew its timestamp without source evidence. Keep the additive table.

## Verification evidence

`tests/model-pricing.integration.mjs` uses the real pricing, routing, metering
modules and all D1 migrations in SQLite. Fourteen scenarios cover refresh,
cold persistence, navigation latency isolation, failure/expiry, policy changes,
provenance corruption, funding separation, context-price tiers and exact-model
overrides. Public HTTP sources are fixtures; there are no paid calls.

On 24 October, separate read-only live source checks resolved all three model
IDs with tool support and a BEAC value date of 23 October. These source checks
establish price availability, not generation quality or latency. Provider funds
and a customer's Braand credit ledger are independent: an empty Braand wallet
still prevents a paid run, even if OpenRouter holds a positive balance.

## Deployment record — 24 October 2026

- Migration 0016 applied to staging and production. The production owner
  explicitly authorized a one-time, seven-day grant of 50 test credits. The
  narrowly scoped, idempotent insert produced a ledger grant and billing audit;
  it did not fabricate a payment, subscription or invoice. The global free-credit
  setting remains zero. No other organization received a grant.
- TypeScript and lint passed. Build passed. The complete offline runner passed:
  176 unit tests, 19 integration suites, four artifact suites and two HTTP
  runners. These include the fourteen pricing scenarios and existing routing,
  budget, isolation and reconciliation checks. Artifact checks were repeated
  against the final build.
- A private Cloudflare remote preview ran the actual pricing module against
  staging D1 and both live public sources. First refresh took 5,410 ms and
  persisted verified evidence. This exposed and corrected Workers' lack of
  support for Fetch `redirect: "error"`; the implementation uses `manual` and
  rejects non-2xx responses without following them.
- Staging version: `b225ca71-f53b-40b6-8f8e-b52f4d1f708f`.
  Production version: `af2658da-0365-4174-9691-9d0423e6f032`, preserving
  `braand.fun/*` and the five-minute cron.
- Production evidence was verified at `2026-10-24T18:45:30.969Z`, with BEAC's
  23 October value date. A subsequent Worker cache read took 143 ms. These are
  individual observations, not latency guarantees.
- Public HTTPS checks: home, analytics, sign-in and health returned 200;
  unauthenticated workspace and chat reads returned 401. No authenticated
  production session was forged or extracted for testing.
- Two authorized native provider diagnostic calls used only synthetic text.
  The 16-token probe exhausted its output in thinking and returned no text;
  the separate 128-token probe returned `OK`, with first text observed at
  1,783 ms. The first receipt was reconciled before the second paid diagnostic.
  Both receipts were subsequently confirmed: USD 0.0000121 and USD 0.0000061.
  These are company
  diagnostic expenses, with no debit to the owner's Braand test grant. No
  campaign, payment, email or other external user action was executed.
- During final read-only production checks, two real authenticated runs created
  after deployment were already `completed`, using the light tier. The first
  had a confirmed cost and settled reservation; the second still had an
  estimated cost pending its provider receipt. This is server-side completion
  evidence from normal app activity, not an automated visual assertion about
  the user's browser. The existing billing tick and next-run preflight perform
  receipt reconciliation without resubmitting either generation.
