'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.join(__dirname, '..', 'dist');
const code = fs.readFileSync(path.join(dist, 'hero.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const key = 'gj-home-visual-v1';
function load(options = {}) {
  const window = { GuaData: {}, ...options };
  const box = { window }; vm.createContext(box);
  vm.runInContext('Math.random = function () { throw new Error("Unseeded randomness is forbidden"); };', box);
  for (const file of ['data/hexagrams.js', 'data/reports-a.js', 'data/reports-b.js']) vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), box);
  vm.runInContext(code, box, { filename: 'hero.js' });
  return { hero: window.GuaHero, data: window.GuaData, window };
}
function storage(initial = {}) {
  const values = new Map(Object.entries(initial)), calls = [];
  return { values, calls, getItem: name => { calls.push(['get', name]); return values.get(name) ?? null; }, setItem: (name, value) => { calls.push(['set', name, value]); values.set(name, value); } };
}

test('hero choice supports both uint32 boundaries and is deterministic without unseeded randomness', () => {
  const { hero } = load();
  for (const seed of [0, 1, 42, 2147483647, 2147483648, 4294967295]) {
    const a = hero.choose(seed), b = hero.choose(seed);
    assert.deepEqual(plain(a), plain(b)); assert.equal(a.seed, seed); assert.match(a.layout, /^[A-E]$/); assert.ok(a.hexagramId >= 1 && a.hexagramId <= 64); assert.ok(Object.isFrozen(a));
  }
  for (const invalid of [-1, 4294967296, 1.5, NaN, Infinity, '42', undefined, null, {}, 1n]) assert.throws(() => hero.choose(invalid), /32-bit unsigned integer/);
});

test('all 320 independent layout/hexagram pairs are reachable and repeatable', () => {
  const { hero } = load(), pairs = new Set();
  for (let seed = 0; seed < 65536 && pairs.size < 320; seed++) {
    const choice = hero.choose(seed); pairs.add(choice.layout + '/' + choice.hexagramId);
    assert.deepEqual(plain(hero.choose(seed)), plain(choice));
  }
  assert.equal(pairs.size, 320);
  for (const layout of 'ABCDE') for (let id = 1; id <= 64; id++) assert.ok(pairs.has(layout + '/' + id));
});

test('a new visit uses crypto once and persists only its version and seed', () => {
  let calls = 0;
  const store = storage({ 'guajian-self.session.v5': '{"keep":"private"}' });
  const { hero } = load({ crypto: { getRandomValues: values => { calls++; assert.equal(values.length, 1); values[0] = 4294967295; return values; } }, sessionStorage: store });
  const first = hero.getVisit(); assert.equal(first.seed, 4294967295);
  assert.equal(hero.getVisit(store), first); assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(store.values.get(key)), { version: 1, seed: 4294967295 });
  assert.equal(store.values.get('guajian-self.session.v5'), '{"keep":"private"}');
  assert.ok(store.calls.every(call => call[1] === key));
});

test('a tab refresh restores its seed while separate tab storage creates a fresh visit', () => {
  const store = storage(), first = load().hero.getVisit(store, () => 0);
  const restored = load().hero.getVisit(store, () => { throw new Error('Stored seed must avoid entropy'); });
  assert.deepEqual(plain(restored), plain(first));
  const secondTab = load().hero.getVisit(storage(), () => 17); assert.equal(secondTab.seed, 17);
});

test('corrupt, old, extra-field, and invalid-seed storage safely rebuilds its own namespace', () => {
  for (const saved of ['{broken', 'null', '[]', '{}', '{"version":2,"seed":42}', '{"version":1,"seed":-1}', '{"version":1,"seed":"42"}', '{"version":1,"seed":1.5}', '{"version":1,"seed":4294967296}', '{"version":1,"seed":42,"answers":[]}']) {
    const store = storage({ [key]: saved, unrelated: 'retained' });
    assert.equal(load().hero.getVisit(store, () => 77).seed, 77);
    assert.deepEqual(JSON.parse(store.values.get(key)), { version: 1, seed: 77 }); assert.equal(store.values.get('unrelated'), 'retained');
  }
});

test('blocked, incomplete, or unavailable storage keeps the same in-memory visit', () => {
  for (const store of [null, {}, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, { getItem() { return null; }, setItem() { throw new Error('quota'); } }]) {
    let entropy = 0; const { hero } = load();
    const first = hero.getVisit(store, () => { entropy++; return 555; });
    assert.equal(hero.getVisit(store, () => { throw new Error('Must reuse in-memory visit'); }), first); assert.equal(entropy, 1);
  }
  const { hero, window } = load(); Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked getter'); } });
  assert.equal(hero.getVisit(undefined, () => 999).seed, 999); assert.equal(hero.getVisit(undefined, () => 1).seed, 999);
});

test('invalid entropy and missing crypto fail clearly without saving a fabricated seed', () => {
  for (const value of [-1, 4294967296, 2.5, '42', undefined, null, NaN]) {
    const store = storage(); assert.throws(() => load().hero.getVisit(store, () => value), /32-bit unsigned integer/); assert.equal(store.values.has(key), false);
  }
  assert.throws(() => load().hero.getVisit(null), /crypto.getRandomValues/);
  assert.throws(() => load().hero.getVisit(null, 3), /entropyFn/);
});

test('all 64 contexts preserve original line order, names, upper/lower trigrams and sources', () => {
  const { hero, data } = load(), before = JSON.stringify(data);
  for (let id = 1; id <= 64; id++) {
    const ctx = hero.context({ seed: id, layout: 'A', hexagramId: id }, data);
    assert.equal(ctx.id, id); assert.equal(ctx.shortName, ctx.hexagram.chineseName);
    assert.equal(ctx.hexagram, data.iching.hexagrams.find(h => h.number === id));
    assert.equal(ctx.top.number, ctx.hexagram.topTrigram); assert.equal(ctx.bottom.number, ctx.hexagram.bottomTrigram);
    assert.deepEqual(plain(ctx.hexagram.lines), plain(ctx.bottom.lines.concat(ctx.top.lines)));
    assert.equal(ctx.name, ctx.top.number === ctx.bottom.number ? ctx.shortName + '為' + ctx.top.chineseImage : ctx.top.chineseImage + ctx.bottom.chineseImage + ctx.shortName);
    assert.equal(ctx.trigrams, data.iching.trigrams); assert.equal(ctx.hexagrams, data.iching.hexagrams); assert.equal(ctx.quote, data.reports[id].quote); assert.ok(Object.isFrozen(ctx));
  }
  assert.equal(hero.context({ seed: 1, layout: 'A', hexagramId: 1 }, data).name, '乾為天');
  assert.equal(hero.context({ seed: 26, layout: 'E', hexagramId: 26 }, data).name, '山天大畜');
  assert.equal(JSON.stringify(data), before);
});

test('missing report quote uses a generic sentence and inconsistent hexagram data is rejected', () => {
  const { hero, data } = load(), copy = plain(data), choice = { seed: 26, layout: 'E', hexagramId: 26 };
  copy.reports = {}; assert.match(hero.context(choice, copy).quote, /以一卦為起點/);
  copy.iching.hexagrams.find(h => h.number === 26).lines[0] = 0;
  assert.throws(() => hero.context(choice, copy), /lower and upper trigrams/);
  for (const invalid of [null, {}, { seed: -1, layout: 'A', hexagramId: 1 }, { seed: 1, layout: 'F', hexagramId: 1 }, { seed: 1, layout: 'A', hexagramId: 0 }, { seed: 1, layout: 'A', hexagramId: 65 }]) assert.throws(() => hero.context(invalid, data), /valid choice/);
  assert.throws(() => hero.context(choice, {}), /original 64 hexagrams/);
});

test('render dispatches exactly the selected registered layout and never silently substitutes one', () => {
  const { hero, data } = load(); const called = [];
  assert.throws(() => hero.render({ seed: 1, layout: 'C', hexagramId: 26 }, data), /layout C has not been registered/);
  for (const layout of 'ABCDE') hero.register(layout, ctx => { called.push([layout, ctx.id]); return '<figure data-layout="' + layout + '">' + ctx.name + '</figure>'; });
  for (const layout of 'ABCDE') assert.equal(hero.render({ seed: 1, layout, hexagramId: 26 }, data), '<figure data-layout="' + layout + '">山天大畜</figure>');
  assert.deepEqual(called, [...'ABCDE'].map(layout => [layout, 26]));
  assert.throws(() => hero.register('F', () => ''), /layout must/); assert.throws(() => hero.register('A', 'bad'), /renderer must/); assert.throws(() => hero.register('A', () => 'replacement'), /already registered/);
  assert.throws(() => hero.render({ seed: 1, layout: 'F', hexagramId: 26 }, data), /valid choice/);
});

test('renderers own escaping and the core neither interpolates nor double-escapes their markup', () => {
  const { hero, data } = load(), source = '<img src=x onerror="alert(1)">&', copy = plain(data);
  copy.reports[26].quote = source;
  const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  hero.register('A', ctx => { assert.equal(ctx.quote, source); return '<figure><p>' + escape(ctx.quote) + '</p></figure>'; });
  const rendered = hero.render({ seed: 1, layout: 'A', hexagramId: 26 }, copy);
  assert.equal(rendered, '<figure><p>' + escape(source) + '</p></figure>'); assert.doesNotMatch(rendered, /<img|&amp;lt;/);
  hero.register('B', () => null); assert.throws(() => hero.render({ seed: 1, layout: 'B', hexagramId: 26 }, data), /must return HTML/);
});
