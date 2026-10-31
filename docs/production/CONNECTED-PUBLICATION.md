# Connected publication and advertising diagnosis

Checked on 2026-10-26 using production configuration, D1 audit aggregates and read-only Composio account/session metadata. No social publication, campaign creation, advertising activation or paid model call was executed during diagnosis.

## Confirmed blockers

- The specialized social calendar is closed in production (`SOCIAL_ENABLED`, network, publishing and staging-verification flags are false); no verified adapter registry is configured. This is independent of the guarded generic connector path.
- `save_campaign_plan` creates a private resource only. It is not a campaign launch API. Its former description also declared that the entire version could not launch ads, misleading the model about separately available connector actions.
- Composio metadata for the existing application scopes contained an active Facebook connection and an expired Meta Ads connection. These are scoped connections, not a global account usable by every workspace. An active OAuth connection does not establish Page management or advertising permissions.
- At inspection, no connector action approval/execution receipt existed in production. Authorization-link requests do not prove publication attempts or successful consent.
- The authenticated owner's own scope had no saved connector session/account mapping. Existing connections must not be reassigned to it or shared across identities.
- Native Meta dashboard OAuth is unconfigured and requests read scopes; it is separate from Composio advertising execution. An enabled custom Meta Ads auth configuration already exists in Composio; its presence does not renew an expired user account.

## Correction

The agent now has `braand_connector_status`, a bounded diagnosis of discovered toolkits using the current user/workspace scope. It reports expired/missing/active accounts without authorizing or executing an external tool and explicitly leaves permissions unverified. Foreign account selection cannot be reported as an active own connection.

Agent instructions distinguish the social calendar, native Meta reads, campaign drafts and guarded connected actions. In Accompanied mode, the principal model discovers actual tools, checks connections and real destinations, requests reconnection when needed, then creates exact approval proposals. Ad budgets, currency and duration or total limits must be explicit. Approval receipts, not a draft or a paused campaign, establish actual execution status. A failed connector initialization is now also communicated to the model instead of only emitting a client event.

Autonomous planning and approved internal mission permissions are unchanged. No blanket activation, new OAuth credentials, automatic consent, spend, provider mutation or uncertain retry was introduced.

## Validation and limits

The service suite exercises the real approval, ownership, resource and database code with a simulated SDK: expired/missing/foreign connection diagnosis, bounded inputs, Facebook publication pending before approval, exactly-once execution under competing approvals, authoritative receipts, and existing Meta campaign approval protections. The real orchestration suite verifies the updated capability guidance. CI runs typecheck, lint, build and the complete offline/browser suites.

These checks do not prove real publication permissions or ad delivery. Meta Ads must be reconnected in the same authenticated Braand workspace. The model must subsequently read the actual Page/ad-account access before preparing an operation for human approval. The specialized social calendar remains unavailable until its adapters and production prerequisites are validated.
