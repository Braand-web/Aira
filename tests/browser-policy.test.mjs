import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BrowserPolicyError, browserCommandNeedsApproval, normalizeBrowserDomains,
  parseBrowserCommand, validateBrowserURL,
} from '../lib/browser-policy.mjs';

const target = {pageId: 't_1', observationId: 'obs-123', targetRef: 'e1_abcd'};
const rejectsPolicy = (fn, code) => assert.throws(fn, error => error instanceof BrowserPolicyError && (!code || error.code === code));

test('domains normalize case, IDNA and terminal dots, deduplicating exact hosts', () => {
  assert.deepEqual(normalizeBrowserDomains([' EXAMPLE.COM. ', 'example.com', 'Shop.Example.com', 'bücher.de']),
    ['example.com', 'shop.example.com', 'xn--bcher-kva.de']);
  assert.deepEqual(normalizeBrowserDomains([]), []);
  rejectsPolicy(() => normalizeBrowserDomains(Array(51).fill('example.com')), 'browser_invalid_domains');
});

test('domain lists reject URLs, wildcards, local names, address literals and alternate IP encodings', () => {
  for (const input of [null, 'example.com', {}, [null], [''], ['*'], ['*.example.com'], ['https://example.com'],
    ['example.com:443'], ['example.com/path'], ['example.com@evil.com'], ['%65xample.com'], ['example.com\\evil'],
    ['localhost'], ['app.localhost'], ['printer.local'], ['api.internal'], ['localdomain'], ['intranet.home.arpa'],
    ['foo.test'], ['foo.invalid'], ['foo.onion'], ['private.corp'], ['single-label'], ['example..com'], ['-x.com'],
    ['x-.com'], ['exa_mple.com'], ['127.0.0.1'], ['10.0.0.1'], ['169.254.169.254'], ['8.8.8.8'],
    ['2130706433'], ['0x7f000001'], ['0177.0.0.1'], ['127.1'], ['[::1]'], ['[2606:4700:4700::1111]'],
    ['::ffff:127.0.0.1'], ['example.com\u0000'], ['exam\u200bple.com'], [`${'a'.repeat(64)}.com`]]) {
    rejectsPolicy(() => normalizeBrowserDomains(input), 'browser_invalid_domains');
  }
});

test('URLs allow HTTPS with canonical port and enforce exact normalized destination hosts', () => {
  assert.equal(validateBrowserURL('https://EXAMPLE.COM.:443/path?q=value#section', ['example.com']).href,
    'https://example.com/path?q=value#section');
  assert.equal(validateBrowserURL('https://bücher.de/', ['xn--bcher-kva.de']).hostname, 'xn--bcher-kva.de');
  for (const url of ['https://sub.example.com/', 'https://example.com.evil.com/', 'https://evil.com/']) {
    rejectsPolicy(() => validateBrowserURL(url, ['example.com']), 'browser_domain_not_allowed');
  }
  rejectsPolicy(() => validateBrowserURL('https://example.com/', []), 'browser_domain_not_allowed');
});

test('URLs reject credentials, unsafe protocols, private destinations, parser ambiguities and oversized input', () => {
  for (const url of [null, new URL('https://example.com/'), '', '//example.com', 'http://example.com/',
    'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hello', 'ftp://example.com/',
    'https://user:secret@example.com/', 'https://@example.com/', 'https://example.com:444/',
    'https:///example.com', 'https://example.com\\@evil.com/', 'https://%65xample.com/',
    ' https://example.com/', 'https://exam\tple.com/', 'https://example.com/a b',
    'https://localhost/', 'https://app.internal/', 'https://127.1/', 'https://0x7f000001/',
    'https://[::1]/', 'https://[::ffff:169.254.169.254]/', 'https://8.8.8.8/',
    `https://example.com/${'x'.repeat(4096)}`]) {
    rejectsPolicy(() => validateBrowserURL(url), 'browser_invalid_url');
  }
});

test('commands accept only the fixed per-kind schema and copy validated values', () => {
  const source = {kind: 'fill', ...target, value: 'hello\nworld'};
  const parsed = parseBrowserCommand(source);
  source.value = 'changed';
  assert.deepEqual(parsed, {kind: 'fill', ...target, value: 'hello\nworld'});
  assert.ok(Object.isFrozen(parsed));
  assert.deepEqual(parseBrowserCommand({kind: 'navigate', url: 'https://EXAMPLE.com:443'}),
    {kind: 'navigate', url: 'https://example.com/'});
  assert.equal(parseBrowserCommand({kind: 'fill', ...target, value: ''}).value, '');
  assert.equal(parseBrowserCommand({kind: 'select', ...target, value: ''}).value, '');
  assert.equal(parseBrowserCommand({kind: 'press', ...target, key: 'ControlOrMeta+Shift+A'}).key, 'ControlOrMeta+Shift+A');
  assert.equal(parseBrowserCommand({kind: 'upload', ...target, fileId: 'file-123'}).fileId, 'file-123');
});

test('script hooks, selectors, extraneous fields and non-data object properties fail closed', () => {
  for (const input of [null, [], 'click', {}, {kind: 'evaluate', value: '1+1'}, {kind: 'constructor'},
    {kind: 'click', ...target, script: 'alert(1)'}, {kind: 'click', ...target, evaluate: '1+1'},
    {kind: 'click', ...target, selector: '#submit'}, {kind: 'click', ...target, force: true},
    {kind: 'click', ...target, url: 'https://example.com'}, {kind: 'new_tab', url: 'https://example.com', pageId: 't_1'},
    {kind: 'scroll', deltaY: 100, [Symbol('secret')]: true}, Object.create({kind: 'scroll', deltaY: 100})]) {
    rejectsPolicy(() => parseBrowserCommand(input), 'browser_invalid_command');
  }
  let getterCalled = false;
  const accessor = {get kind() { getterCalled = true; return 'scroll'; }, deltaY: 100};
  rejectsPolicy(() => parseBrowserCommand(accessor), 'browser_invalid_command');
  assert.equal(getterCalled, false);
  rejectsPolicy(() => parseBrowserCommand(Object.defineProperty({kind: 'scroll', deltaY: 100}, 'secret', {value: true})), 'browser_invalid_command');
});

test('element commands require current observation references and bounded opaque identities', () => {
  for (const kind of ['click', 'fill', 'press', 'select', 'upload']) {
    const extra = kind === 'press' ? {key: 'Enter'} : kind === 'upload' ? {fileId: 'file-1'} : ['fill', 'select'].includes(kind) ? {value: 'x'} : {};
    rejectsPolicy(() => parseBrowserCommand({kind, targetRef: 'e1', ...extra}), 'browser_invalid_command');
    rejectsPolicy(() => parseBrowserCommand({kind, observationId: 'obs1', ...extra}), 'browser_invalid_command');
    rejectsPolicy(() => parseBrowserCommand({kind, ...target, targetRef: '#submit', ...extra}), 'browser_invalid_command');
  }
  for (const bad of ['', 'x'.repeat(257), '../secret', 't 1', null, 1, undefined]) {
    rejectsPolicy(() => parseBrowserCommand({kind: 'select_tab', pageId: bad}), 'browser_invalid_command');
  }
  for (const value of [null, 1, 'x'.repeat(10_001), '\u0000secret', '\ud800']) {
    rejectsPolicy(() => parseBrowserCommand({kind: 'fill', ...target, value}), 'browser_invalid_command');
  }
});

test('keyboard and coordinate commands are tightly bounded', () => {
  for (const key of ['Enter', 'Escape', 'ArrowDown', 'Shift+Tab', 'ControlOrMeta+A', 'F12', 'KeyA', 'Digit0', '+', 'é']) {
    assert.equal(parseBrowserCommand({kind: 'press', ...target, key}).key, key);
  }
  for (const key of ['', 'a'.repeat(65), 'alert(1)', 'Control++A', 'Control+Control+A', 'ControlOrMeta+Meta+A',
    'Shift+NotAKey', 'F13', 'a\nb', '\u0000', '\ud800', null]) {
    rejectsPolicy(() => parseBrowserCommand({kind: 'press', ...target, key}), 'browser_invalid_command');
  }
  assert.deepEqual(parseBrowserCommand({kind: 'pointer', observationId: 'obs1', x: 0, y: 16_384}),
    {kind: 'pointer', observationId: 'obs1', x: 0, y: 16_384});
  for (const x of [-1, 16_385, 1.5, Infinity, NaN, '10']) {
    rejectsPolicy(() => parseBrowserCommand({kind: 'pointer', observationId: 'obs1', x, y: 10}), 'browser_invalid_command');
  }
  for (const deltaY of [-10_000, -1, 1, 10_000]) assert.equal(parseBrowserCommand({kind: 'scroll', deltaY}).deltaY, deltaY);
  for (const deltaY of [0, 10_001, -10_001, 1.5, NaN, '10']) rejectsPolicy(() => parseBrowserCommand({kind: 'scroll', deltaY}), 'browser_invalid_command');
  rejectsPolicy(() => parseBrowserCommand({kind: 'pointer', x: 1, y: 1}), 'browser_invalid_command');
  rejectsPolicy(() => parseBrowserCommand({kind: 'type', observationId: 'obs1', value: ''}), 'browser_invalid_command');
});

test('approval classification gates every mutation and validates unknown commands', () => {
  const commands = [
    {kind: 'click', ...target}, {kind: 'fill', ...target, value: 'x'}, {kind: 'press', ...target, key: 'Enter'},
    {kind: 'select', ...target, value: 'x'}, {kind: 'upload', ...target, fileId: 'f1'},
    {kind: 'pointer', observationId: 'o1', x: 1, y: 1}, {kind: 'type', observationId: 'o1', value: 'x'},
    {kind: 'close_tab', pageId: 't1'},
  ];
  for (const command of commands) assert.equal(browserCommandNeedsApproval(command), true);
  for (const command of [{kind: 'navigate', url: 'https://example.com'}, {kind: 'new_tab', url: 'https://example.com'},
    {kind: 'scroll', deltaY: 100}, {kind: 'select_tab', pageId: 't1'}]) assert.equal(browserCommandNeedsApproval(command), false);
  rejectsPolicy(() => browserCommandNeedsApproval({kind: 'evaluate', script: 'secret'}), 'browser_invalid_command');
});

test('policy errors expose only fixed messages, codes and bounded HTTP status', () => {
  const secret = 'private-password-or-token';
  const error = new BrowserPolicyError(secret, 200);
  assert.equal(error.code, 'browser_policy_rejected');
  assert.equal(error.message, 'Browser request rejected.');
  assert.equal(error.status, 400);
  assert.ok(!String(error).includes(secret));
  assert.throws(() => validateBrowserURL('https://user:private-password-or-token@example.com/'), error =>
    error instanceof BrowserPolicyError && !String(error).includes(secret));
  assert.equal(new BrowserPolicyError('browser_domain_not_allowed', 403).status, 403);
});
