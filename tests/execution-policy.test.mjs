import test from 'node:test';
import assert from 'node:assert/strict';
import {hasCurrentMediaPrice, instantExplicitlyEnabled} from '../lib/execution-policy.mjs';

test('Media submission refuses future, expired, missing or unbounded prices before reserving credits', () => {
  const now = Date.now();
  const price = {verifiedAt: new Date(now).toISOString(), costCeilingXaf: 4};
  assert.equal(hasCurrentMediaPrice(price, 1, now), true);
  for (const model of [null, {}, {...price, verifiedAt: new Date(now + 1).toISOString()},
    {...price, verifiedAt: new Date(now - 86_400_001).toISOString()},
    {...price, verifiedAt: 'bad'}, {...price, costCeilingXaf: Infinity},
    {...price, costCeilingXaf: 0}, {...price, costCeilingXaf: 5}]) {
    assert.equal(hasCurrentMediaPrice(model, 1, now), false);
  }
  assert.equal(hasCurrentMediaPrice(price, NaN, now), false);
});

test('Instant is OFF unless the administrator explicitly enables it', () => {
  for (const value of [undefined, '', 'false', 'TRUE', '1', true]) {
    assert.equal(instantExplicitlyEnabled(value), false);
  }
  assert.equal(instantExplicitlyEnabled('true'), true);
});
