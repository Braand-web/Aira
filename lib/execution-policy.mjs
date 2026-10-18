// Application safety policies, not vendor prices or vendor quotas.
export function hasCurrentMediaPrice(model, credits, now = Date.now()) {
  if (!model || !Number.isSafeInteger(credits) || credits <= 0) return false;
  const age = now - Date.parse(model.verifiedAt);
  return Number.isFinite(age) && age >= 0 && age <= 86_400_000 &&
    Number.isFinite(model.costCeilingXaf) && model.costCeilingXaf > 0 &&
    model.costCeilingXaf <= credits * 4;
}

export function instantExplicitlyEnabled(value) {
  return value === 'true';
}
