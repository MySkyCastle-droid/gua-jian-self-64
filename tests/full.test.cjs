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
  for (const file of ['data/questions.js', 'data/mapping.js', 'data/bank.js', 'core.js', 'bank.js', 'short.js', 'full.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), box, { filename: file });
  }
  return box.window;
}
const { GuaData: D, GuaBank: Bank, GuaShort: Short, GuaFull: Full } = load();
const axes = D.axes.map(axis => axis.id);
const allIds = Array.from({ length: 64 }, (_, i) => i + 1);
const originalQuestions = D.questions;
const originalQuestionData = plain(D.questions);
test.afterEach(() => {
  assert.equal(D.questions, originalQuestions);
  assert.deepEqual(plain(D.questions), originalQuestionData);
});
function main(session, respond = q => 2 * q.direction) {
  for (const [i, question] of Full.questions(session).slice(0, 48).entries()) session = Full.answer(session, question.id, respond(question, i));
  return session;
}
function finish(session, respond = q => 2 * q.direction) {
  for (const [i, question] of Full.questions(session).slice(48).entries()) session = Full.answer(session, question.id, respond(question, i));
  return session;
}
function endpoint(key, axis) {
  const [type, emotion, coordination] = key.split('-');
  const index = ['energy', 'information', 'decision', 'organization'].indexOf(axis.id);
  return (index >= 0 ? type[index] : axis.id === 'emotion' ? emotion : coordination) === axis.positive.key ? 1 : -1;
}
function verify(session) {
  const questions = Full.questions(session), main = questions.slice(0, 48);
  assert.ok(questions.length >= 48 && questions.length <= 54);
  for (const property of ['id', 'family', 'semanticCluster']) assert.equal(new Set(questions.map(q => q[property])).size, questions.length, property + ' is globally unique');
  for (const axis of axes) for (const direction of [-1, 1]) assert.equal(main.filter(q => q.axis === axis && q.direction === direction).length, 4);
  for (const [i, question] of questions.entries()) {
    const { isClarification, chapter, chapterTitle, ...item } = plain(question);
    assert.equal(isClarification, i >= 48);
    if (i < 48) assert.equal(chapter, Math.floor(i / 12) + 1);
    assert.deepEqual(item, plain(Bank.query({ offset: Number(question.id.slice(2)) - 1, limit: 1 }).items[0]));
  }
  assert.deepEqual(plain(Full.restore(plain(session))), plain(session));
}

test('canonical full API uses nine strict fields, fixed balanced main questions and uint32 seeds', () => {
  assert.equal(Full.VERSION, '1.0.0');
  assert.ok(Object.isFrozen(Full));
  assert.deepEqual(Object.keys(Full).sort(), ['VERSION', 'answer', 'create', 'importLegacy', 'questions', 'restore', 'score']);
  for (const seed of [0, 1, 123456789, 0xffffffff]) {
    const session = Full.create(seed), score = Full.score(session);
    assert.deepEqual(Object.keys(session).sort(), ['answers', 'bankVersion', 'clarificationAnswers', 'clarificationIds', 'formOrigin', 'mode', 'questionIds', 'seed', 'version']);
    assert.equal(session.mode, 48);
    assert.equal(session.formOrigin, 'seed');
    assert.equal(session.seed, seed);
    assert.equal(session.bankVersion, D.bank.version);
    assert.deepEqual(plain(session.questionIds), plain(Bank.createForm(seed).map(q => q.id)));
    assert.deepEqual(plain(session.clarificationIds), []);
    assert.deepEqual(plain(session.answers), {});
    verify(session);
    assert.equal(score.finished, false);
    assert.equal(score.complete, false);
    assert.equal(score.answered, 0);
    assert.equal(score.mainAnswered, 0);
    assert.equal(score.total, 48);
    assert.deepEqual(plain(score.candidateHexagramIds), allIds);
  }
  for (const seed of [undefined, null, '1', -1, 1.5, NaN, Infinity, 4294967296]) assert.throws(() => Full.create(seed));
});

test('all five answers are legal, missing differs from zero, and reverse items reverse votes', () => {
  const initial = Full.create(77), question = Full.questions(initial).find(q => q.direction === -1);
  for (const value of [-2, -1, 0, 1, 2]) {
    const session = Full.answer(initial, question.id, value), score = Full.score(session);
    assert.equal(score.mainAnswered, 1);
    assert.equal(score.scores[question.axis].answered, 1);
    assert.equal(score.scores[question.axis].sum, value * -1 || 0);
    assert.equal(session.answers[question.id], value);
    assert.equal(Object.hasOwn(initial.answers, question.id), false);
    assert.equal(score.scores[question.axis].side, null);
  }
  for (const value of [undefined, null, '-1', true, 0.5, -3, 3, NaN, Infinity]) assert.throws(() => Full.answer(initial, question.id, value));
  for (const id of [0, null, 'QB000000', 'unknown']) assert.throws(() => Full.answer(initial, id, 0));
});

test('all 64 hexagrams remain reachable with complete identities and exact full normalization', () => {
  const seen = new Set();
  const expectedFields = Object.keys(Short.score(Short.create(10, 0))).sort();
  const expectedAxisFields = Object.keys(Short.score(Short.create(10, 0)).scores.energy).sort();
  for (const key of Object.keys(D.mapping)) {
    const session = main(Full.create(333), q => 2 * q.direction * endpoint(key, D.axes.find(axis => axis.id === q.axis)));
    const score = Full.score(session);
    assert.deepEqual(Object.keys(score).sort(), expectedFields);
    assert.equal(score.finished, true);
    assert.equal(score.complete, true);
    assert.equal(score.resultKey, key);
    assert.equal(score.hexagramId, D.mapping[key]);
    assert.equal(score.mainAnswered, 48);
    assert.equal(score.answered, 48);
    assert.equal(score.total, 48);
    assert.equal(score.clarificationTotal, 0);
    assert.equal(score.allNeutral, false);
    assert.deepEqual(plain(score.ties), []);
    assert.deepEqual(plain(score.unresolvedTies), []);
    assert.deepEqual(plain(score.candidateHexagramIds), [D.mapping[key]]);
    seen.add(score.hexagramId);
    for (const axis of D.axes) {
      const value = score.scores[axis.id];
      assert.deepEqual(Object.keys(value).sort(), expectedAxisFields);
      assert.equal(value.mainSum, 16 * endpoint(key, axis));
      assert.equal(value.clarificationSum, 0);
      assert.equal(value.sum, value.mainSum);
      assert.equal(value.mainCount, 8);
      assert.equal(value.clarificationCount, 0);
      assert.equal(value.answered, 8);
      assert.equal(value.total, 8);
      assert.equal(value.maxAbs, 16);
      assert.equal(value.normalized, endpoint(key, axis));
      for (const property of ['mixed', 'nearMidpoint', 'tied', 'singleItem']) assert.equal(value[property], false);
    }
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), allIds);
});

test('all-neutral forms need exactly six real clarification items and finish undetermined at 54', () => {
  for (let seed = 0; seed < 24; seed++) {
    let session = main(Full.create(seed), () => 0), score = Full.score(session);
    assert.equal(score.mainAnswered, 48);
    assert.equal(score.clarificationTotal, 6);
    assert.equal(score.total, 54);
    assert.equal(score.finished, false);
    assert.equal(score.allNeutral, false);
    assert.deepEqual(plain(score.ties), plain(axes));
    assert.deepEqual(plain(Full.questions(session).slice(48).map(q => q.axis)), plain(axes));
    verify(session);
    session = finish(session, () => 0);
    score = Full.score(session);
    assert.equal(score.finished, true);
    assert.equal(score.complete, false);
    assert.equal(score.allNeutral, true);
    assert.equal(score.answered, 54);
    assert.equal(score.clarificationAnswered, 6);
    assert.deepEqual(plain(score.unresolvedTies), plain(axes));
    assert.deepEqual(plain(score.candidateHexagramIds), allIds);
    for (const identity of ['type', 'emotion', 'coordination', 'resultKey', 'hexagramId']) assert.equal(score[identity], null);
    for (const axis of axes) {
      const value = score.scores[axis];
      assert.equal(value.mainCount, 8);
      assert.equal(value.clarificationCount, 1);
      assert.equal(value.total, 9);
      assert.equal(value.maxAbs, 18);
      assert.equal(value.answered, 9);
      assert.equal(value.sum, 0);
      assert.equal(value.normalized, 0);
      assert.equal(value.nearMidpoint, true);
      assert.equal(value.tied, true);
      assert.equal(value.side, null);
    }
  }
});

test('one unresolved final axis leaves exactly two compatible candidates, with sides withheld until finished', () => {
  let session = main(Full.create(9), q => q.axis === 'emotion' ? 0 : 2 * q.direction);
  let score = Full.score(session);
  assert.equal(score.total, 49);
  assert.equal(score.finished, false);
  assert.deepEqual(plain(score.ties), ['emotion']);
  assert.ok(Object.values(score.scores).every(axis => axis.side === null && axis.key === null && axis.label === null));
  session = finish(session, () => 0);
  score = Full.score(session);
  assert.equal(score.finished, true);
  assert.equal(score.complete, false);
  assert.equal(score.allNeutral, false);
  assert.deepEqual(plain(score.unresolvedTies), ['emotion']);
  const expected = Object.keys(D.mapping).filter(key => D.axes.every(axis => axis.id === 'emotion' || endpoint(key, axis) === 1)).map(key => D.mapping[key]).sort((a, b) => a - b);
  assert.deepEqual(plain(score.candidateHexagramIds), expected);
  assert.equal(score.candidateHexagramIds.length, 2);
  assert.equal(score.scores.energy.side, 'positive');
  for (const identity of ['type', 'emotion', 'coordination', 'resultKey', 'hexagramId']) assert.equal(score[identity], null);
});

test('clarification raw response times item direction supplies the only vote, without repeated tie breaking', () => {
  const signs = new Set();
  for (let seed = 0; seed < 16; seed++) {
    const initial = main(Full.create(seed), () => 0);
    for (const question of Full.questions(initial).slice(48)) signs.add(question.direction);
    for (const value of [-2, -1, 0, 1, 2]) {
      const session = finish(initial, () => value), score = Full.score(session);
      assert.equal(score.finished, true);
      assert.equal(score.complete, value !== 0);
      assert.equal(Full.questions(session).length, 54);
      for (const question of Full.questions(session).slice(48)) {
        const axis = score.scores[question.axis];
        assert.equal(axis.mainSum, 0);
        assert.equal(axis.clarificationSum, value * question.direction || 0);
        assert.equal(axis.sum, axis.clarificationSum);
        assert.equal(axis.normalized, axis.sum / 18);
        assert.equal(axis.nearMidpoint, true);
        assert.equal(axis.side, value === 0 ? null : value * question.direction > 0 ? 'positive' : 'negative');
      }
    }
  }
  assert.deepEqual([...signs].sort(), [-1, 1]);
});

test('main edits preserve question ordering, later answers and holes, and invalidate all clarification answers only on change', () => {
  const initial = Full.create(125), ids = plain(initial.questionIds);
  let sparse = Full.answer(initial, ids[47], 2);
  sparse = Full.answer(sparse, ids[7], 0);
  assert.deepEqual(plain(sparse.answers), { [ids[7]]: 0, [ids[47]]: 2 });
  assert.equal(Full.score(sparse).mainAnswered, 2);
  assert.deepEqual(plain(Full.answer(sparse, ids[7], -1).answers), { [ids[7]]: -1, [ids[47]]: 2 });
  assert.equal(Object.hasOwn(sparse.answers, ids[0]), false);
  let completed = finish(main(initial, () => 0), q => q.direction);
  const same = Full.answer(completed, ids[0], 0);
  assert.deepEqual(plain(same), plain(completed));
  const firstClarification = completed.clarificationIds[0];
  assert.deepEqual(plain(Full.answer(completed, firstClarification, completed.clarificationAnswers[firstClarification])), plain(completed));
  const changed = Full.answer(completed, ids[0], 1);
  assert.deepEqual(plain(changed.questionIds), ids);
  assert.deepEqual(plain(changed.clarificationAnswers), {});
  assert.equal(Object.keys(changed.answers).length, 48);
  assert.equal(changed.answers[ids[47]], 0);
  assert.equal(changed.clarificationIds.length, 5);
  assert.equal(Full.score(changed).finished, false);
  assert.equal(Object.keys(completed.clarificationAnswers).length, 6);
});

test('replay survives JSON and fresh engines and is independent of main answer arrival order', () => {
  const initial = Full.create(0xffffffff), ids = plain(initial.questionIds);
  const sequential = finish(main(initial, (q, i) => i % 2 ? 0 : q.direction));
  const Fresh = load().GuaFull;
  assert.deepEqual(plain(Fresh.restore(plain(sequential))), plain(sequential));
  assert.deepEqual(plain(Fresh.score(plain(sequential))), plain(Full.score(sequential)));
  assert.deepEqual(plain(Fresh.questions(plain(sequential))), plain(Full.questions(sequential)));
  let forward = initial, backward = initial;
  for (const id of ids) forward = Full.answer(forward, id, 0);
  for (const id of ids.slice().reverse()) backward = Full.answer(backward, id, 0);
  assert.deepEqual(plain(forward), plain(backward));
  const questions = Full.questions(forward);
  questions[0].text = 'changed caller copy';
  assert.notEqual(Full.questions(forward)[0].text, questions[0].text);
});

test('legacy imports preserve fixed IDs, all main answers and holes, derive deterministic seeds and discard old tie choices', () => {
  const ids = Bank.createForm(1873).map(q => q.id);
  const answers = { [ids[47]]: -2, [ids[3]]: 0, [ids[9]]: 1 };
  const session = Full.importLegacy(ids, answers);
  assert.equal(session.formOrigin, 'legacy');
  assert.ok(Number.isInteger(session.seed) && session.seed >= 0 && session.seed <= 0xffffffff);
  assert.deepEqual(plain(session.questionIds), plain(ids));
  assert.deepEqual(plain(session.answers), { [ids[3]]: 0, [ids[9]]: 1, [ids[47]]: -2 });
  assert.equal(Object.hasOwn(session.answers, ids[0]), false);
  assert.deepEqual(plain(session.clarificationAnswers), {});
  assert.deepEqual(plain(Full.importLegacy(plain(ids), plain(answers))), plain(session));
  assert.deepEqual(plain(Full.restore(plain(session))), plain(session));
  assert.equal(Full.score(session).mainAnswered, 3);
  const allZero = Full.importLegacy(ids, Object.fromEntries(ids.map(id => [id, 0])));
  assert.equal(allZero.clarificationIds.length, 6);
  assert.equal(Full.score(allZero).finished, false);
  assert.deepEqual(plain(allZero.clarificationAnswers), {});
  verify(allZero);
  assert.notEqual(Full.importLegacy(Bank.createForm(1874).map(q => q.id), {}).seed, session.seed);
});

test('strict restore rejects tampering, foreign answers, missing fields, stale clarifications and malformed arrays', () => {
  const initial = plain(Full.create(99));
  const neutral = plain(main(Full.create(99), () => 0));
  const changes = [
    s => { s.extra = true; }, s => { delete s.answers; }, s => { s.mode = 20; },
    s => { s.version = '0.0.0'; }, s => { s.bankVersion = 'old'; }, s => { s.formOrigin = 'other'; },
    s => { s.seed = -1; }, s => { s.seed++; }, s => { s.formOrigin = 'legacy'; },
    s => { s.questionIds[0] = s.questionIds[1]; }, s => { s.questionIds.reverse(); },
    s => { delete s.questionIds[2]; }, s => { s.questionIds.push('QB000001'); },
    s => { s.answers = []; }, s => { s.answers.unknown = 0; }, s => { s.answers[s.questionIds[0]] = 3; },
    s => { s.answers[s.questionIds[0]] = '0'; }, s => { s.answers[s.questionIds[0]] = null; },
    s => { s.clarificationIds = ['QB000001']; }, s => { s.clarificationAnswers[s.questionIds[0]] = 0; }
  ];
  for (const change of changes) {
    const saved = plain(initial); change(saved); assert.throws(() => Full.restore(saved));
  }
  for (const change of [s => { s.clarificationIds.reverse(); }, s => { s.clarificationIds.pop(); }, s => { s.clarificationIds[0] = s.questionIds[0]; }, s => { s.clarificationAnswers[s.clarificationIds[0]] = 1.5; }, s => { delete s.answers[s.questionIds[0]]; }]) {
    const saved = plain(neutral); change(saved); assert.throws(() => Full.restore(saved));
  }
  for (const saved of [null, undefined, [], {}, 'session']) assert.throws(() => Full.restore(saved));
  for (const target of ['session', 'answers', 'questionIds']) {
    const saved = plain(initial), object = target === 'session' ? saved : saved[target];
    Object.defineProperty(object, 'hidden', { value: 0, enumerable: false });
    assert.throws(() => Full.restore(saved));
  }
  let accessorRead = false;
  const accessor = plain(initial);
  Object.defineProperty(accessor.answers, initial.questionIds[0], { enumerable: true, get() { accessorRead = true; return 0; } });
  assert.throws(() => Full.restore(accessor));
  assert.equal(accessorRead, false);
  const inherited = plain(initial);
  inherited.answers = Object.create({ foreign: 0 });
  assert.throws(() => Full.restore(inherited));
  assert.throws(() => Full.importLegacy(initial.questionIds, { unknown: 1 }));
  assert.throws(() => Full.importLegacy(initial.questionIds.slice(1), {}));
});

test('mixed signed evidence and exact one-eighth midpoint boundary are retained', () => {
  const initial = Full.create(7), perAxis = {};
  const session = main(initial, q => {
    const index = perAxis[q.axis] || 0; perAxis[q.axis] = index + 1;
    return q.direction * [2, -1, 1, 0, 0, 0, 0, 0][index];
  });
  const score = Full.score(session);
  assert.equal(score.complete, true);
  for (const axis of axes) {
    assert.equal(score.scores[axis].sum, 2);
    assert.equal(score.scores[axis].normalized, 1 / 8);
    assert.equal(score.scores[axis].nearMidpoint, true);
    assert.equal(score.scores[axis].mixed, true);
  }
  const stronger = Full.answer(session, Full.questions(session).find(q => q.axis === 'energy' && session.answers[q.id] === 0).id, 2);
  const value = Full.score(stronger).scores.energy;
  assert.equal(value.nearMidpoint, Math.abs(value.normalized) <= 1 / 8);
});
