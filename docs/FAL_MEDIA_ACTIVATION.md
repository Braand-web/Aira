# Fal media activation

The provider key is a Cloudflare secret. It is never part of a tool schema, prompt, browser payload, repository file, price receipt or generated media record. Metadata/pricing reads are not generation tests. A single image test was separately authorized with a maximum supplier cost of USD 0.01, on isolated staging infrastructure and without charging a production customer.

## Bounded initial profiles

The selected IDs and fields are checked against actual Fal metadata and public OpenAPI schemas. The first catalogue covers:

- `fal-ai/flux/schnell`: one image, fixed named sizes, at most four inference steps, safety enabled and asynchronous CDN output. The conservative limit covers two billable megapixels, including rounding of the 1024 × 1024 option. The authorized test uses only `square`, 512 × 512.
- `minimax/h3-max-turbo/text-to-video`: one short video, requested duration 1–5 seconds, 480P, prompt expansion disabled. Its limit covers six billed seconds, including the documented possible duration overrun. No reference audio or higher resolution is accepted by this profile.
- `elevenlabs/tts/eleven-v4`: at most 1,000 UTF-16 code units of supplied text, built-in voices and MP3 output. No voice cloning, phone call or external sending. `audio_speech` reuses the same proposal and approval runtime.

This is a reviewed subset, not an assertion that every Fal endpoint is executable. Opaque `units` pricing, token-priced video, higher resolutions, additional outputs, reference media and unreviewed cost multipliers remain excluded until a real upper bound is established. The model selects a relevant task/profile; server validation fixes all authorized parameters and the exact approved model.

## Source-backed pricing and freshness

`FAL_PRICING_POLICY_JSON` pins endpoint IDs, supported billing units and maximum quantities. `FAL_CATALOG_JSON` pins the bounded inputs; the runtime validates the quantity limits themselves rather than trusting an arbitrary maximum cost number. Unknown/unbounded combinations fail closed.

`lib/fal-rate-refresh.ts` reads authenticated unit prices from the [Fal pricing API](https://fal.ai/docs/platform-apis/v1/models/pricing) and the official [BEAC currency reference](https://www.beac.int/). It uses no inference endpoint and shares a refresh across concurrent requests. It refreshes after six hours and refuses quotes older than twenty-four hours. The BEAC value date is retained and checked, including its weekend/holiday allowance.

The cache is private infrastructure data in R2 under `internal/fal-pricing/`. The one-way key binds the catalogue, policy and credential: an account/key change cannot reuse another account's custom prices. Cached data must match the exact policy, quantities, source URLs and timestamp. A current verified quote can survive a source outage; an expired quote cannot unlock generation. No secret or customer data is stored in that cache.

Authenticated API requests, scheduled ticks and queue consumers warm the same rate layer. Synchronous catalogue consumers see only a verified current overlay. An installation with no dynamic pricing policy keeps the legacy administrator catalogue path.

The agreed credit cap remains a **fixed proposal quote**, using the existing credit unit and settlement path. Supplier actual-cost visibility is separate: the provided API key permits generation and price reads, but returned HTTP 403 for account-balance access. A metadata price or completed image is not presented as an authenticated account-balance/usage statement. Unknown supplier billing receipts remain explicit.

## Validation and release

- `tests/fal-pricing.integration.mjs` exercises the real refresh and cache layer with simulated read-only sources: first-load closure, concurrent reads, cold start, expiry, outages, widened inputs, unsupported units, changed currencies/prices and no secret persistence. No paid calls.
- Existing media routing tests retain exact quote fingerprints and prohibit changes after approval. Existing proposal routes retain human approval, shared budgets, idempotent operation claims and uncertain-result handling.
- The private staging test uses the actual proposal approval route, real Fal queue, real media polling and private R2 persistence. It creates its own fixture identity/credit only. One supplier submission is allowed; lost acknowledgement must be investigated, never resubmitted blindly. Its result, file metadata, hash and settled staging hold are recorded separately from unit tests.
- Enable the catalogue/policy only after the verified production build is deployed. Preserve all existing bindings and flags. No routine or customer generation is created by enabling capabilities.

Image editing, higher-quality price profiles and video montage are separate capabilities. A generated video is not an edited multi-clip film. Browser control and a cloud terminal are also separate and are not enabled by a Fal API key.
