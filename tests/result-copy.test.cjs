'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));

function load() {
  const box = { window: {} };
  vm.createContext(box);
  vm.runInContext('Math.random = function () { throw new Error("Unseeded randomness"); }; Date = function () { throw new Error("Clock dependency"); };', box);
  for (const file of ['data/questions.js', 'data/mapping.js', 'data/bank.js', 'core.js', 'bank.js', 'short-legacy.js', 'short.js', 'full.js', 'result-copy.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), box, { filename: file });
  }
  return box.window;
}
const { GuaData: D, GuaCore: Core, GuaShort: Short, GuaFull: Full, GuaShortLegacy: Legacy, GuaResultCopy: Copy } = load();
const originalData = JSON.stringify(D);
const originalQuestions = D.questions;
const originalVersions = plain(D.versions);
const cache = new Map();

function full(name, mainVote, clarificationVote = () => 0) {
  if (cache.has(name)) return cache.get(name);
  let session = Full.create(904);
  const seen = {};
  for (const q of Full.questions(session).slice(0, 48)) {
    const index = seen[q.axis] || 0;
    seen[q.axis] = index + 1;
    session = Full.answer(session, q.id, mainVote(q, index) * q.direction);
  }
  for (const q of Full.questions(session).slice(48)) session = Full.answer(session, q.id, clarificationVote(q) * q.direction);
  const result = { session, scored: Full.score(session) };
  assert.equal(result.scored.finished, true);
  cache.set(name, result);
  return result;
}
function short(mode, vote, seed = 417) {
  const name = 'short/' + mode + '/' + vote + '/' + seed;
  if (cache.has(name)) return cache.get(name);
  let session = Short.create(mode, seed);
  while (!Short.score(session).finished) {
    const index = session.answers.length;
    assert.ok(index < mode + 6, 'clarification remains bounded');
    const q = Short.questions(session)[index];
    session = Short.answer(session, index, vote * q.direction);
  }
  const result = { session, scored: Short.score(session) };
  cache.set(name, result);
  return result;
}
function legacyTie() {
  const answers = Object.fromEntries(D.questions.map(q => [q.id, 0]));
  const ties = Object.fromEntries(D.axes.map((axis, index) => [axis.id, index % 2 ? -1 : 1]));
  const scored = Core.score(answers, ties);
  scored.mode = 48; scored.legacy = true; scored.legacyFull = true;
  // The archive view adds evidence counts without changing the legacy classification.
  for (const axis of D.axes) Object.assign(scored.scores[axis.id], { total: 8, maxAbs: 16, answered: 8 });
  return { session: { answers, ties }, scored };
}
function legacyBinary() {
  const session = {
    mode: 10, seed: 91, version: '1.0.0', bankVersion: D.bank.version,
    questionIds: ['QB006307', 'QB085325', 'QB032403', 'QB059753', 'QB048713', 'QB073404', 'QB006778', 'QB014857', 'QB018949', 'QB025637'],
    answers: Array.from({ length: 10 }, (_, index) => index % 3 === 0 ? -1 : 1)
  };
  return { session: Legacy.restore(session), scored: Object.assign(Legacy.score(session), { legacy: true }) };
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
function strings(copy) {
  return [copy.label, copy.positive, copy.negative, copy.heading, copy.direction, ...copy.qualifiers, copy.accessibleLabel];
}
test.afterEach(() => {
  assert.equal(D.questions, originalQuestions);
  assert.equal(JSON.stringify(D), originalData);
  assert.deepEqual(plain(D.versions), originalVersions);
});

test('display module loads independently in a browser VM and CommonJS', () => {
  const browser = { window: {} };
  vm.createContext(browser);
  vm.runInContext(fs.readFileSync(path.join(root, 'dist/result-copy.js'), 'utf8'), browser);
  const common = require('../dist/result-copy.js');
  for (const api of [Copy, browser.window.GuaResultCopy, common]) {
    assert.equal(api.VERSION, 'reader-v1');
    assert.ok(Object.isFrozen(api));
    assert.deepEqual(Object.keys(api).sort(), ['VERSION', 'axes', 'axis']);
  }
  const scored = short(10, 2).scored;
  assert.deepEqual(plain(common.axes(scored, D.axes)), plain(Copy.axes(scored, D.axes)));
});

test('real 10, 20 and 48 question scores preserve both endpoint directions', () => {
  for (const mode of [10, 20, 48]) for (const sign of [1, -1]) {
    const { scored } = mode === 48 ? full('endpoint/' + sign, () => sign * 2) : short(mode, sign * 2);
    assert.equal(scored.complete, true);
    const copies = Copy.axes(scored, D.axes);
    assert.equal(copies.length, 6);
    for (const [index, axis] of D.axes.entries()) {
      const copy = copies[index];
      assert.equal(copy.side, scored.scores[axis.id].side);
      assert.equal(copy.side, sign > 0 ? 'positive' : 'negative');
      assert.equal(copy.open, false);
      assert.equal(copy.heading, '這次較靠近「' + copy[copy.side] + '」');
      assert.equal(copy.count, scored.scores[axis.id].total);
      assert.notEqual(copy.positive, copy.negative);
      assert.ok(copy.accessibleLabel.includes(copy.direction));
    }
  }
  const sample = Copy.axes(short(10, 2).scored, D.axes);
  assert.equal(sample.find(copy => copy.id === 'information').label, '理解事情的方式');
  assert.equal(new Set(sample.map(copy => copy.label)).size, 6);
});

test('neutral and cancelling answers remain open without inventing a neutral personality', () => {
  const neutral = short(20, 0).scored;
  const cancelling = full('cancelling', (_, index) => index === 0 ? 2 : index === 1 ? -2 : 0).scored;
  assert.equal(neutral.allNeutral, true);
  assert.equal(cancelling.allNeutral, false);
  for (const scored of [neutral, cancelling]) {
    assert.equal(scored.complete, false);
    assert.equal(scored.hexagramId, null);
    assert.equal(scored.type, null);
    assert.deepEqual(plain(scored.candidateHexagramIds), Array.from({ length: 64 }, (_, index) => index + 1));
    for (const copy of Copy.axes(scored, D.axes)) {
      assert.equal(copy.open, true);
      assert.equal(copy.side, null);
      assert.equal(copy.position, 50);
      assert.equal(copy.direction, '這個面向暫時保持開放。');
      assert.match(copy.qualifiers[0], /先不替你選邊/);
      assert.doesNotMatch(copy.direction + copy.qualifiers.join(''), /靈活|彈性|能力|擅長|適應力/);
      assert.equal(copy.mixed, !scored.allNeutral);
    }
  }
});

test('near midpoint nonzero results keep their direction and carry a distinct close-answer reminder', () => {
  for (const sign of [1, -1]) {
    const scored = full('near/' + sign, (_, index) => index === 0 ? sign : 0).scored;
    for (const copy of Copy.axes(scored, D.axes)) {
      assert.equal(copy.open, false);
      assert.equal(copy.nearMidpoint, true);
      assert.equal(copy.mixed, false);
      assert.equal(copy.clarificationDependent, false);
      assert.equal(copy.side, sign > 0 ? 'positive' : 'negative');
      assert.ok(copy.qualifiers.some(text => /兩邊的回答很接近/.test(text)));
      assert.ok(sign > 0 ? copy.position < 50 : copy.position > 50);
    }
  }
  for (const copy of Copy.axes(full('endpoint/1', () => 2).scored, D.axes)) {
    assert.equal(copy.nearMidpoint, false);
    assert.ok(!copy.qualifiers.some(text => /兩邊的回答很接近/.test(text)));
  }
});

test('mixed responses are distinguished from close responses and survive alongside them', () => {
  const mixed = full('mixed', (_, index) => index === 1 ? -1 : 2).scored;
  const mixedNear = full('mixed-near', (_, index) => index === 0 ? 2 : index === 1 ? -1 : 0).scored;
  for (const [scored, near] of [[mixed, false], [mixedNear, true]]) {
    for (const copy of Copy.axes(scored, D.axes)) {
      assert.equal(copy.mixed, true);
      assert.equal(copy.nearMidpoint, near);
      assert.ok(copy.qualifiers.some(text => /同時支持兩種做法/.test(text)));
      assert.equal(copy.qualifiers.some(text => /兩邊的回答很接近/.test(text)), near);
    }
  }
});

test('one-item evidence is visible without applying that limitation to other axes', () => {
  for (const mode of [10, 20]) {
    const scored = short(mode, 2).scored;
    const copies = Copy.axes(scored, D.axes);
    assert.equal(copies.filter(copy => copy.singleItem).length, mode === 10 ? 4 : 0);
    for (const copy of copies) {
      assert.equal(copy.singleItem, scored.scores[copy.id].singleItem);
      assert.equal(copy.qualifiers.some(text => /只來自一道題/.test(text)), copy.singleItem);
    }
  }
});

test('a nonzero answer to a real clarification is described as clarification dependent', () => {
  for (const sign of [1, -1]) {
    const scored = full('clarification/' + sign, () => 0, () => sign).scored;
    assert.equal(scored.clarificationAnswered, 6);
    assert.equal(scored.complete, true);
    for (const copy of Copy.axes(scored, D.axes)) {
      const score = scored.scores[copy.id];
      assert.equal(score.mainSum, 0);
      assert.equal(score.clarificationCount, 1);
      assert.equal(copy.side, score.side);
      assert.equal(copy.clarificationDependent, true);
      assert.ok(copy.qualifiers.some(text => /主要由補充情境的回答帶出/.test(text)));
      assert.equal(copy.open, false);
    }
  }
  for (const copy of Copy.axes(full('cancelling', (_, index) => index === 0 ? 2 : index === 1 ? -2 : 0).scored, D.axes)) assert.equal(copy.clarificationDependent, false);
});

test('legacy zero-sum ties keep the recorded side, label and classification', () => {
  const { scored } = legacyTie();
  assert.equal(scored.complete, true);
  const before = plain(scored);
  for (const axis of D.axes) {
    const copy = Copy.axis(scored, axis);
    assert.equal(scored.scores[axis.id].sum, 0);
    assert.equal(copy.side, scored.scores[axis.id].side);
    assert.equal(copy.open, false);
    assert.equal(copy.legacyTie, true);
    assert.equal(copy.clarificationDependent, false);
    assert.equal(copy.position, 50);
    assert.ok(copy.direction.includes('「' + scored.scores[axis.id].label + '」'));
    assert.match(copy.qualifiers.join(''), /沿用當時.*沒有重新判定/);
  }
  assert.deepEqual(plain(scored), before);
  const binary = legacyBinary().scored;
  assert.equal(binary.resultKey, 'ISFJ-calm-autonomous');
  assert.equal(binary.hexagramId, 27);
  for (const copy of Copy.axes(binary, D.axes)) {
    assert.equal(copy.side, binary.scores[copy.id].side);
    assert.equal(copy.legacyTie, false);
  }
});

test('display calls accept frozen engine outputs and never alter sessions, scores, axes or versions', () => {
  const fixtures = [short(10, 2), short(20, 0), full('mixed-near', (_, index) => index === 0 ? 2 : index === 1 ? -1 : 0), full('clarification/1', () => 0, () => 1), legacyTie(), legacyBinary()];
  const definitions = deepFreeze(plain(D.axes));
  const definitionsBefore = JSON.stringify(definitions);
  for (const fixture of fixtures) {
    const before = JSON.stringify(fixture);
    const frozen = deepFreeze(plain(fixture.scored));
    assert.deepEqual(plain(Copy.axes(frozen, definitions)), plain(Copy.axes(frozen, definitions)));
    assert.equal(JSON.stringify(fixture), before);
    assert.deepEqual(plain(frozen), plain(fixture.scored));
  }
  assert.equal(JSON.stringify(definitions), definitionsBefore);
});

test('all visible and accessible result descriptions omit raw values, formulas and percentages', () => {
  const fixtures = [
    ...[10, 20].flatMap(mode => [-2, 0, 2].map(vote => short(mode, vote))),
    full('endpoint/1', () => 2), full('endpoint/-1', () => -2),
    full('near/1', (_, index) => index === 0 ? 1 : 0),
    full('near/-1', (_, index) => index === 0 ? -1 : 0),
    full('mixed', (_, index) => index === 1 ? -1 : 2),
    full('mixed-near', (_, index) => index === 0 ? 2 : index === 1 ? -1 : 0),
    full('cancelling', (_, index) => index === 0 ? 2 : index === 1 ? -2 : 0),
    full('clarification/1', () => 0, () => 1), full('clarification/-1', () => 0, () => -1),
    legacyTie(), legacyBinary()
  ];
  for (const { scored } of fixtures) for (const copy of Copy.axes(scored, D.axes)) {
    for (const text of strings(copy)) {
      assert.equal(typeof text, 'string');
      assert.doesNotMatch(text, /[0-9０-９%％±＋−=＝×÷]|分數|原分|最終分|百分|機率|正規化|釐清|未定/);
    }
    assert.equal(typeof copy.position, 'number');
    assert.ok(copy.position >= 1 && copy.position <= 99);
    assert.equal(copy.count, scored.scores[copy.id].total);
    assert.equal(Object.hasOwn(copy, 'sum'), false);
    assert.equal(Object.hasOwn(copy, 'normalized'), false);
    assert.equal(Object.hasOwn(copy, 'maxAbs'), false);
  }
});
