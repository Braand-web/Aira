import test from 'node:test';
import assert from 'node:assert/strict';
import {missionCostIsSettled, missionUsageIsKnown} from '../lib/mission-policy.mjs';

test('an unknown, incomplete, estimated or future provider state never proves a settled mission cost', () => {
  for (const status of ['pending', 'unknown', 'estimated', 'invoicing', '', null, undefined]) {
    assert.equal(missionUsageIsKnown(['complete', status]), false);
    assert.equal(missionCostIsSettled('settled', ['complete', status]), false);
  }
  for (const invalid of [undefined, null, {}, 'complete']) assert.equal(missionUsageIsKnown(invalid), false);
});

test('known model usage does not release a missing or still reserved credit hold', () => {
  for (const status of [undefined, null, 'reserved', 'needs_reconciliation', 'cancelled']) {
    assert.equal(missionCostIsSettled(status, ['complete']), false);
  }
});

test('only settled holds with definitive receipts, including a run making no model request, are reviewable', () => {
  assert.equal(missionCostIsSettled('settled', ['complete', 'rejected']), true);
  assert.equal(missionCostIsSettled('settled', []), true);
});
