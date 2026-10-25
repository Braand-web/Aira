import assert from 'node:assert/strict';
import test from 'node:test';
import {HELP_ARTICLES, HELP_FAQS, searchHelpArticles} from '../lib/help-content.ts';
import {helpPageMetadata} from '../lib/help-metadata.ts';
import {migrateLegacyBrowserStorage} from '../lib/client-storage.ts';

test('the public help library contains every planned theme and valid related links', () => {
  assert.deepEqual(HELP_ARTICLES.map(article => article.slug), [
    'bien-demarrer', 'discussions-et-fichiers', 'creer-avec-braand',
    'connecteurs-et-autorisations', 'credits-et-facturation',
    'confidentialite', 'raccourcis-clavier',
  ]);
  assert.ok(HELP_FAQS.length >= 20);
  for (const article of HELP_ARTICLES) {
    assert.ok(article.title && article.summary && article.excerpt);
    assert.ok(article.questions.length > 0 && article.sections.length > 0);
    for (const slug of article.related) assert.ok(HELP_ARTICLES.some(item => item.slug === slug), `${article.slug} links to missing article ${slug}`);
  }
  assert.ok(HELP_ARTICLES.every(article => !/openrouter|saspay|fal\.ai/iu.test(JSON.stringify(article))));
});

test('help search is accent-insensitive, searchable in answers, and category-aware', () => {
  assert.ok(searchHelpArticles('confidentialite').some(article => article.slug === 'confidentialite'));
  assert.ok(searchHelpArticles('autorisation').some(article => article.slug === 'connecteurs-et-autorisations'));
  assert.deepEqual(searchHelpArticles('crédits', 'privacy'), []);
  assert.ok(searchHelpArticles('épingler').some(article => article.slug === 'discussions-et-fichiers'));
});

test('public help metadata overrides the private application robots default', () => {
  const hub = helpPageMetadata('/aide', 'Centre d’aide Braand', 'Toutes les réponses pratiques.');
  assert.deepEqual(hub.title, {absolute: 'Centre d’aide Braand'});
  assert.deepEqual(hub.robots, {index: true, follow: true});
  assert.equal(hub.alternates.canonical, 'https://braand.fun/aide');

  const metadata = helpPageMetadata('/aide/bien-demarrer', 'Bien démarrer avec Braand', 'Résumé pratique.');
  assert.deepEqual(metadata.robots, {index: true, follow: true});
  assert.equal(metadata.alternates.canonical, 'https://braand.fun/aide/bien-demarrer');
  assert.equal(metadata.openGraph.siteName, 'Braand');
  assert.equal(metadata.description, 'Résumé pratique.');
});

test('legacy browser preferences migrate byte-for-byte and keep newer values', () => {
  const legacyPrefix = ['ai', 'ra'].join('');
  const values = new Map([[`${legacyPrefix}.draft`, 'Brouillon conservé'], [`${legacyPrefix}.sidebar.user`, 'open'], ['braand.draft', 'Brouillon récent']]);
  const previous = Object.fromEntries(['window', 'localStorage', 'document', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', {configurable: true, value: {}});
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  }});
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {cookie: ''}});
  Object.defineProperty(globalThis, 'location', {configurable: true, value: {protocol: 'https:'}});
  try {
    migrateLegacyBrowserStorage();
    assert.equal(values.get('braand.draft'), 'Brouillon récent');
    assert.equal(values.get('braand.sidebar.user'), 'open');
    assert.equal(values.has(`${legacyPrefix}.draft`), false);
    assert.equal(values.has(`${legacyPrefix}.sidebar.user`), false);
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
