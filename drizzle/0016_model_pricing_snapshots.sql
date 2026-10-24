-- Global, public-source prices only. Never contains a key, tenant or conversation.
CREATE TABLE model_pricing_snapshots (
 policy_hash TEXT PRIMARY KEY,
 quote TEXT NOT NULL CHECK(json_valid(quote)),
 checked_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at>checked_at)
);
