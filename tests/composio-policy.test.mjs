import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {safeComposioUserId, isReadOnlyTool, parseInstantCatalog, instantPlanLimits, parseActualInstantCharge, canonicalJSON} from '../lib/composio-policy.mjs';

const now = Date.parse('2026-10-18T12:00:00Z');
const entry = {toolkit: 'example', toolSlug: 'EXAMPLE_READ', maxCostUsd: '0.05', verifiedAt: '2026-10-18T11:00:00Z', sourceUrl: 'https://docs.composio.dev/docs/instant-tools'};

test('Composio identity is stable, tenant-scoped, and contains no original identity', async () => {
  const actual = await safeComposioUserId('org-a', 'user-private');
  assert.equal(actual, 'aira_' + createHash('sha256').update('org-a\0user-private').digest('hex'));
  assert.equal(await safeComposioUserId('org-a', 'user-private'), actual);
  assert.notEqual(await safeComposioUserId('org-b', 'user-private'), actual);
  assert.notEqual(await safeComposioUserId('org-a', 'other-user'), actual);
  assert.match(actual, /^aira_[0-9a-f]{64}$/);
});

test('malformed identity cannot create delimiter or Unicode hashing collisions', async () => {
  for (const identity of ['', null, 1, 'a\0b', '\ud800', 'a'.repeat(513)]) {
    await assert.rejects(safeComposioUserId(identity, 'user'));
    await assert.rejects(safeComposioUserId('tenant', identity));
  }
});

test('read-only execution requires explicit unambiguous safe tool metadata', () => {
  assert.equal(isReadOnlyTool({tags: ['readOnlyHint']}), true);
  assert.equal(isReadOnlyTool({tags: ['readOnlyHint', 'idempotentHint']}), true);
  for (const tags of [undefined, [], ['idempotentHint'], 'readOnlyHint', ['readOnlyHint', null], ['readOnlyHint', 'unknownHint']]) {
    assert.equal(isReadOnlyTool({tags}), false);
  }
  for (const unsafe of ['createHint', 'updateHint', 'destructiveHint', 'openWorldHint']) {
    assert.equal(isReadOnlyTool({tags: ['readOnlyHint', unsafe]}), false);
  }
  assert.equal(isReadOnlyTool(null), false);
});

test('an absent Instant upper-bound catalogue never authorizes any tool', () => {
  for (const raw of [undefined, null, '', '[]', []]) assert.deepEqual(parseInstantCatalog(raw, now), []);
});

test('administrator-verified prices are exact immutable integer microUSD', () => {
  const parsed = parseInstantCatalog(JSON.stringify([entry, {...entry, toolSlug: 'EXAMPLE_OTHER', maxCostUsd: 0.000001}]), now);
  assert.equal(parsed[0].maxCostMicros, 50_000);
  assert.equal(parsed[1].maxCostMicros, 1);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed[0]), true);
  assert.throws(() => { parsed[0].maxCostMicros = 0; });
});

test('unbounded, zero, negative, rounded, and above-plan Instant estimates are rejected', () => {
  for (const maxCostUsd of [0, '0', -1, '-0.01', '0.0000001', 0.0000001, '0.100001', '1e-2', ' 0.01', '0.01 USD', '01', NaN, Infinity, null, undefined]) {
    assert.throws(() => parseInstantCatalog([{...entry, maxCostUsd}], now), String(maxCostUsd));
  }
});

test('Instant price verification expires after thirty days and cannot be future-dated', () => {
  const exactlyThirtyDays = new Date(now - 30 * 86400000).toISOString();
  assert.equal(parseInstantCatalog([{...entry, verifiedAt: exactlyThirtyDays}], now).length, 1);
  for (const verifiedAt of [new Date(now - 30 * 86400000 - 1).toISOString(), new Date(now + 1).toISOString(), 'invalid', '2026-10-18', 123]) {
    assert.throws(() => parseInstantCatalog([{...entry, verifiedAt}], now));
  }
  assert.throws(() => parseInstantCatalog([{...entry, verifiedAt: '2026-02-30T12:00:00Z'}], Date.parse('2026-03-03T00:00:00Z')));
});

test('price source verification denies lookalike domains, credentials, and arbitrary sites', () => {
  for (const sourceUrl of ['https://composio.dev/pricing', 'https://docs.composio.dev/docs/instant-tools']) {
    assert.equal(parseInstantCatalog([{...entry, sourceUrl}], now).length, 1);
  }
  for (const sourceUrl of ['http://docs.composio.dev/price', 'https://docs.composio.dev.evil.test/', 'https://evil.test/?docs.composio.dev', 'https://user:password@docs.composio.dev/', 'https://docs.composio.dev:444/price', 'file:///price']) {
    assert.throws(() => parseInstantCatalog([{...entry, sourceUrl}], now));
  }
});

test('malformed registry, duplicate tools and invalid slugs fail closed', () => {
  for (const raw of ['{', '{}', '[null]', [{}], [entry, entry], [{...entry, toolkit: '../metaads'}], [{...entry, toolSlug: 'name with spaces'}]]) {
    assert.throws(() => parseInstantCatalog(raw, now));
  }
});

test('Instant caps protect free users and do not multiply Business organization budget by member count', () => {
  assert.deepEqual(instantPlanLimits('free'), {monthlyMicros: 0, perCallMicros: 0, organizationMonthlyMicros: 0});
  assert.deepEqual(instantPlanLimits('pro'), {monthlyMicros: 500_000, perCallMicros: 50_000, organizationMonthlyMicros: 500_000});
  assert.deepEqual(instantPlanLimits('business'), {monthlyMicros: 2_000_000, perCallMicros: 100_000, organizationMonthlyMicros: 2_000_000});
  assert.deepEqual(instantPlanLimits('unknown-plan'), instantPlanLimits('free'));
  assert.deepEqual(instantPlanLimits('__proto__'), instantPlanLimits('free'));
  assert.deepEqual(instantPlanLimits('constructor'), instantPlanLimits('free'));
});

test('only explicit Composio USD charge settles a reservation, including a confirmed zero', () => {
  assert.equal(parseActualInstantCharge({instant_charge: {amount: '0.010001', currency: 'USD', charged_by: 'composio'}}), 10_001);
  assert.equal(parseActualInstantCharge({instantCharge: {amount: '0', currency: 'USD', chargedBy: 'composio'}}), 0);
  assert.equal(parseActualInstantCharge({amount: '0.10', currency: 'USD'}), 100_000);
  for (const charge of [null, {}, {amount: 0.01, currency: 'USD'}, {amount: '0.01', currency: 'XAF'}, {amount: '0.01'}, {amount: '-1', currency: 'USD'}, {amount: '0.0000001', currency: 'USD'}, {amount: '0.1', currency: 'USD', charged_by: 'untrusted'}, {amount: 'Infinity', currency: 'USD'}]) {
    assert.equal(parseActualInstantCharge(charge), null);
  }
});

test('approval serialization ignores key ordering while preserving exact argument values', () => {
  assert.equal(canonicalJSON({b: [1, 'two'], a: {z: false, c: null}}), '{"a":{"c":null,"z":false},"b":[1,"two"]}');
  assert.equal(canonicalJSON({a: 1, b: 2}), canonicalJSON({b: 2, a: 1}));
  assert.notEqual(canonicalJSON({budget: 10}), canonicalJSON({budget: 100}));
  assert.notEqual(canonicalJSON({account: 'one'}), canonicalJSON({account: 'two'}));
  assert.notEqual(canonicalJSON([1, 2]), canonicalJSON([2, 1]));
});

test('approval serialization rejects values JSON would silently omit, coerce or execute', () => {
  const cycle = {}; cycle.self = cycle;
  const getter = Object.defineProperty({}, 'sideEffect', {enumerable: true, get() { assert.fail('Getter must never execute'); }});
  const sparse = []; sparse.length = 1;
  const withExtra = []; withExtra.extra = true;
  const symbolKey = {[Symbol('hidden')]: 1};
  for (const value of [undefined, {x: undefined}, NaN, Infinity, {x: () => 1}, BigInt(1), new Date(), cycle, getter, sparse, withExtra, symbolKey]) {
    assert.throws(() => canonicalJSON(value));
  }
});
