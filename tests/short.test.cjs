'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
function load(customize) {
  const box = { window: {} };
  vm.createContext(box);
  vm.runInContext('Math.random = function () { throw new Error("Unseeded randomness"); }; Date = function () { throw new Error("Clock dependency"); };', box);
  for (const file of ['data/questions.js', 'data/mapping.js', 'data/bank.js', 'core.js', 'bank.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), box, { filename: file });
  }
  if (customize) customize(box.window.GuaData);
  for (const file of ['short-legacy.js', 'short.js']) vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), box, { filename: file });
  return box.window;
}
const { GuaData: D, GuaBank: Bank, GuaCore: Core, GuaShort: Short, GuaShortLegacy: Legacy } = load();
const axes = D.axes.map(axis => axis.id);
const allIds = Array.from({ length: 64 }, (_, i) => i + 1);
function advance(session, count, respond = q => q.direction * 2, engine = Short) {
  while (session.answers.length < count) {
    const i = session.answers.length;
    const q = engine.questions(session)[i];
    assert.ok(q, 'a real pending question exists');
    session = engine.answer(session, i, respond(q, i, session));
  }
  return session;
}
function fill(mode, seed, respond = (q, i) => [-2, -1, 0, 1, 2][i % 5], engine = Short) {
  let session = engine.create(mode, seed);
  while (!engine.score(session).finished) {
    assert.ok(session.answers.length < mode + 6, 'finite clarification bound');
    session = advance(session, session.answers.length + 1, respond, engine);
  }
  return session;
}
function endpoint(key, axis) {
  const [type, emotion, coordination] = key.split('-');
  const index = ['energy', 'information', 'decision', 'organization'].indexOf(axis.id);
  return (index >= 0 ? type[index] : axis.id === 'emotion' ? emotion : coordination) === axis.positive.key ? 1 : -1;
}
function candidates(known) {
  return Object.keys(D.mapping).filter(key => D.axes.every(axis => !known[axis.id] || endpoint(key, axis) === known[axis.id])).map(key => D.mapping[key]).sort((a, b) => a - b);
}
function verify(session, engine = Short, data = D, bank = Bank) {
  const questions = engine.questions(session);
  const main = questions.slice(0, session.mode);
  assert.ok(questions.length >= session.mode && questions.length <= session.mode + 6);
  for (const property of ['id', 'family', 'semanticCluster']) assert.equal(new Set(questions.map(q => q[property])).size, questions.length, property + ' is globally unique');
  assert.equal(new Set(main.slice(0, 6).map(q => q.axis)).size, 6);
  for (const sign of [-1, 1]) assert.equal(main.filter(q => q.direction === sign).length, session.mode / 2);
  const counts = data.axes.map(axis => main.filter(q => q.axis === axis.id).length).sort((a, b) => b - a);
  assert.deepEqual(plain(counts), session.mode === 10 ? [3, 3, 1, 1, 1, 1] : [5, 3, 3, 3, 3, 3]);
  for (let i = 6; i < main.length; i += 2) {
    const sum = main.slice(0, i).reduce((sum, q, n) => sum + (q.axis === main[i].axis ? session.answers[n] * q.direction : 0), 0);
    assert.equal(main[i + 1].axis, main[i].axis);
    assert.equal(main[i + 1].direction, -main[i].direction);
    if (sum) assert.equal(main[i].direction, -Math.sign(sum));
  }
  for (const [index, question] of questions.entries()) {
    const { isClarification, ...item } = plain(question);
    assert.equal(isClarification, index >= session.mode);
    assert.deepEqual(item, plain(bank.query({ offset: Number(question.id.slice(2)) - 1, limit: 1 }).items[0]));
  }
  const tied = data.axes.filter(axis => main.reduce((sum, q, i) => sum + (q.axis === axis.id ? session.answers[i] * q.direction : 0), 0) === 0).map(axis => axis.id);
  assert.deepEqual(plain(engine.score(session).ties), plain(tied));
  assert.deepEqual(plain(questions.slice(session.mode).map(q => q.axis)), plain(tied));
}

test('v2 API keeps six serialized fields, one pending question and validated numeric options', () => {
  assert.equal(Short.VERSION, '2.0.0');
  assert.ok(Object.isFrozen(Short));
  assert.deepEqual(Object.keys(Short).sort(), ['VERSION', 'answer', 'create', 'questions', 'restore', 'score']);
  for (const mode of [10, 20]) for (const seed of [0, 1, 123456789, 4294967295]) {
    const session = Short.create(mode, seed), score = Short.score(session);
    assert.deepEqual(Object.keys(session).sort(), ['answers', 'bankVersion', 'mode', 'questionIds', 'seed', 'version']);
    assert.equal(session.questionIds.length, 1);
    assert.equal(session.answers.length, 0);
    assert.equal(session.bankVersion, D.bank.version);
    assert.deepEqual(plain(Short.restore(plain(session))), plain(session));
    assert.equal(Short.questions(session)[0].isClarification, false);
    for (const key of ['finished', 'complete', 'allNeutral']) assert.equal(score[key], false);
    for (const key of ['answered', 'mainAnswered', 'clarificationAnswered', 'clarificationTotal']) assert.equal(score[key], 0);
    assert.equal(score.total, mode);
    assert.equal(score.resultKey, null);
    assert.deepEqual(plain(score.candidateHexagramIds), allIds);
  }
  for (const mode of [undefined, null, '10', 0, 6, 11, 48, 10.5]) assert.throws(() => Short.create(mode, 0));
  for (const seed of [undefined, null, '1', -1, 1.5, NaN, Infinity, 4294967296]) assert.throws(() => Short.create(10, seed));
});

test('all five integer values are legal and zero counts as an answered neutral item', () => {
  const initial = Short.create(10, 0);
  for (const value of [-2, -1, 0, 1, 2]) {
    const session = Short.answer(initial, 0, value), q = Short.questions(session)[0];
    assert.deepEqual(plain(session.answers), [value]);
    assert.equal(Short.score(session).mainAnswered, 1);
    assert.equal(Short.score(session).scores[q.axis].sum, value * q.direction || 0);
    assert.deepEqual(plain(Short.restore(plain(session))), plain(session));
  }
  assert.deepEqual(plain(initial.answers), []);
});

test('five-point paths retain main quotas, balanced polarity, canonical bank text and unique meaning', () => {
  for (const mode of [10, 20]) for (let seed = 0; seed < 80; seed++) verify(fill(mode, seed));
});

test('zero block-start uses an independent seeded direction, locked for both probes without score inflation', () => {
  for (const mode of [10, 20]) {
    const signs = new Set();
    for (let seed = 0; seed < 30; seed++) {
      const initial = advance(Short.create(mode, seed), 6, () => 0), first = Short.questions(initial)[6];
      signs.add(first.direction);
      assert.ok(Object.values(Short.score(initial).scores).every(axis => axis.sum === 0));
      for (const value of [-2, -1, 0, 1, 2]) {
        const next = Short.answer(initial, 6, value), second = Short.questions(next)[7];
        assert.equal(second.axis, first.axis);
        assert.equal(second.direction, -first.direction);
        assert.equal(Short.score(next).scores[first.axis].sum, value * first.direction || 0);
      }
    }
    assert.deepEqual([...signs].sort(), [-1, 1]);
  }
});

test('20-question final block still uses weakest main axis and seeded priority for equal strengths', () => {
  for (const seed of [0, 1, 17, 0xffffffff]) {
    const initial = advance(Short.create(20, seed), 6, q => q.direction);
    for (const target of axes) {
      const session = advance(initial, 18, (q, i) => q.direction * (q.axis === target && i % 2 === 0 ? -1 : 1));
      for (const axis of axes) assert.equal(Short.score(session).scores[axis].sum, axis === target ? 1 : 3);
      assert.equal(Short.questions(session)[18].axis, target);
      assert.equal(Short.questions(session)[18].direction, -1);
    }
    for (const respond of [q => q.direction, () => 0]) {
      const session = advance(Short.create(20, seed), 18, respond), questions = Short.questions(session);
      assert.equal(questions[18].axis, questions[6].axis);
    }
  }
});

test('both modes reach all 64 results directly with five-point normalization and no clarifications', () => {
  for (const mode of [10, 20]) {
    const seen = new Set();
    for (const key of Object.keys(D.mapping)) {
      const session = fill(mode, 333, q => q.direction * 2 * endpoint(key, D.axes.find(axis => axis.id === q.axis))), score = Short.score(session);
      assert.equal(score.finished, true);
      assert.equal(score.complete, true);
      assert.equal(score.resultKey, key);
      assert.equal(score.hexagramId, D.mapping[key]);
      assert.equal(score.total, mode);
      assert.equal(score.clarificationTotal, 0);
      assert.equal(score.allNeutral, false);
      assert.deepEqual(plain(score.ties), []);
      assert.deepEqual(plain(score.unresolvedTies), []);
      assert.deepEqual(plain(score.candidateHexagramIds), [D.mapping[key]]);
      seen.add(score.hexagramId);
      for (const axis of D.axes) {
        const result = score.scores[axis.id];
        assert.equal(result.answered, result.total);
        assert.equal(result.mainCount, result.total);
        assert.equal(result.clarificationCount, 0);
        assert.equal(result.mainSum, result.sum);
        assert.equal(result.clarificationSum, 0);
        assert.equal(result.maxAbs, 2 * result.total);
        assert.equal(result.normalized, endpoint(key, axis));
        assert.equal(result.singleItem, result.total === 1);
        for (const property of ['mixed', 'nearMidpoint', 'tied']) assert.equal(result[property], false);
      }
    }
    assert.deepEqual([...seen].sort((a, b) => a - b), allIds);
  }
});

test('all-neutral runs finish after six clarifications, remain undetermined and offer all 64 candidates', () => {
  for (const mode of [10, 20]) {
    let session = advance(Short.create(mode, 19), mode, () => 0), score = Short.score(session);
    assert.equal(score.finished, false);
    assert.equal(score.allNeutral, false);
    assert.equal(score.total, mode + 6);
    assert.deepEqual(plain(score.ties), plain(axes));
    for (let i = 0; i < 6; i++) {
      assert.equal(Short.questions(session)[mode + i].axis, axes[i]);
      assert.equal(Short.questions(session)[mode + i].isClarification, true);
      assert.equal(session.questionIds.length - session.answers.length, 1);
      session = Short.answer(session, mode + i, 0);
    }
    score = Short.score(session);
    assert.equal(score.finished, true);
    assert.equal(score.complete, false);
    assert.equal(score.allNeutral, true);
    assert.equal(score.answered, mode + 6);
    assert.equal(score.mainAnswered, mode);
    assert.equal(score.clarificationAnswered, 6);
    assert.equal(score.clarificationTotal, 6);
    assert.equal(session.questionIds.length, session.answers.length);
    for (const key of ['type', 'emotion', 'coordination', 'resultKey', 'hexagramId']) assert.equal(score[key], null);
    assert.deepEqual(plain(score.unresolvedTies), plain(axes));
    assert.deepEqual(plain(score.candidateHexagramIds), allIds);
    for (const axis of Object.values(score.scores)) {
      for (const key of ['sum', 'mainSum', 'clarificationSum', 'normalized']) assert.equal(axis[key], 0);
      assert.equal(axis.clarificationCount, 1);
      assert.equal(axis.maxAbs, 2 * axis.total);
      assert.equal(axis.nearMidpoint, true);
      assert.equal(axis.tied, true);
      assert.equal(axis.side, null);
      assert.equal(axis.mixed, false);
    }
    verify(session);
    assert.throws(() => Short.answer(session, mode + 6, 0));
  }
});

test('one clarification per main tie yields exact compatible sorted candidates, even if still zero', () => {
  for (const mode of [10, 20]) for (const unresolved of [0, 1, 2, 3, 6]) {
    const session = fill(mode, 8, (q, i) => i < mode || axes.indexOf(q.axis) < unresolved ? 0 : q.direction * (axes.indexOf(q.axis) % 2 ? -2 : 2));
    const score = Short.score(session), known = {};
    D.axes.forEach((axis, i) => { if (i >= unresolved) known[axis.id] = i % 2 ? -1 : 1; });
    assert.equal(score.finished, true);
    assert.equal(score.complete, unresolved === 0);
    assert.equal(score.total, mode + 6);
    assert.equal(score.clarificationAnswered, 6);
    assert.deepEqual(plain(score.ties), plain(axes));
    assert.deepEqual(plain(score.unresolvedTies), plain(axes.slice(0, unresolved)));
    assert.deepEqual(plain(score.candidateHexagramIds), candidates(known));
    assert.equal(score.candidateHexagramIds.length, 2 ** unresolved);
    for (const axis of D.axes) {
      const current = score.scores[axis.id];
      assert.equal(current.mainSum, 0);
      assert.equal(current.sum, current.clarificationSum);
      assert.equal(current.clarificationCount, 1);
      assert.equal(current.total, current.mainCount + 1);
      assert.equal(current.maxAbs, 2 * current.total);
      assert.equal(current.normalized, current.sum / current.maxAbs);
      assert.equal(current.mixed, false, 'zero is neither vote sign');
      assert.equal(current.side, known[axis.id] ? known[axis.id] > 0 ? 'positive' : 'negative' : null);
    }
  }
});

test('clarifications can resolve all 64 results without changing neutral main sums', () => {
  for (const key of Object.keys(D.mapping)) {
    const score = Short.score(fill(10, 31, (q, i) => i < 10 ? 0 : q.direction * endpoint(key, D.axes.find(axis => axis.id === q.axis))));
    assert.equal(score.finished, true);
    assert.equal(score.complete, true);
    assert.equal(score.resultKey, key);
    assert.equal(score.hexagramId, D.mapping[key]);
    assert.ok(Object.values(score.scores).every(axis => axis.mainSum === 0 && Math.abs(axis.clarificationSum) === 1));
  }
});

test('mixed votes and midpoint thresholds use actual assigned item counts and maximum 2n', () => {
  const score = Short.score(fill(20, 14, (q, i) => q.direction * (i >= 6 && i % 2 === 0 ? -1 : 1)));
  let near = 0;
  for (const axis of D.axes) {
    const result = score.scores[axis.id];
    assert.equal(result.sum, 1);
    assert.equal(result.mixed, true);
    assert.equal(result.normalized, 1 / (2 * result.total));
    assert.equal(result.maxAbs, 2 * result.total);
    assert.equal(result.side, 'positive');
    assert.equal(result.key, axis.positive.key);
    assert.equal(result.nearMidpoint, result.total === 5);
    if (result.nearMidpoint) near++;
  }
  assert.equal(near, 1);
  const empty = Short.score(Short.create(10, 1));
  assert.ok(Object.values(empty.scores).filter(axis => axis.total === 0).every(axis => !axis.nearMidpoint && !axis.singleItem));
  const clarified = Short.score(fill(20, 18, (q, i) => i < 20 ? 0 : q.direction));
  for (const axis of Object.values(clarified.scores)) assert.equal(axis.nearMidpoint, axis.total >= 4);
});

test('result classification is unavailable before all required answers even when sums are nonzero', () => {
  for (const mode of [10, 20]) {
    const main = advance(Short.create(mode, 11), mode - 1);
    assert.ok(Object.values(Short.score(main).scores).every(axis => axis.sum > 0));
    for (const session of [main, advance(Short.create(mode, 11), mode + 5, (q, i) => i < mode ? 0 : q.direction)]) {
      const score = Short.score(session);
      assert.equal(score.finished, false);
      assert.equal(score.complete, false);
      for (const key of ['type', 'emotion', 'coordination', 'resultKey', 'hexagramId']) assert.equal(score[key], null);
    }
  }
});

test('seeds and raw five-point answer prefixes reproduce paths without clock or unseeded randomness', () => {
  for (const mode of [10, 20]) for (const seed of [0, 1, 2, 17, 123456789, 4294967295]) {
    const original = fill(mode, seed);
    assert.deepEqual(plain(fill(mode, seed)), plain(original));
    assert.deepEqual(plain(Short.score(fill(mode, seed))), plain(Short.score(original)));
    assert.notDeepEqual(plain(fill(mode, (seed + 1) >>> 0).questionIds), plain(original.questionIds));
    const next = [-2, -1, 0, 1, 2].map(value => Short.answer(Short.create(mode, seed), 0, value).questionIds[1]);
    assert.ok(new Set(next).size >= 3);
    assert.deepEqual(plain(advance(Short.create(mode, seed), mode, () => 0)), plain(advance(Short.create(mode, seed), mode, () => 0)));
  }
});

test('every main and clarification prefix round-trips with at most one pending item', () => {
  for (const mode of [10, 20]) {
    let session = Short.create(mode, 77);
    for (let count = 0; count <= mode + 6; count++) {
      const saved = plain(session), snapshot = JSON.stringify(saved), restored = Short.restore(saved), score = Short.score(session);
      assert.deepEqual(plain(restored), saved);
      assert.equal(JSON.stringify(saved), snapshot);
      for (const key of ['answers', 'questionIds']) assert.notEqual(restored[key], saved[key]);
      assert.equal(session.questionIds.length - session.answers.length, count === mode + 6 ? 0 : 1);
      assert.equal(score.total, count < mode ? mode : mode + 6);
      assert.equal(score.clarificationTotal, count < mode ? 0 : 6);
      assert.equal(Object.values(score.scores).reduce((n, axis) => n + axis.mainCount, 0), Math.min(count + 1, mode));
      assert.equal(Object.values(score.scores).reduce((n, axis) => n + axis.clarificationCount, 0), Math.max(0, Math.min(count - mode + 1, 6)));
      if (count < mode + 6) session = Short.answer(session, count, 0);
    }
  }
});

test('strict restore rejects versions, holes, illegal values, altered paths and extra adaptive answers', () => {
  const original = plain(fill(20, 91));
  const changes = [
    s => { s.version = '1.0.0'; }, s => { s.bankVersion = 'other'; }, s => { s.mode = 48; }, s => { s.seed = '91'; }, s => { s.seed++; },
    s => { s.answers[0] = 3; }, s => { s.answers[0] = -3; }, s => { s.answers[0] = '1'; }, s => { s.answers[0] = null; }, s => { delete s.answers[3]; },
    s => { s.answers.push(1); }, s => { s.answers[0] = s.answers[0] === 2 ? -2 : 2; }, s => { s.questionIds[0] = 'QB000000'; }, s => { s.questionIds[0] = 'QB100001'; },
    s => { s.questionIds[0] = 'q01'; }, s => { s.questionIds[0] = s.questionIds[1]; }, s => { [s.questionIds[0], s.questionIds[1]] = [s.questionIds[1], s.questionIds[0]]; },
    s => { delete s.questionIds[3]; }, s => { s.questionIds.pop(); }, s => { s.questionIds.push(s.questionIds[0]); }, s => { s.extra = true; }, s => { delete s.version; },
    s => { s.answers.extra = 1; }, s => { s.questionIds.extra = 1; }
  ];
  for (const change of changes) { const invalid = plain(original); change(invalid); assert.throws(() => Short.restore(invalid)); }
  for (const invalid of [null, undefined, [], 'session', 1]) assert.throws(() => Short.restore(invalid));
  for (const mode of [10, 20]) {
    for (const respond of [q => q.direction * 2, () => 0]) {
      const full = plain(fill(mode, 91, respond));
      assert.throws(() => Short.restore({ ...full, answers: [...full.answers, 0], questionIds: [...full.questionIds, full.questionIds[0]] }));
    }
    const partial = plain(advance(Short.create(mode, 91), 3));
    assert.throws(() => Short.restore({ ...partial, questionIds: partial.questionIds.slice(0, -1) }));
    assert.throws(() => Short.restore({ ...partial, questionIds: [...partial.questionIds, partial.questionIds[0]] }));
  }
});

test('editing prunes every later main and clarification answer, while unchanged values preserve history', () => {
  for (const mode of [10, 20]) {
    const original = fill(mode, 701, () => 0), snapshot = JSON.stringify(original);
    for (const index of [0, 5, 6, mode - 1, mode, mode + 2, mode + 5]) {
      const same = Short.answer(original, index, 0), changed = Short.answer(original, index, 2);
      assert.deepEqual(plain(same), plain(original));
      assert.notEqual(same.answers, original.answers);
      assert.equal(changed.answers.length, index + 1);
      assert.ok(changed.questionIds.length <= index + 2);
      assert.deepEqual(plain(changed.questionIds.slice(0, index + 1)), plain(original.questionIds.slice(0, index + 1)));
      assert.deepEqual(plain(changed.answers.slice(0, index)), plain(original.answers.slice(0, index)));
      assert.equal(changed.answers[index], 2);
      assert.deepEqual(plain(Short.restore(plain(changed))), plain(changed));
      if (index < mode - 1) assert.equal(Short.score(changed).clarificationTotal, 0);
      else if (index >= mode) assert.equal(Short.score(changed).clarificationTotal, 6);
    }
    const revised = advance(Short.answer(original, 0, Short.questions(original)[0].direction * 2), mode, () => 0);
    assert.ok(!Short.score(revised).ties.includes(Short.questions(original)[0].axis));
    assert.equal(Short.score(revised).clarificationTotal, 5);
    assert.equal(JSON.stringify(original), snapshot);
  }
});

test('missing or invalid answers and skipped or nonexistent positions are rejected without mutation', () => {
  const session = Short.create(10, 0), snapshot = JSON.stringify(session);
  for (const value of [-3, 3, 0.5, '0', '1', true, null, undefined, NaN, Infinity]) assert.throws(() => Short.answer(session, 0, value));
  assert.throws(() => Short.answer(session, 0));
  for (const index of [-1, 0.5, '0', 1, 10, Infinity, null]) assert.throws(() => Short.answer(session, index, 0));
  assert.equal(JSON.stringify(session), snapshot);
});

test('global family and semantic collisions are excluded across axes and clarification items', () => {
  const custom = load(data => {
    const seeds = new Map(data.bank.seeds.map(seed => [seed.id, seed]));
    for (const bucket of data.bank.buckets) bucket.seedIds.forEach((id, index) => {
      seeds.get(id).family = 'global-family-' + index;
      seeds.get(id).semanticCluster = 'global-cluster-' + index;
    });
  });
  for (let seed = 0; seed < 30; seed++) {
    verify(fill(10, seed, () => 0, custom.GuaShort), custom.GuaShort, custom.GuaData, custom.GuaBank);
    verify(fill(20, seed, q => q.direction * 2, custom.GuaShort), custom.GuaShort, custom.GuaData, custom.GuaBank);
  }
});

const legacyFixtures = [
  { mode: 10, ids: ['QB006307', 'QB085325', 'QB032403', 'QB059753', 'QB048713', 'QB073404', 'QB006778', 'QB014857', 'QB018949', 'QB025637'], sums: [-3, 1, -1, 1, 1, 1], resultKey: 'ISFJ-calm-autonomous', hexagramId: 27 },
  { mode: 20, ids: ['QB076665', 'QB034624', 'QB095616', 'QB020682', 'QB052444', 'QB008906', 'QB083694', 'QB091886', 'QB059132', 'QB050317', 'QB048226', 'QB038852', 'QB022731', 'QB029370', 'QB078857', 'QB070811', 'QB000155', 'QB014159', 'QB052995', 'QB064913'], sums: [-1, -3, 1, -3, -1, -3], resultKey: 'INTP-sensitive-cooperative', hexagramId: 64 }
];
test('read-only legacy v1 preserves recorded binary paths and results with original n normalization', () => {
  assert.equal(Legacy.VERSION, '1.0.0');
  assert.ok(Object.isFrozen(Legacy));
  assert.deepEqual(Object.keys(Legacy).sort(), ['VERSION', 'questions', 'restore', 'score']);
  for (const fixture of legacyFixtures) {
    const saved = { mode: fixture.mode, seed: 91, version: '1.0.0', bankVersion: D.bank.version, questionIds: fixture.ids.slice(), answers: Array.from({ length: fixture.mode }, (_, i) => i % 3 === 0 ? -1 : 1) };
    assert.deepEqual(plain(Legacy.restore(saved)), saved);
    const score = Legacy.score(saved);
    assert.equal(score.complete, true);
    assert.equal(score.resultKey, fixture.resultKey);
    assert.equal(score.hexagramId, fixture.hexagramId);
    assert.equal(score.total, fixture.mode);
    assert.deepEqual(plain(D.axes.map(axis => score.scores[axis.id].sum)), fixture.sums);
    for (const axis of Object.values(score.scores)) {
      assert.equal(axis.maxAbs, axis.total);
      assert.equal(axis.normalized, axis.sum / axis.total);
      assert.equal(axis.nearMidpoint, false);
    }
    assert.ok(Legacy.questions(saved).every(q => !Object.hasOwn(q, 'isClarification')));
    const modern = fill(fixture.mode, 91, (q, i) => i % 3 === 0 ? -1 : 1);
    assert.deepEqual(plain(modern.questionIds), fixture.ids);
    assert.equal(Short.score(modern).resultKey, fixture.resultKey);
    for (let count = 0; count <= fixture.mode; count++) {
      const prefix = { ...saved, answers: saved.answers.slice(0, count), questionIds: fixture.ids.slice(0, Math.min(count + 1, fixture.mode)) };
      assert.deepEqual(plain(Legacy.restore(prefix)), prefix);
    }
    for (const value of [0, -2, 2, null, '1', undefined]) { const invalid = plain(saved); invalid.answers[0] = value; assert.throws(() => Legacy.restore(invalid)); }
    assert.throws(() => Short.restore(saved));
    assert.throws(() => Legacy.restore(modern));
  }
});

test('engines never activate or mutate global questions, data, mappings or caller objects', () => {
  const originalQuestions = D.questions, before = JSON.stringify(D);
  const coreAnswers = Object.fromEntries(D.questions.map(q => [q.id, q.direction * 2])), coreBefore = JSON.stringify(Core.score(coreAnswers));
  for (const mode of [10, 20]) for (const respond of [() => 0, q => q.direction * 2]) {
    const session = fill(mode, 123, respond), snapshot = JSON.stringify(session);
    Short.questions(session); Short.score(session); Short.restore(session);
    assert.equal(JSON.stringify(session), snapshot);
    const exposed = Short.questions(session);
    exposed[0].text = 'spoofed'; exposed[0].sourceIds.push('spoofed'); exposed[0].isClarification = true;
    assert.notEqual(Short.questions(session)[0].text, 'spoofed');
    assert.ok(!Short.questions(session)[0].sourceIds.includes('spoofed'));
    assert.equal(Short.questions(session)[0].isClarification, false);
  }
  assert.equal(D.questions, originalQuestions);
  assert.equal(JSON.stringify(D), before);
  assert.equal(JSON.stringify(Core.score(coreAnswers)), coreBefore);
});
