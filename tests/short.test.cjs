'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
function load(customize) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext('Math.random = function () { throw new Error("Unseeded randomness"); }; Date = function () { throw new Error("Clock dependency"); };', sandbox);
  for (const file of ['data/questions.js', 'data/mapping.js', 'data/bank.js', 'core.js', 'bank.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), sandbox, { filename: file });
  }
  if (customize) customize(sandbox.window.GuaData);
  vm.runInContext(fs.readFileSync(path.join(root, 'dist', 'short.js'), 'utf8'), sandbox, { filename: 'short.js' });
  return sandbox.window;
}
const { GuaData: D, GuaBank: Bank, GuaCore: Core, GuaShort: Short } = load();
const axisIds = D.axes.map(axis => axis.id);
function fill(mode, seed, respond = (q, index) => index % 3 === 0 ? -1 : 1, engine = Short) {
  let session = engine.create(mode, seed);
  while (session.answers.length < mode) {
    const index = session.answers.length;
    const question = engine.questions(session)[index];
    session = engine.answer(session, index, respond(question, index, session));
  }
  return session;
}
function advance(session, count, respond = q => q.direction) {
  while (session.answers.length < count) {
    const index = session.answers.length;
    session = Short.answer(session, index, respond(Short.questions(session)[index], index, session));
  }
  return session;
}
function endpoint(key, axis) {
  const [type, emotion, coordination] = key.split('-');
  const index = ['energy', 'information', 'decision', 'organization'].indexOf(axis.id);
  const letter = index >= 0 ? type[index] : axis.id === 'emotion' ? emotion : coordination;
  return letter === axis.positive.key ? 1 : -1;
}
function verify(session, engine = Short, data = D, bank = Bank) {
  const questions = engine.questions(session);
  assert.equal(questions.length, session.mode);
  for (const property of ['id', 'family', 'semanticCluster']) assert.equal(new Set(questions.map(q => q[property])).size, session.mode, property + ' stays unique across the whole path');
  assert.equal(new Set(questions.slice(0, 6).map(q => q.axis)).size, 6);
  assert.equal(questions.filter(q => q.direction === 1).length, session.mode / 2);
  assert.equal(questions.filter(q => q.direction === -1).length, session.mode / 2);
  const counts = data.axes.map(axis => questions.filter(q => q.axis === axis.id).length).sort((a, b) => b - a);
  assert.deepEqual(plain(counts), session.mode === 10 ? [3, 3, 1, 1, 1, 1] : [5, 3, 3, 3, 3, 3]);
  for (let index = 6; index < questions.length; index += 2) {
    const first = questions[index];
    const second = questions[index + 1];
    const sum = questions.slice(0, index).reduce((value, q, n) => value + (q.axis === first.axis ? session.answers[n] * q.direction : 0), 0);
    assert.notEqual(sum, 0, 'Every block starts from an odd number of signed votes');
    assert.equal(second.axis, first.axis);
    assert.equal(first.direction, -Math.sign(sum), 'The opposing direction is probed first');
    assert.equal(second.direction, Math.sign(sum), 'The second direction stays locked to the block start');
  }
  for (const item of questions) {
    const canonical = bank.query({ offset: Number(item.id.slice(2)) - 1, limit: 1 }).items[0];
    assert.deepEqual(plain(item), plain(canonical), 'All text, contexts, and provenance come from the real finite bank');
  }
}

test('the public API creates one pending canonical question and accepts only numeric modes and uint32 seeds', () => {
  assert.deepEqual(Object.keys(Short).sort(), ['VERSION', 'answer', 'create', 'questions', 'restore', 'score']);
  for (const mode of [10, 20]) for (const seed of [0, 1, 123456789, 4294967295]) {
    const session = Short.create(mode, seed);
    assert.deepEqual(Object.keys(session).sort(), ['answers', 'bankVersion', 'mode', 'questionIds', 'seed', 'version']);
    assert.equal(session.questionIds.length, 1);
    assert.equal(session.answers.length, 0);
    assert.equal(session.version, Short.VERSION);
    assert.equal(session.bankVersion, D.bank.version);
    assert.deepEqual(plain(Short.restore(plain(session))), plain(session));
    const score = Short.score(session);
    assert.equal(score.complete, false);
    assert.equal(score.answered, 0);
    assert.equal(score.total, mode);
    assert.equal(score.resultKey, null);
  }
  for (const mode of [undefined, null, '10', 0, 6, 11, 48, 10.5]) assert.throws(() => Short.create(mode, 0));
  for (const seed of [undefined, null, '1', -1, 1.5, NaN, Infinity, 4294967296]) assert.throws(() => Short.create(10, seed));
});

test('both lengths retain exact quotas, balanced directions, canonical provenance, and globally unique meaning', () => {
  for (const mode of [10, 20]) for (let seed = 0; seed < 100; seed++) verify(fill(mode, seed));
});

test('a zero intermediate sum cannot change the direction locked at block start', () => {
  let session = advance(Short.create(10, 19), 6);
  const first = Short.questions(session)[6];
  assert.equal(first.direction, -1);
  session = Short.answer(session, 6, 1); // Signed -1 cancels this axis's initial +1.
  assert.equal(Short.score(session).scores[first.axis].sum, 0);
  const second = Short.questions(session)[7];
  assert.equal(second.axis, first.axis);
  assert.equal(second.direction, 1);
  session = advance(session, 10);
  assert.equal(Short.score(session).ties.length, 0);
});

test('the 20-question final block selects the weakest normalized axis and uses seeded priority for ties', () => {
  for (const seed of [0, 1, 17, 0xffffffff]) {
    const initial = advance(Short.create(20, seed), 6);
    // Each of the six possible weakest axes must be reachable, independent of
    // initial axis order and the follow-up block permutation.
    for (const target of axisIds) {
      const session = advance(initial, 18, (q, index) => q.direction * (q.axis === target && index % 2 === 0 ? -1 : 1));
      const score = Short.score(session);
      for (const axis of axisIds) assert.equal(score.scores[axis].sum, axis === target ? 1 : 3);
      assert.equal(Short.questions(session)[18].axis, target);
      assert.equal(Short.questions(session)[18].direction, -1);
    }
    const tied = advance(initial, 18);
    const questions = Short.questions(tied);
    assert.equal(questions[18].axis, questions[6].axis, 'Equal strengths use the seeded follow-up priority');
    assert.equal(new Set(questions.slice(6, 18).map(q => q.axis)).size, 6);
  }
});

test('both modes can reach all 64 mapped types with odd nonzero axis scores and no tie questions', () => {
  for (const mode of [10, 20]) {
    const seen = new Set();
    for (const key of Object.keys(D.mapping)) {
      const session = fill(mode, 333, q => q.direction * endpoint(key, D.axes.find(axis => axis.id === q.axis)));
      const score = Short.score(session);
      assert.equal(score.complete, true);
      assert.equal(score.resultKey, key);
      assert.equal(score.hexagramId, D.mapping[key]);
      assert.equal(score.mode, mode);
      assert.equal(score.allNeutral, false);
      assert.deepEqual(plain(score.ties), []);
      assert.deepEqual(plain(score.unresolvedTies), []);
      seen.add(score.hexagramId);
      for (const axis of D.axes) {
        const result = score.scores[axis.id];
        assert.equal(result.answered, result.total);
        assert.equal(result.total % 2, 1);
        assert.equal(result.maxAbs, result.total);
        assert.equal(result.normalized, endpoint(key, axis));
        assert.equal(result.singleItem, result.total === 1);
        assert.equal(result.mixed, false);
        assert.equal(result.nearMidpoint, false);
        assert.equal(result.tied, false);
      }
    }
    assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 64 }, (_, index) => index + 1));
  }
});

test('mixed scores expose the actual count and normalization without borrowing 48-question limits', () => {
  const session = fill(20, 14, (q, index) => q.direction * (index >= 6 && index % 2 === 0 ? -1 : 1));
  const score = Short.score(session);
  for (const axis of D.axes) {
    const current = score.scores[axis.id];
    assert.equal(current.sum, 1);
    assert.equal(current.mixed, true);
    assert.equal(current.singleItem, false);
    assert.equal(current.normalized, 1 / current.maxAbs);
    assert.equal(current.side, 'positive');
    assert.equal(current.key, axis.positive.key);
  }
});

test('seed and answer prefix reproduce the exact path without clock or unseeded randomness', () => {
  for (const mode of [10, 20]) for (const seed of [0, 1, 2, 17, 123456789, 4294967295]) {
    const original = fill(mode, seed);
    assert.deepEqual(plain(fill(mode, seed)), plain(original));
    assert.deepEqual(plain(Short.score(fill(mode, seed))), plain(Short.score(original)));
    assert.notDeepEqual(plain(fill(mode, (seed + 1) >>> 0).questionIds), plain(original.questionIds));
    const initial = Short.create(mode, seed);
    const positive = Short.answer(initial, 0, 1);
    const negative = Short.answer(initial, 0, -1);
    assert.notEqual(positive.questionIds[1], negative.questionIds[1], 'The next item depends on the raw answer prefix');
  }
});

test('every valid prefix round-trips through JSON and strict replay validation', () => {
  for (const mode of [10, 20]) {
    let session = Short.create(mode, 77);
    for (let count = 0; count <= mode; count++) {
      const saved = plain(session);
      const snapshot = JSON.stringify(saved);
      const restored = Short.restore(saved);
      assert.deepEqual(plain(restored), saved);
      assert.equal(JSON.stringify(saved), snapshot);
      assert.notEqual(restored, saved);
      assert.notEqual(restored.answers, saved.answers);
      assert.notEqual(restored.questionIds, saved.questionIds);
      assert.equal(session.questionIds.length - session.answers.length, count === mode ? 0 : 1);
      if (count < mode) session = Short.answer(session, count, count % 2 ? -1 : 1);
    }
  }
});

test('restore rejects wrong versions, holes, illegal answers, altered IDs, and noncanonical paths', () => {
  const original = plain(fill(20, 91));
  const corruptions = [
    s => { s.version = '0.0.0'; }, s => { s.bankVersion = 'other'; },
    s => { s.mode = 48; }, s => { s.seed = '91'; }, s => { s.seed++; },
    s => { s.answers[0] = 0; }, s => { s.answers[0] = 2; }, s => { s.answers[0] = '1'; },
    s => { s.answers[0] = null; }, s => { delete s.answers[3]; },
    s => { s.answers.push(1); }, s => { s.answers[0] *= -1; },
    s => { s.questionIds[0] = 'QB000000'; }, s => { s.questionIds[0] = 'QB100001'; },
    s => { s.questionIds[0] = 'q01'; }, s => { s.questionIds[0] = s.questionIds[1]; },
    s => { s.questionIds[0] = Bank.query({ limit: 1 }).items[0].id; },
    s => { [s.questionIds[0], s.questionIds[1]] = [s.questionIds[1], s.questionIds[0]]; },
    s => { delete s.questionIds[3]; }, s => { s.questionIds.pop(); },
    s => { s.questionIds.push(s.questionIds[0]); }, s => { s.extra = true; },
    s => { delete s.version; }, s => { s.answers.extra = 1; }
  ];
  for (const change of corruptions) {
    const invalid = plain(original);
    change(invalid);
    assert.throws(() => Short.restore(invalid));
  }
  for (const invalid of [null, undefined, [], 'session', 1]) assert.throws(() => Short.restore(invalid));
  const partial = plain(advance(Short.create(10, 91), 3));
  assert.throws(() => Short.restore({ ...partial, questionIds: partial.questionIds.slice(0, -1) }));
  assert.throws(() => Short.restore({ ...partial, questionIds: [...partial.questionIds, partial.questionIds[0]] }));
});

test('editing an answer prunes every later answer and ID; repeating an answer retains the future', () => {
  for (const mode of [10, 20]) {
    const original = fill(mode, 701);
    const snapshot = JSON.stringify(original);
    for (const index of [0, 5, 6, mode - 1]) {
      const same = Short.answer(original, index, original.answers[index]);
      assert.deepEqual(plain(same), plain(original));
      assert.notEqual(same.answers, original.answers);
      const changed = Short.answer(original, index, -original.answers[index]);
      assert.equal(changed.answers.length, index + 1);
      assert.equal(changed.questionIds.length, Math.min(index + 2, mode));
      assert.deepEqual(plain(changed.questionIds.slice(0, index + 1)), plain(original.questionIds.slice(0, index + 1)));
      assert.deepEqual(plain(changed.answers.slice(0, index)), plain(original.answers.slice(0, index)));
      assert.equal(changed.answers[index], -original.answers[index]);
      assert.deepEqual(plain(Short.restore(plain(changed))), plain(changed));
      if (index + 1 < mode) assert.notEqual(changed.questionIds[index + 1], original.questionIds[index + 1]);
    }
    assert.equal(JSON.stringify(original), snapshot);
  }
});

test('invalid answer values, skipped positions, and nonexistent positions are rejected without mutation', () => {
  const session = Short.create(10, 0);
  const snapshot = JSON.stringify(session);
  for (const answer of [0, 2, -2, 0.5, '1', true, null, undefined, NaN, Infinity]) assert.throws(() => Short.answer(session, 0, answer));
  for (const index of [-1, 0.5, '0', 1, 10, Infinity, null]) assert.throws(() => Short.answer(session, index, 1));
  assert.equal(JSON.stringify(session), snapshot);
});

test('cross-axis family and semantic collisions are excluded throughout adaptive paths', () => {
  const custom = load(data => {
    // A constrained fixture shares the same 24 families and clusters across all
    // 12 buckets. A completed path still needs 20 different global choices.
    const seeds = new Map(data.bank.seeds.map(seed => [seed.id, seed]));
    for (const bucket of data.bank.buckets) bucket.seedIds.forEach((id, index) => {
      seeds.get(id).family = 'global-family-' + index;
      seeds.get(id).semanticCluster = 'global-cluster-' + index;
    });
  });
  for (const mode of [10, 20]) for (let seed = 0; seed < 30; seed++) {
    const session = fill(mode, seed, (q, index) => index % 3 ? 1 : -1, custom.GuaShort);
    verify(session, custom.GuaShort, custom.GuaData, custom.GuaBank);
  }
});

test('short sessions never activate or mutate global questions, bank recipes, mappings, or input objects', () => {
  const originalQuestions = D.questions;
  const before = JSON.stringify(D);
  const coreAnswers = Object.fromEntries(D.questions.map(q => [q.id, q.direction * 2]));
  const coreBefore = JSON.stringify(Core.score(coreAnswers));
  for (const mode of [10, 20]) {
    const session = fill(mode, 123);
    const snapshot = JSON.stringify(session);
    Short.questions(session);
    Short.score(session);
    Short.restore(session);
    assert.equal(JSON.stringify(session), snapshot);
    const exposed = Short.questions(session);
    exposed[0].text = 'spoofed';
    exposed[0].sourceIds.push('spoofed');
    assert.notEqual(Short.questions(session)[0].text, 'spoofed');
    assert.ok(!Short.questions(session)[0].sourceIds.includes('spoofed'));
  }
  assert.equal(D.questions, originalQuestions);
  assert.equal(JSON.stringify(D), before);
  assert.equal(JSON.stringify(Core.score(coreAnswers)), coreBefore);
});
