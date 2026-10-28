'use strict';

// Independent behavior tests: execute the published initializer in a small DOM,
// use the real local packs, and watch browser/storage side effects directly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const DIST = path.resolve(__dirname, '../dist');
const SOURCE = fs.readFileSync(path.join(DIST, 'i18n.js'), 'utf8');
const PACKS = new Map();
function pack(code) {
  if (!PACKS.has(code)) PACKS.set(code, JSON.parse(fs.readFileSync(path.join(DIST, 'locales', code + '.json'), 'utf8')));
  return PACKS.get(code);
}
function apiOnly() {
  const context = { URL, console };
  vm.runInNewContext(SOURCE, context, { filename: 'dist/i18n.js' });
  return context.GuaI18n;
}
const API = apiOnly();

class Element {
  constructor(id = '') { this.nodeType = 1; this.id = id; this.dataset = {}; this.attributes = new Map(); this.listeners = new Map(); this.value = ''; this.textContent = ''; this.lang = 'zh-Hant'; }
  closest() { return null; }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); }
  async emit(name) { for (const fn of this.listeners.get(name) || []) await fn({ type: name, target: this }); }
}

async function browser(options = {}) {
  let href = options.url || 'https://example.invalid/?qa=auto-locale&keep=a%20b#quiz/20';
  const initialHistoryState = { route: 'quiz', active: 20, nested: { retained: true } };
  const historyCalls = [], events = [], fetches = [], writes = [], reads = [], navigation = [];
  // No scorer is mocked. These independent opaque saved bytes must stay intact.
  const sessions = new Map([10,20,48].map(mode => ['gj-qa-session-' + mode, JSON.stringify({ version: 5, mode, seed: 1000 + mode, answers: [-2,0,2], questionIds: ['Q1','Q2','Q3'], position: 2 })]));
  sessions.set('gj-state-v5', JSON.stringify({ version: 5, sessions: { 10: { answers: [0,2], position: 1 }, 20: { answers: [-1], position: 0 }, 48: { answers: [2,0,-2], position: 2 } }, archived: ['retained'] }));
  const savedBytes = new Map(sessions);
  if (Object.hasOwn(options, 'saved')) sessions.set('gj-language-v1', options.saved);
  const storage = {
    getItem(key) { reads.push(key); if (options.readError) throw new Error('Storage read denied'); return sessions.has(key) ? sessions.get(key) : null; },
    setItem(key, value) { writes.push({ key, value }); if (options.writeError) throw new Error('Storage write denied'); sessions.set(key, String(value)); },
    removeItem(key) { throw new Error('Unexpected record removal: ' + key); },
    clear() { throw new Error('Unexpected clear'); }
  };
  const location = {
    get href() { if (options.locationError) throw new Error('Location unavailable'); return href; },
    set href(value) { navigation.push(['href', value]); href = String(value); },
    reload() { navigation.push(['reload']); }, assign(value) { navigation.push(['assign', value]); }, replace(value) { navigation.push(['replace', value]); }
  };
  const history = { state: initialHistoryState,
    replaceState(state, title, url) { if (options.historyError) throw new Error('History unavailable'); historyCalls.push({ state, title, url }); this.state = state; href = String(url); },
    pushState() { throw new Error('Unexpected extra history entry'); }
  };
  const select = new Element('language-select'), status = new Element('language-status'), brand = new Element('brand');
  const document = {
    documentElement: new Element('html'), body: new Element('body'),
    getElementById(id) { return id === 'language-select' ? select : id === 'language-status' ? status : null; },
    querySelector(selector) { return selector === '.brand' ? brand : null; },
    createTreeWalker() { return { nextNode() { return null; } }; }
  };
  const navigator = {};
  Object.defineProperty(navigator, 'languages', { get() { if (options.languagesError) throw new Error('languages unavailable'); return Object.hasOwn(options,'languages') ? options.languages : []; } });
  Object.defineProperty(navigator, 'language', { get() { if (options.languageError) throw new Error('language unavailable'); return options.language; } });
  const window = {
    document, location, history, navigator,
    get localStorage() { if (options.storageError) throw new Error('Storage unavailable'); return storage; },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    fetch: async function(url, init) {
      fetches.push({ url, init });
      const code = path.basename(new URL(url, 'https://example.invalid/').pathname, '.json');
      return { ok: true, json: async () => pack(code) };
    },
    dispatchEvent(event) { events.push(event); },
    MutationObserver: class { observe() {} },
    CustomEvent: class { constructor(type, config) { this.type = type; this.detail = config.detail; } }
  };
  const context = { window, URL, console, MutationObserver: window.MutationObserver, CustomEvent: window.CustomEvent };
  vm.runInNewContext(SOURCE, context, { filename: 'dist/i18n.js' });
  await window.GuaI18n.ready;
  return { api: window.GuaI18n, document, select, status, sessions, savedBytes, writes, reads, history, initialHistoryState, historyCalls, navigation, events, fetches, href: () => href };
}
function unchangedQuiz(harness) {
  for (const [key, original] of harness.savedBytes) assert.equal(harness.sessions.get(key), original, key + ' changed');
  assert.ok(harness.writes.every(row => row.key === 'gj-language-v1'), 'Locale code wrote a questionnaire/session key');
  assert.ok(harness.reads.every(key => key === 'gj-language-v1'), 'Locale code read a questionnaire/session key');
  assert.deepEqual(harness.navigation, [], 'Locale change must not reload or navigate');
}

test('canonicalizes all eleven supported browser language families', () => {
  const cases = { 'zh-TW':'zh-Hant', 'zh-CN':'zh-Hans', 'en-US':'en', 'ja-JP':'ja', 'ko-KR':'ko', 'hi-IN':'hi', 'th-TH':'th', 'id-ID':'id', 'de-DE':'de', 'fr-CA':'fr', 'es-MX':'es', 'in-ID':'id', ' EN_gb ':'en' };
  for (const [tag, expected] of Object.entries(cases)) assert.equal(API.matchLocale(tag), expected, tag);
  for (const tag of [null, undefined, 11, {}, '', 'xx-ZZ', 'en US', '../en']) assert.equal(API.matchLocale(tag), null);
});

test('Chinese script wins over region; bare Chinese defaults to simplified', () => {
  const cases = { 'zh-Hant-CN':'zh-Hant', 'zh-Hans-TW':'zh-Hans', 'zh-HK':'zh-Hant', 'zh-MO':'zh-Hant', 'zh-SG':'zh-Hans', 'zh-MY':'zh-Hans', zh:'zh-Hans' };
  for (const [tag, expected] of Object.entries(cases)) assert.equal(API.matchLocale(tag), expected, tag);
});

test('pure selection preserves ordered preferences and explicit URL fallback', () => {
  assert.equal(API.selectInitialLocale({url:'https://test.invalid/?lang=fr-CA',saved:'ja',languages:['ko']}), 'fr');
  assert.equal(API.selectInitialLocale({url:'https://test.invalid/?lang=',saved:'ja',languages:['ko']}), 'en');
  assert.equal(API.selectInitialLocale({url:'https://test.invalid/?lang=unknown',saved:'ja',languages:['ko']}), 'en');
  assert.equal(API.selectInitialLocale({url:'https://test.invalid/',saved:'invalid',languages:['xx','fr-CA','de'],language:'ja'}), 'fr');
  assert.equal(API.selectInitialLocale({url:'https://test.invalid/',saved:'in-ID',languages:['fr']}), 'id');
});

const INITIAL_CASES = [
  ['URL region variant overrides storage and browser', {url:'https://example.invalid/?lang=de-AT&qa=1#quiz/48',saved:'ja',languages:['ko-KR'],language:'fr'}, 'de'],
  ['URL explicit unsupported falls back to English', {url:'https://example.invalid/?lang=pt-BR#quiz/10',saved:'ja',languages:['ko']}, 'en'],
  ['URL explicit empty falls back to English', {url:'https://example.invalid/?lang=#quiz/10',saved:'ja',languages:['ko']}, 'en'],
  ['URL whitespace falls back to English', {url:'https://example.invalid/?lang=%20%20#quiz/10',saved:'ja',languages:['ko']}, 'en'],
  ['valid saved preference overrides browser', {saved:'zh-HK',languages:['en-US'],language:'fr'}, 'zh-Hant'],
  ['invalid saved value proceeds to ordered navigator preferences', {saved:'broken',languages:['unsupported','es-AR','de-DE'],language:'ja'}, 'es'],
  ['first supported browser family wins', {languages:['pt-BR','ko-KR','en-US'],language:'de'}, 'ko'],
  ['navigator.language is fallback after unsupported languages', {languages:['pt-BR','xx'],language:'th-TH'}, 'th'],
  ['navigator.language remains available if languages getter throws', {languagesError:true,language:'hi-IN'}, 'hi'],
  ['languages preference remains available if language getter throws', {languages:['fr-CA'],languageError:true}, 'fr'],
  ['both navigator getters may throw safely', {languagesError:true,languageError:true}, 'en'],
  ['storage getter may throw safely', {storageError:true,languages:['id-ID']}, 'id'],
  ['storage getItem may throw safely', {readError:true,languages:['ja-JP']}, 'ja'],
  ['storage setItem failure preserves successful visible locale', {writeError:true,languages:['de-DE']}, 'de'],
  ['no usable preference defaults to English', {languages:[],language:'unknown'}, 'en'],
  ['non-array languages safely uses singular preference', {languages:'fr-FR',language:'es-ES'}, 'es'],
  ['bare zh browser preference chooses simplified Chinese', {languages:['zh']}, 'zh-Hans'],
  ['explicit Hant overrides CN browser region', {languages:['zh-Hant-CN']}, 'zh-Hant'],
  ['legacy Indonesian browser alias selects id', {languages:['in-ID']}, 'id'],
  ['history update failure does not prevent localization', {historyError:true,languages:['ja-JP']}, 'ja'],
  ['location getter failure does not prevent navigator fallback', {locationError:true,languages:['fr-FR']}, 'fr']
];
for (const [name, options, expected] of INITIAL_CASES) test('actual initializer: ' + name, async () => {
  const harness = await browser(options);
  assert.equal(harness.api.locale(), expected);
  assert.equal(harness.document.documentElement.lang, expected);
  assert.equal(harness.select.value, expected);
  assert.equal(harness.document.documentElement.hasAttribute('data-language-loading'), false);
  assert.equal(harness.events.at(-1)?.detail.locale, expected);
  assert.ok(harness.fetches.every(row => row.url.startsWith('./locales/') && row.init.credentials === 'same-origin'));
  if (expected !== 'zh-Hant') assert.notEqual(harness.api.translate('開始探索'), '開始探索', 'A real pack should render visible translated text');
  unchangedQuiz(harness);
});

test('initial URL canonicalization preserves hash, unrelated query and history.state identity', async () => {
  const harness = await browser({url:'https://example.invalid/?qa=matrix-v1&qaRun=R%201&keep=one&keep=two&lang=fr-CA#result/20',saved:'ko',languages:['ja']});
  assert.equal(harness.historyCalls.length, 1);
  const url = new URL(harness.href());
  assert.equal(url.searchParams.get('lang'), 'fr');
  assert.equal(url.searchParams.get('qa'), 'matrix-v1');
  assert.equal(url.searchParams.get('qaRun'), 'R 1');
  assert.deepEqual(url.searchParams.getAll('keep'), ['one','two']);
  assert.equal(url.hash, '#result/20');
  assert.strictEqual(harness.history.state, harness.initialHistoryState);
  assert.strictEqual(harness.historyCalls[0].state, harness.initialHistoryState);
  unchangedQuiz(harness);
});

for (const mode of [10,20,48]) test('manual selection overrides auto locale without changing ' + mode + '-question progress', async () => {
  const harness = await browser({url:'https://example.invalid/?qa=preserve&keep=yes#quiz/'+mode,languages:['de-DE']});
  assert.equal(harness.api.locale(), 'de');
  harness.select.value = 'ja';
  await harness.select.emit('change');
  assert.equal(harness.api.locale(), 'ja');
  assert.equal(harness.document.documentElement.lang, 'ja');
  assert.equal(harness.sessions.get('gj-language-v1'), 'ja');
  assert.equal(new URL(harness.href()).searchParams.get('lang'), 'ja');
  assert.equal(new URL(harness.href()).searchParams.get('qa'), 'preserve');
  assert.equal(new URL(harness.href()).hash, '#quiz/'+mode);
  assert.strictEqual(harness.history.state, harness.initialHistoryState);
  assert.equal(harness.historyCalls.length, 2);
  unchangedQuiz(harness);
  // A fresh page honors the user's explicit choice before browser defaults.
  const revisited = await browser({saved:harness.sessions.get('gj-language-v1'),languages:['de-DE']});
  assert.equal(revisited.api.locale(), 'ja');
});
