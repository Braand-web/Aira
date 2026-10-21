/** @typedef {import('./browser-contracts').BrowserCommand} BrowserCommand */

const ERROR_MESSAGES = Object.freeze({
  browser_policy_rejected: 'Browser request rejected.',
  browser_invalid_command: 'Invalid browser command.',
  browser_invalid_domains: 'Invalid browser domain list.',
  browser_invalid_url: 'Invalid browser URL.',
  browser_domain_not_allowed: 'Browser destination is not allowed.',
});

/** Policy errors contain fixed public messages and never echo browser input. */
export class BrowserPolicyError extends Error {
  /** @param {string} [code] @param {number} [status] */
  constructor(code = 'browser_policy_rejected', status = 400) {
    const safeCode = Object.hasOwn(ERROR_MESSAGES, code) ? code : 'browser_policy_rejected';
    super(ERROR_MESSAGES[safeCode]);
    this.name = 'BrowserPolicyError';
    this.code = safeCode;
    this.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 400;
  }
}

/** @param {string} code @param {number} [status] @returns {never} */
function reject(code, status = 400) {
  throw new BrowserPolicyError(code, status);
}

const MAX_URL_CHARS = 4096;
const MAX_VALUE_CHARS = 10_000;
const IDENTIFIER = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,255}$/u;
const FORBIDDEN_HOST_SUFFIXES = Object.freeze([
  'localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan',
  'home', 'home.arpa', 'corp', 'private', 'test', 'example', 'invalid', 'onion', 'alt',
]);
const NAMED_KEYS = new Set([
  'Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'Space', 'ArrowUp', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Insert',
]);
const MODIFIERS = new Set(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift']);
const ACTION_FIELDS = ['pageId', 'observationId', 'targetRef'];
const COMMAND_FIELDS = Object.freeze({
  navigate: ['url', 'pageId', 'observationId'],
  new_tab: ['url'],
  click: ACTION_FIELDS,
  fill: [...ACTION_FIELDS, 'value'],
  press: [...ACTION_FIELDS, 'key'],
  select: [...ACTION_FIELDS, 'value'],
  scroll: ['pageId', 'observationId', 'deltaY'],
  select_tab: ['pageId'],
  close_tab: ['pageId', 'observationId'],
  upload: [...ACTION_FIELDS, 'fileId'],
  pointer: ['pageId', 'observationId', 'x', 'y'],
  type: ['pageId', 'observationId', 'value'],
});
const TARGET_ACTIONS = new Set(['click', 'fill', 'press', 'select', 'upload']);
const APPROVAL_ACTIONS = new Set(['click', 'fill', 'press', 'select', 'upload', 'pointer', 'type', 'close_tab']);

/** @param {unknown} input @returns {string} */
function normalizeHostname(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 1024 || !input.isWellFormed()) {
    reject('browser_invalid_domains');
  }
  const value = input.trim();
  // Only a hostname is accepted: URL syntax, wildcards, address literals and
  // encoded host syntax must never turn an exact allowlist into a broader rule.
  if (!value || /[\s\p{Cc}\p{Cf}\\/:@?#%*\[\]]/u.test(value)) reject('browser_invalid_domains');
  let parsed;
  try { parsed = new URL(`https://${value}/`); } catch { reject('browser_invalid_domains'); }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/u, '');
  if (hostname.length > 253 || !hostname.includes('.') || /^[0-9.]+$/u.test(hostname)) reject('browser_invalid_domains');
  const labels = hostname.split('.');
  if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))) reject('browser_invalid_domains');
  if (FORBIDDEN_HOST_SUFFIXES.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
    reject('browser_invalid_domains');
  }
  return hostname;
}

/**
 * Normalize exact public DNS names. No network or DNS resolution is performed;
 * the browser provider must also enforce network egress and redirect policy.
 * An empty list is valid and denies every destination when used as an allowlist.
 * @param {unknown} input
 * @returns {string[]}
 */
export function normalizeBrowserDomains(input) {
  if (!Array.isArray(input) || input.length > 50) reject('browser_invalid_domains');
  const result = new Set();
  for (const entry of input) result.add(normalizeHostname(entry));
  return [...result];
}

/** @param {unknown} input @param {unknown} [allowedDomains] @returns {URL} */
export function validateBrowserURL(input, allowedDomains) {
  if (typeof input !== 'string' || !input.length || input.length > MAX_URL_CHARS ||
    !input.isWellFormed() || /[\s\p{Cc}\p{Cf}\\]/u.test(input) || !/^https:\/\//iu.test(input)) {
    reject('browser_invalid_url');
  }
  let parsed;
  try { parsed = new URL(input); } catch { reject('browser_invalid_url'); }
  const authority = input.slice(input.indexOf('://') + 3).split(/[/?#]/u, 1)[0];
  if (!authority || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || authority.includes('@') || authority.includes('%')) {
    reject('browser_invalid_url');
  }
  let hostname;
  try { hostname = normalizeHostname(parsed.hostname); } catch { reject('browser_invalid_url'); }
  parsed.hostname = hostname;
  if (allowedDomains !== undefined && !normalizeBrowserDomains(allowedDomains).includes(hostname)) {
    reject('browser_domain_not_allowed', 403);
  }
  return parsed;
}

/** @param {unknown} value @returns {string} */
function identifier(value) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) reject('browser_invalid_command');
  return value;
}

/** @param {unknown} value @returns {string} */
function textValue(value) {
  if (typeof value !== 'string' || value.length > MAX_VALUE_CHARS || value.includes('\0') || !value.isWellFormed()) {
    reject('browser_invalid_command');
  }
  return value;
}

/** @param {unknown} value @returns {string} */
function keyboardKey(value) {
  if (typeof value !== 'string' || !value.length || value.length > 64 || !value.isWellFormed() || /[\p{Cc}\p{Cf}]/u.test(value)) {
    reject('browser_invalid_command');
  }
  const parts = value === '+' ? ['+'] : value.split('+');
  const key = parts.pop();
  if (parts.length > 4 || new Set(parts).size !== parts.length || parts.some(part => !MODIFIERS.has(part))) reject('browser_invalid_command');
  if (parts.includes('ControlOrMeta') && (parts.includes('Control') || parts.includes('Meta'))) reject('browser_invalid_command');
  if (!key || !(NAMED_KEYS.has(key) || /^F(?:[1-9]|1[0-2])$/u.test(key) || /^(?:Key[A-Z]|Digit[0-9])$/u.test(key) || Array.from(key).length === 1)) {
    reject('browser_invalid_command');
  }
  return value;
}

/** @param {unknown} value @param {boolean} [scroll] @returns {number} */
function coordinate(value, scroll = false) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) ||
    (scroll ? value === 0 || Math.abs(value) > 10_000 : value < 0 || value > 16_384)) {
    reject('browser_invalid_command');
  }
  return value;
}

/**
 * Parse untrusted JSON into a fresh fixed-shape command. Selector, script,
 * evaluation and provider-specific options are deliberately unsupported.
 * @param {unknown} input
 * @returns {BrowserCommand}
 */
export function parseBrowserCommand(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('browser_invalid_command');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) reject('browser_invalid_command');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).some(key => typeof key !== 'string')) reject('browser_invalid_command');
  if (Object.values(descriptors).some(descriptor => !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))) reject('browser_invalid_command');
  const kind = descriptors.kind?.value;
  if (typeof kind !== 'string' || !Object.hasOwn(COMMAND_FIELDS, kind)) reject('browser_invalid_command');
  const fields = COMMAND_FIELDS[kind];
  if (Object.keys(descriptors).some(key => key !== 'kind' && !fields.includes(key))) reject('browser_invalid_command');
  /** @type {BrowserCommand} */
  const command = {kind};
  for (const field of ['pageId', 'observationId', 'targetRef', 'fileId']) {
    if (Object.hasOwn(descriptors, field)) command[field] = identifier(descriptors[field].value);
  }
  if (TARGET_ACTIONS.has(kind) && (!command.observationId || !command.targetRef)) reject('browser_invalid_command');
  if (['select_tab', 'close_tab'].includes(kind) && !command.pageId) reject('browser_invalid_command');
  if (['pointer', 'type'].includes(kind) && !command.observationId) reject('browser_invalid_command');
  if (['navigate', 'new_tab'].includes(kind)) command.url = validateBrowserURL(descriptors.url?.value).href;
  if (['fill', 'select', 'type'].includes(kind)) command.value = textValue(descriptors.value?.value);
  if (kind === 'type' && !command.value) reject('browser_invalid_command');
  if (kind === 'press') command.key = keyboardKey(descriptors.key?.value);
  if (kind === 'upload' && !command.fileId) reject('browser_invalid_command');
  if (kind === 'scroll') command.deltaY = coordinate(descriptors.deltaY?.value, true);
  if (kind === 'pointer') {
    command.x = coordinate(descriptors.x?.value);
    command.y = coordinate(descriptors.y?.value);
  }
  return Object.freeze(command);
}

/** @param {unknown} command @returns {boolean} */
export function browserCommandNeedsApproval(command) {
  return APPROVAL_ACTIONS.has(parseBrowserCommand(command).kind);
}
