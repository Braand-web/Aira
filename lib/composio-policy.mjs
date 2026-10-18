// All amounts in this module are integer millionths of one USD.
const USD_SCALE = 1_000_000;
const MAX_VERIFICATION_AGE = 30 * 24 * 60 * 60 * 1000;
const MAX_INSTANT_CALL_MICROS = 100_000;
const MAX_CATALOG_ENTRIES = 5_000;
const MAX_CATALOG_BYTES = 1_000_000;
const TRUSTED_PRICE_HOSTS = new Set(['docs.composio.dev', 'composio.dev']);
const READ_ONLY_TAGS = new Set(['readOnlyHint', 'idempotentHint']);
const TOOLKIT_PATTERN = /^[a-z][a-z0-9_]{0,99}$/;
const TOOL_PATTERN = /^[A-Z][A-Z0-9_]{0,199}$/;
const PLAN_LIMITS = Object.freeze({
  free: Object.freeze({monthlyMicros: 0, perCallMicros: 0, organizationMonthlyMicros: 0}),
  pro: Object.freeze({monthlyMicros: 500_000, perCallMicros: 50_000, organizationMonthlyMicros: 500_000}),
  business: Object.freeze({monthlyMicros: 2_000_000, perCallMicros: 100_000, organizationMonthlyMicros: 2_000_000}),
});

function invalid(message) {
  throw new TypeError(message);
}

function identityPart(value) {
  if (typeof value !== 'string' || !value.length || value.length > 512 || value.includes('\0') || !value.isWellFormed()) {
    invalid('Invalid Composio identity.');
  }
  return value;
}

/** The tenant is part of the scope; the same person never inherits another tenant's connections. */
export async function safeComposioUserId(tenant, userId) {
  const bytes = new TextEncoder().encode(`${identityPart(tenant)}\0${identityPart(userId)}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'aira_' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Unknown metadata is an approval requirement, never permission to execute. */
export function isReadOnlyTool(metadata) {
  if (!metadata || !Array.isArray(metadata.tags) || !metadata.tags.includes('readOnlyHint')) return false;
  return metadata.tags.every((tag) => typeof tag === 'string' && READ_ONLY_TAGS.has(tag));
}

/** Parse decimal text without binary floating-point arithmetic or rounding a larger price down. */
function decimalMicros(value, {allowZero = false} = {}) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * BigInt(USD_SCALE) + BigInt(fraction.padEnd(6, '0'));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || (!allowZero && amount === 0n)) return null;
  return Number(amount);
}

function catalogPrice(value) {
  // Environment JSON numbers are accepted only when their exact decimal form fits microUSD.
  if (typeof value === 'number' && (!Number.isFinite(value) || value <= 0)) return null;
  return decimalMicros(typeof value === 'number' ? String(value) : value);
}

function verifiedSource(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && TRUSTED_PRICE_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

/** This is an administrator-verified upper-bound registry, not a parser for provider price prose. */
export function parseInstantCatalog(raw, now = Date.now()) {
  if (raw === undefined || raw === null || raw === '') return Object.freeze([]);
  if (!Number.isSafeInteger(now) || now < 0) invalid('Invalid catalogue verification clock.');
  let entries = raw;
  if (typeof raw === 'string') {
    if (new TextEncoder().encode(raw).length > MAX_CATALOG_BYTES) invalid('Instant catalogue is too large.');
    try { entries = JSON.parse(raw); } catch { invalid('Invalid Instant catalogue JSON.'); }
  }
  if (!Array.isArray(entries) || entries.length > MAX_CATALOG_ENTRIES) invalid('Invalid Instant catalogue.');
  const seen = new Set();
  return Object.freeze(entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid('Invalid Instant catalogue entry.');
    const {toolkit, toolSlug, maxCostUsd, verifiedAt, sourceUrl} = entry;
    if (typeof toolkit !== 'string' || typeof toolSlug !== 'string' || !TOOLKIT_PATTERN.test(toolkit) || !TOOL_PATTERN.test(toolSlug)) invalid('Invalid Instant tool identity.');
    const identity = `${toolkit}\0${toolSlug}`;
    if (seen.has(identity)) invalid('Duplicate Instant tool.');
    seen.add(identity);
    const maxCostMicros = catalogPrice(maxCostUsd);
    if (maxCostMicros === null || maxCostMicros > MAX_INSTANT_CALL_MICROS) invalid('Invalid Instant upper cost bound.');
    if (typeof verifiedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(verifiedAt)) {
      invalid('Invalid Instant price verification date.');
    }
    const verifiedTime = Date.parse(verifiedAt);
    if (!Number.isFinite(verifiedTime) || new Date(verifiedTime).toISOString().slice(0, 19) !== verifiedAt.slice(0, 19) || verifiedTime > now || now - verifiedTime > MAX_VERIFICATION_AGE) {
      invalid('Instant upper cost bound needs verification.');
    }
    if (!verifiedSource(sourceUrl)) invalid('Untrusted Instant price source.');
    return Object.freeze({toolkit, toolSlug, maxCostMicros, verifiedAt, sourceUrl});
  }));
}

/** Business members each have a limit, but their organization shares a maximum of $2/month. */
export function instantPlanLimits(plan) {
  return typeof plan === 'string' && Object.hasOwn(PLAN_LIMITS, plan) ? PLAN_LIMITS[plan] : PLAN_LIMITS.free;
}

/** Only Composio's explicit USD charge is evidence of a settled cost. Missing cost remains unresolved. */
export function parseActualInstantCharge(raw) {
  const charge = raw?.instantCharge ?? raw?.instant_charge ?? raw;
  if (!charge || typeof charge !== 'object' || Array.isArray(charge) || charge.currency !== 'USD') return null;
  if (charge.charged_by !== undefined && charge.charged_by !== 'composio') return null;
  if (charge.chargedBy !== undefined && charge.chargedBy !== 'composio') return null;
  return decimalMicros(charge.amount, {allowZero: true});
}

/** Stable serialization for exact-argument approvals. Reject values JSON would silently drop or coerce. */
export function canonicalJSON(value) {
  const seen = new Set();
  function serialize(input, depth) {
    if (depth > 50) invalid('Approval arguments exceed the depth limit.');
    if (input === null || typeof input === 'boolean' || typeof input === 'string') return JSON.stringify(input);
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) invalid('Approval arguments must contain finite numbers.');
      return JSON.stringify(input);
    }
    if (typeof input !== 'object') invalid('Approval arguments must be JSON values.');
    if (seen.has(input)) invalid('Approval arguments must not be cyclic.');
    const proto = Object.getPrototypeOf(input);
    if (!Array.isArray(input) && proto !== Object.prototype && proto !== null) invalid('Approval arguments must be plain JSON objects.');
    if (Object.getOwnPropertySymbols(input).length) invalid('Approval arguments must not contain symbols.');
    seen.add(input);
    let result;
    if (Array.isArray(input)) {
      const parts = [];
      for (let i = 0; i < input.length; i++) {
        const property = Object.getOwnPropertyDescriptor(input, String(i));
        if (!property || !('value' in property)) invalid('Approval arguments must not contain sparse arrays or accessors.');
        parts.push(serialize(property.value, depth + 1));
      }
      if (Object.keys(input).some((key) => !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= input.length)) invalid('Approval arrays must not have extra properties.');
      result = `[${parts.join(',')}]`;
    } else {
      result = '{' + Object.keys(input).sort().map((key) => {
        const property = Object.getOwnPropertyDescriptor(input, key);
        if (!property || !('value' in property)) invalid('Approval arguments must not contain accessors.');
        return `${JSON.stringify(key)}:${serialize(property.value, depth + 1)}`;
      }).join(',') + '}';
    }
    seen.delete(input);
    return result;
  }
  return serialize(value, 0);
}
