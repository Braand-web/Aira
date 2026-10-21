# Private browser sessions

Browser execution is disabled by default. Local automated checks use an injected driver and make no paid provider calls. They do not establish production authentication, remote browser availability, durable ownership, public DNS safety, or the economic suitability of a deployed configuration. Keep the feature disabled until the deployment has passed the staging checks below.

## Deployment configuration

Apply `drizzle/0012_browser.sql` after the existing migrations. Bind the Cloudflare Browser Rendering Fetcher as `BROWSER`, the browser session Durable Object namespace as `BROWSER_SESSIONS`, and private R2 storage as `BUCKET`. Deploy the Durable Object class and its migration with the Worker configuration. The same D1 database backs the API, browser owner, agent execution and credit ledger.

The readiness response fails closed unless each of these configuration values is present and valid:

- `BROWSER_ENABLED=true`: explicit product release switch; leave false during incomplete validation.
- `BROWSER_AUTH_VERIFIED=true`: the deployed authenticated identity and same origin mutation boundary have been checked.
- `BROWSER_STAGING_VERIFIED=true`: the actual deployment passed the staging acceptance checks.
- `BROWSER_OWNERSHIP_VERIFIED=true`: all provider operations run through the session's Durable Object owner. A flag alone cannot prove this property.
- `BROWSER_PRICING_VALIDATED=true` and `BROWSER_MARGIN_VERIFIED=true`: the rate, infrastructure allocation, concurrency assumptions and accepted credit price have been reviewed for the deployment.
- `BROWSER_PROFILE_KEY`: a secret containing exactly 32 random bytes, encoded as base64. Keep it out of source control and logs. Changing it makes existing encrypted profiles and private agent checkpoints unreadable; plan rotation and deletion before replacing it.
- `BROWSER_PRICING_JSON`: the exact JSON shape shown below. Values must be finite; the browser hourly rate and USD/XAF conversion must be positive; the infrastructure allocation must be nonnegative. The timestamp must be no older than 24 hours and must not be in the future. The source must be the exact HTTPS official pricing path `/browser-run/pricing/` or `/browser-rendering/pricing/` on `developers.cloudflare.com` (with or without the trailing slash).
- The configured model must separately pass the existing model readiness and verified rate checks. Its provider key, model identifier and rate configuration are still required.

```json
{
  "usdPerBrowserHour": "REPLACE_WITH_VERIFIED_NUMBER",
  "infrastructureUsdPerHour": "REPLACE_WITH_VERIFIED_NUMBER",
  "usdXaf": "REPLACE_WITH_VERIFIED_NUMBER",
  "verifiedAt": "REPLACE_WITH_CURRENT_ISO_TIMESTAMP",
  "source": "https://developers.cloudflare.com/browser-rendering/pricing/"
}
```

The strings in this example intentionally fail validation. This document supplies no production price. The infrastructure allocation must account for the applicable Worker, Durable Object, storage and concurrency costs; a zero allocation requires independent evidence that those costs are already covered. Shared fees are not presumed free. Flags record deployment acceptance; they do not discover prices, prove authentication or replace testing.

## Ownership and interruption

The API operates on application session IDs. Provider session IDs, retained browser handles and provider connection URLs stay server side. Provider open, observe, command, capture, profile and close calls must route to the same Durable Object owner, including calls originating from HTTP handlers. Agent execution within that owner uses its local driver context to avoid a request to itself.

The driver uses the pinned Cloudflare Playwright API with a guarded browser context. Its connection and request guards are retained in the owning isolate. A cold or lost owner cannot assume that it can safely reconstruct those guards from a provider session identifier. It must fail closed, preserve the reservation where costs remain unknown and terminate or reconcile the old provider session. Never create a replacement browser or repeat a mutation to recover an uncertain response. The provider history receipt is the billing authority; local elapsed time is not a receipt.

Staging must exercise an owner eviction/restart, request interruption after dispatch, browser disconnection, guard retention and delayed provider history. If durable ownership or safe teardown cannot be demonstrated with the deployed provider version, keep `BROWSER_ENABLED=false`.

## Identity, limits and approval

Sessions, profiles, events, captures and downloads are private to the exact authenticated user and workspace. Another workspace administrator cannot read them. Paid execution requires an active Pro or Business plan and current write permission. Activation and action approval additionally require approve permission. Those rights are checked again before provider work; a downgrade or revoked membership must stop execution.

Activation approves the stored objective, exact domain allowlist and maximum credits at the current session version. It reserves one hold shared by model and browser costs. The browser's full permitted duration has a reserved cost allocation before model spending. Unknown costs retain the reservation for reconciliation. Repeated activation cannot reserve a second hold.

The default limits are 40 actions, 1,200 seconds and 300 seconds waiting for human authentication. Administrators can configure `BROWSER_MAX_ACTIONS` (integer 1–100), `BROWSER_MAX_SECONDS` (integer 60–1,800) and `BROWSER_HUMAN_WAIT_SECONDS` (integer 30–600). Invalid limits close the readiness gate. Action and duration limits are snapshotted into each draft and its approved mandate. There is one active browser session per user and workspace, with an organization limit of one on Pro and three on Business. The database enforces concurrent activation limits; ordinary model runs also retain their existing concurrency limit.

Every navigation, new tab, external mutation and unknown click requires an explicit action decision, including HTTPS GET navigation within an allowed domain: a GET destination can itself mutate remote state. The immutable proposal binds the payload, session, observation, page, fingerprint and expiry. Approval uses a compare and swap claim and reobserves the page immediately before dispatch. Changed, expired, already used or concurrently consumed approvals cannot execute. A timeout after dispatch produces an uncertain result and no automatic retry. A final model report proposes a private encrypted result for human review. It closes the provider and records actual usage, but the session remains `awaiting_approval`. Only the owner’s explicit `confirm_result` decision at the current version marks the result completed. Model text alone cannot declare success. Ordinary non-sensitive field values are visible to the session owner when reviewing a proposal. Authentication and financial targets hand control to the human before their field values are persisted.

## Authentication and profiles

Human takeover clears agent observations and captures and suspends the agent. Pointer and type commands are authorized only in exclusive human mode and pass through without payload journals or persisted action rows. The owner can request a private screenshot to operate the page. That screenshot is returned directly with `private, no-store`, is not saved as an artifact and is never supplied to the model. The driver masks input fields in captures. Returning control creates a fresh sanitized observation.

Remembering a profile requires a name and explicit `consent:true`. Provider storage state is encrypted with AES-GCM. Additional authenticated data binds the ciphertext to user, workspace and profile ID. R2 keys use a private browser prefix; no public bucket or public object URL is appropriate. Profile DTOs contain only identity, name and timestamps. Profiles expire after 30 days of inactivity; use refreshes that deadline. Delete only the requesting user's profile. Key rotation must preserve this ownership binding.

Private agent history is encrypted separately under the session's owner-bound key. It must not be appended to general conversation messages or exposed as a shared resource. Temporary captures, downloads and old private checkpoints are retained for at most 24 hours; browser event metadata is retained for 30 days. The scheduled cleanup must run in the deployed environment. Cleanup deletes only objects it has actually swept before removing their database records.

## HTTP interface

All routes authenticate the current user. Every mutation requires an `Origin` header equal to the request URL's origin. Responses use private, no-store caching. JSON request bodies are limited to 20,000 bytes. Identifiers below are application IDs.

- `GET /api/browser`: readiness, private sessions and profiles.
- `POST /api/browser/sessions`: `{objective,allowedDomains,maxCredits,conversationId?,profileId?}` creates a draft without provider traffic.
- `GET /api/browser/sessions/:id`: the current private session DTO.
- `POST /api/browser/sessions/:id/activate`: `{approved:true,version}` activates the stored mandate once.
- `POST /api/browser/sessions/:id/control`: `{action,version}` for `pause`, `resume`, `takeover`, `return`, `stop` or `close`; `remember` additionally requires `name` and `consent:true`; `confirm_result` requires `approved:true` and the current version after a result has been proposed.
- `DELETE /api/browser/sessions/:id`: closes the session.
- `POST /api/browser/sessions/:id/actions`: `{command}` proposes a strict structured browser command. No script, arbitrary selector, evaluation or provider options are accepted. Human input uses `{human:true,command:{kind:"pointer",x,y}}` or `{human:true,command:{kind:"type",value}}`. The server infers the last known private page ID and its internal human sentinel without reading the DOM. These commands are transit only.
- `POST /api/browser/sessions/:id/actions/:actionId`: `{decision:"approve",version,approved:true}` or `{decision:"reject",version}` decides one exact proposal.
- `GET /api/browser/sessions/:id/events?after=:seq`: bounded events and a monotonic cursor. Events contain only type, status, domain and timestamps.
- `GET /api/browser/sessions/:id/snapshot`: an agent-mode capture artifact descriptor; capture is serialized against takeover.
- `GET /api/browser/sessions/:id/snapshot?human=1`: direct owner-only PNG during human control, without persistence.
- `GET /api/browser/sessions/:id/view`: authenticated private live frame; no screenshot artifact, DOM observation or credentials are persisted. The panel can poll every three seconds while visible and the user can suspend the view. Transfer quota applies.
- `POST /api/browser/sessions/:id/reconcile`: `{version}` reads the provider's history receipt and reconciles the existing shared hold. It does not reopen a browser or repeat a website action. An unknown receipt keeps the reservation and prevents result confirmation.
- `GET /api/browser/sessions/:id/artifacts`: private unexpired artifacts.
- `GET /api/browser/sessions/:id/artifacts/:artifactId/download`: private bytes with attachment and content security headers.
- `POST /api/browser/sessions/:id/artifacts/:artifactId/export`: promotes a temporary artifact through file content validation, deduplication and the existing storage quota transaction, returning `{fileId}`.
- `GET /api/browser/profiles` and `DELETE /api/browser/profiles/:profileId`: list or delete the requesting user's private profiles.

Navigation requires its own precise approval and is restricted to approved exact HTTPS domain names. URLs with embedded credentials, nonstandard destinations, private host names or address literals are rejected by policy. Authentication query parameters require a human flow. Redirects, frames, popups, WebSockets, downloads and service workers need provider-level acceptance testing as well as policy unit tests.

## Staging acceptance and remaining limits

Run `node tests/browser.integration.mjs` for the real SQLite/WebCrypto service suite and the driver/policy suites for the pinned provider adapter. These tests use deterministic fixtures and injected provider responses. Also run repository typecheck, lint, build and existing integration suites before release.

Use a dedicated test account and harmless controlled destinations for real staging. Verify authenticated session creation, each role, team privacy, exact proposal review, stale approvals, replay, pointer/type secrecy, profile consent and deletion, multiple tabs, allowed downloads, file promotion quota rollback, plan downgrade, stop during work, deadline cleanup and credit reconciliation. Inspect database rows, logs, R2 prefixes and API responses for credentials or provider connection data. Confirm that a real provider history receipt settles one shared hold and that missing receipts remain reserved.

Exact-host validation rejects obvious private destinations, but application checks cannot establish what a remote provider's DNS resolver reaches. A public-looking domain may resolve privately or change answers after validation. Detached redirects, DNS rebinding, private-address resolution and provider egress behavior require a verified provider-side policy and staging evidence. Do not claim complete SSRF isolation from hostname checks alone. Likewise, a retained connection is not a documented reconstruction protocol after owner loss. These limits are release blockers unless the deployment supplies and verifies the missing guarantees.

## Livraison et preuves — 21 octobre 2026

**VÉRIFIÉ localement** : typecheck, ESLint, build Worker/client, suites unitaires, intégration SQLite/WebCrypto, HTTP et inspection du bundle. Aucun appel fournisseur payant pendant ces tests.

- `tests/browser-driver.test.mjs` et `tests/browser-policy.test.mjs` : 29 contrôles du pilote et des restrictions, avec SDK installé et transport simulé.
- `tests/browser.integration.mjs` : 29 scénarios exécutés avec la vraie base SQLite, le chiffrement WebCrypto et un pilote injecté. Permissions, approbations, profils, quotas, fichiers, coûts et lien vers les missions sont couverts.
- `tests/browser-agent.integration.mjs` : 7 scénarios de la vraie boucle de protocole, notamment capture native, checkpoint interrompu et absence de répétition.
- `tests/browser-owner.integration.mjs` : 5 scénarios du vrai code Durable Object avec stockage local simulé : sérialisation, réveil sans interface connectée, attente et interruption. Cela ne prouve pas la disponibilité réelle de Cloudflare.
- `tests/browser-ui.browser.mjs` : 14 parcours exécutés dans Chromium, desktop et mobile, avec le vrai composant React et des API locales simulées. Captures dans `.tmp/browser-ui-browser/` (non commitées).

La liste Missions contient un lien générique vers chaque session privée, sans objectif privé, observation ni profil dans la ressource partagée. Le planificateur de missions général refuse ces identifiants : seules les API privées et le Durable Object peuvent les exécuter. Le rapprochement lit les justificatifs existants ; il ne reprend jamais une action incertaine. Les réservations non rapprochées conservent leur référence fournisseur pour permettre cette vérification.

Cloudflare fixe les domaines autorisés à la création du navigateur. `browser_extend_domains` prépare donc un nouveau mandat à faire approuver et ferme l'ancienne session. Il ne modifie pas silencieusement les droits d'une session ouverte. Seul un profil déjà mémorisé avec consentement peut être repris ; une connexion temporaire n'est pas enregistrée automatiquement.

**NON VÉRIFIÉ / activation bloquée** : aucun parcours réel Cloudflare, compte de test distant, redémarrage du propriétaire en staging, sécurité de sortie DNS ni grille de consommation validée n'a été exécuté. L'identité actuelle dépend de l'injection de confiance de l'hébergeur Sites. Un Worker public qui accepte directement des en-têtes d'identité envoyés par le client ne convient pas : une passerelle authentifiée qui supprime ces en-têtes, ou une authentification serveur équivalente, doit être configurée et testée avant `BROWSER_AUTH_VERIFIED=true`.

Sources officielles consultées le 21 octobre 2026 : [garde-fous](https://developers.cloudflare.com/browser-run/features/guardrails/), [Durable Objects](https://developers.cloudflare.com/browser-run/how-to/browser-run-with-do/), [tarification](https://developers.cloudflare.com/browser-run/pricing/), [Browser Tool Composio](https://docs.composio.dev/toolkits/browser_tool), [Browserbase Composio](https://docs.composio.dev/toolkits/browserbase_tool). Aucun prix fournisseur n'est fixé par cette implémentation. L'allocation de coût doit inclure durée, concurrence, Worker, Durable Object, D1, R2 et transferts avant validation de la marge.

Pour relancer :

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npm test
# Avec Playwright/Chromium disponible dans l'environnement de test :
# définir AIRA_PLAYWRIGHT_MODULE si Playwright est fourni hors node_modules
node tests/browser-ui.browser.mjs
```

Pour une future activation, préparer un environnement staging distinct avec DB/R2 privés, la migration additive, les bindings et les secrets serveur ; valider ensuite le parcours du plan sur un site contrôlé et les justificatifs de coût. Conserver les interrupteurs d'activation à `false` jusque-là. Le push GitHub ne lance aucune bascule ni migration de production.
