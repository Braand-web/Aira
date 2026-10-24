import {PLANS, PACKS, topupPrice} from './billing-core.mjs';

// This is an internal Braand design ceiling, not a supplier tariff or a measured cost.
export const DESIGN_COST_PER_CREDIT_XAF = 4;
export const REQUIRED_COST_CATEGORIES = Object.freeze([
  'model', 'media', 'connectors', 'infrastructure', 'emails',
  'payment', 'conversionAndPayout', 'support', 'unrecoveredCosts',
]);

export function salesCommitments() {
  const subscriptions = Object.entries(PLANS).map(([plan, value]) => (
    {id: `${plan}:period`, grossXaf: value.periodPrice, credits: value.credits, serviceMonths: 1}
  ));
  return [...subscriptions, ...PACKS.map(credits => ({
    id: `topup:${credits}`, grossXaf: topupPrice(credits), credits, serviceMonths: 0,
  }))];
}

// A sensitivity calculation only. It must never enable billing or assert a real margin.
export function designHeadroom(offer, {paymentFeeBps, taxBps} = {}) {
  if (![offer?.grossXaf, offer?.credits, paymentFeeBps, taxBps].every(Number.isFinite) ||
      offer.grossXaf <= 0 || offer.credits < 0 || paymentFeeBps < 0 ||
      paymentFeeBps > 10000 || taxBps < 0 || taxBps > 10000) {
    return {status: 'BLOCKED', reason: 'An explicit tax and payment fee scenario is required.'};
  }
  const netXaf = offer.grossXaf / (1 + taxBps / 10000);
  const designExecutionXaf = offer.credits * DESIGN_COST_PER_CREDIT_XAF;
  const paymentXaf = offer.grossXaf * paymentFeeBps / 10000;
  return {
    status: 'SCENARIO_ONLY', id: offer.id, netXaf, designExecutionXaf, paymentXaf,
    remainingVariableCostBudgetXaf: netXaf * .25 - designExecutionXaf - paymentXaf,
    note: 'Not measured. Remaining budget must cover every cost outside the execution ceiling.',
  };
}

function hasEvidence(value) {
  return typeof value === 'string' && value.trim().length >= 3;
}

// Actual evidence is mandatory even for zero costs. Unknown is never interpreted as free.
// Revenue is net of tax and refunds, so neither is subtracted a second time as a cost.
export function assessMeasuredMargin(input) {
  const blocked = [];
  if (!Number.isFinite(input?.recognizedRevenueXaf) || input.recognizedRevenueXaf <= 0 ||
      !hasEvidence(input.revenueEvidence)) blocked.push('recognizedRevenue');
  for (const category of REQUIRED_COST_CATEGORIES) {
    const entry = input?.costs?.[category];
    if (!Number.isFinite(entry?.amountXaf) || entry.amountXaf < 0 ||
        !hasEvidence(entry.evidence)) blocked.push(category);
  }
  if (blocked.length) return {status: 'BLOCKED', eligible: false, missing: blocked, margin: null};
  const variableCostsXaf = REQUIRED_COST_CATEGORIES.reduce((total, key) => total + input.costs[key].amountXaf, 0);
  const margin = (input.recognizedRevenueXaf - variableCostsXaf) / input.recognizedRevenueXaf;
  return {status: 'MEASURED', eligible: margin >= .75, margin, variableCostsXaf, recognizedRevenueXaf: input.recognizedRevenueXaf};
}
