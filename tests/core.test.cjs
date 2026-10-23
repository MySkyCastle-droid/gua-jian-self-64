'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['data/questions.js', 'data/mapping.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'dist', file), 'utf8'), sandbox, { filename: file });
}
const { GuaData: data, GuaCore: core } = sandbox.window;
const plain = value => JSON.parse(JSON.stringify(value));
const responses = (axisDirections = {}) => Object.fromEntries(data.questions.map(q => [q.id, q.direction * (axisDirections[q.axis] ?? 2)]));
const neutral = () => Object.fromEntries(data.questions.map(q => [q.id, 0]));

test('48 unique questions, six balanced axes, and four balanced chapters', () => {
  assert.equal(data.questions.length, 48);
  assert.equal(new Set(data.questions.map(q => q.id)).size, 48);
  assert.equal(data.axes.length, 6);
  for (const axis of data.axes) {
    const questions = data.questions.filter(q => q.axis === axis.id);
    assert.equal(questions.length, 8);
    assert.equal(questions.filter(q => q.direction === 1).length, 4);
    assert.equal(questions.filter(q => q.direction === -1).length, 4);
    assert.ok(data.tieQuestions[axis.id].positive);
    assert.ok(data.tieQuestions[axis.id].negative);
    for (let chapter = 1; chapter <= 4; chapter++) {
      const pair = questions.filter(q => q.chapter === chapter);
      assert.equal(pair.length, 2);
      assert.equal(pair.reduce((sum, q) => sum + q.direction, 0), 0);
    }
  }
  for (let chapter = 1; chapter <= 4; chapter++) assert.equal(data.questions.filter(q => q.chapter === chapter).length, 12);
  assert.deepEqual(plain(data.versions), { questions: '1.0.0', mapping: '1.0.0', scoring: '1.0.0' });
});

test('reverse scoring preserves endpoint direction and exact -16..16 limits', () => {
  const positive = core.score(responses());
  const negative = core.score(responses(Object.fromEntries(data.axes.map(a => [a.id, -2]))));
  assert.equal(positive.complete, true);
  assert.equal(positive.type, 'ESTJ');
  assert.equal(positive.emotion, 'calm');
  assert.equal(positive.coordination, 'autonomous');
  assert.equal(positive.hexagramId, 34);
  assert.equal(negative.type, 'INFP');
  assert.equal(negative.hexagramId, 31);
  for (const axis of data.axes) {
    assert.equal(positive.scores[axis.id].sum, 16);
    assert.equal(negative.scores[axis.id].sum, -16);
    assert.equal(positive.scores[axis.id].side, 'positive');
    assert.equal(negative.scores[axis.id].side, 'negative');
  }
});

test('missing and invalid values are unanswered, while zero is a valid response', () => {
  const answers = responses();
  delete answers.q01;
  const missing = core.score(answers);
  assert.equal(missing.answered, 47);
  assert.equal(missing.complete, false);
  assert.equal(missing.resultKey, null);
  assert.equal(missing.hexagramId, null);
  answers.q01 = 0;
  assert.equal(core.score(answers).answered, 48);
  assert.equal(core.score(answers).complete, true);
  for (const invalid of [undefined, null, '0', '2', true, NaN, Infinity, 0.5, 3, -3, {}, []]) {
    answers.q01 = invalid;
    assert.equal(core.score(answers).answered, 47);
    assert.equal(core.score(answers).complete, false);
  }
  assert.equal(core.countAnswered(null), 0);
  assert.equal(core.countAnswered({ extra: 1 }), 0);
  assert.equal(core.countAnswered(Object.create(responses())), 0);
});

test('all-neutral answers need exactly six tie questions and keep original sums', () => {
  const answers = neutral();
  const before = core.score(answers);
  assert.equal(before.answered, 48);
  assert.equal(before.complete, false);
  assert.equal(before.allNeutral, true);
  assert.equal(before.ties.length, 6);
  assert.equal(before.unresolvedTies.length, 6);
  assert.equal(before.type, null);
  const tieChoices = Object.fromEntries(data.axes.map(a => [a.id, 1]));
  const after = core.score(answers, tieChoices);
  assert.equal(after.complete, true);
  assert.equal(after.type, 'ESTJ');
  assert.equal(after.ties.length, 6);
  assert.equal(after.unresolvedTies.length, 0);
  assert.equal(after.allNeutral, true);
  for (const axis of data.axes) {
    assert.equal(after.scores[axis.id].sum, 0);
    assert.equal(after.scores[axis.id].nearMidpoint, true);
    assert.equal(after.scores[axis.id].tied, true);
  }
  tieChoices.energy = '1';
  assert.equal(core.score(answers, tieChoices).complete, false);
});

test('cleanTies removes stale, invalid, unknown, and incomplete-axis choices without mutation', () => {
  const answers = neutral();
  const tieChoices = { energy: 1, information: -1, decision: 0, organization: '1', emotion: 1, coordination: -1, unknown: 1 };
  const original = JSON.stringify(tieChoices);
  answers.q01 = 1;
  delete answers.q05;
  assert.deepEqual(plain(core.cleanTies(answers, tieChoices)), { information: -1, coordination: -1 });
  assert.equal(JSON.stringify(tieChoices), original);
  const scored = core.score(answers, tieChoices);
  assert.equal(scored.scores.energy.sum, 1);
  assert.equal(scored.scores.energy.key, 'E');
  assert.equal(scored.scores.emotion.side, null);
  assert.equal(scored.complete, false);
});

test('midpoint flag includes sums -2..2 and never changes the measured sum', () => {
  const answers = neutral();
  answers.q01 = 2;
  const a = core.score(answers, { energy: -1 });
  assert.equal(a.scores.energy.sum, 2);
  assert.equal(a.scores.energy.nearMidpoint, true);
  assert.equal(a.scores.energy.key, 'E');
  answers.q07 = -1;
  assert.equal(core.score(answers).scores.energy.sum, 3);
  assert.equal(core.score(answers).scores.energy.nearMidpoint, false);
});

test('all 64 classifications map bijectively to the 64 expected King Wen numbers', () => {
  assert.equal(Object.keys(data.mapping).length, 64);
  const ids = new Set();
  for (let mask = 0; mask < 64; mask++) {
    const directions = Object.fromEntries(data.axes.map((axis, index) => [axis.id, mask & (1 << index) ? 2 : -2]));
    const score = core.score(responses(directions));
    assert.equal(score.complete, true);
    assert.equal(score.ties.length, 0);
    assert.ok(Object.hasOwn(data.mapping, score.resultKey));
    assert.equal(score.hexagramId, data.mapping[score.resultKey]);
    ids.add(score.hexagramId);
  }
  assert.deepEqual([...ids].sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i + 1));
  const expectedRows = { INTJ: [26,50,23,18], INTP: [52,48,4,64], ENTJ: [1,7,43,49], ENTP: [38,14,51,21], INFJ: [20,53,36,61], INFP: [12,15,29,31], ENFJ: [19,13,30,42], ENFP: [56,46,44,59], ISTJ: [32,37,60,39], ISFJ: [27,2,62,41], ESTJ: [34,11,6,63], ESFJ: [10,8,54,45], ISTP: [25,40,47,28], ISFP: [33,17,22,57], ESTP: [5,9,3,35], ESFP: [24,16,55,58] };
  const variants = ['calm-autonomous', 'calm-cooperative', 'sensitive-autonomous', 'sensitive-cooperative'];
  for (const [type, row] of Object.entries(expectedRows)) variants.forEach((variant, i) => assert.equal(data.mapping[type + '-' + variant], row[i]));
});

test('same answers reproduce the same result and scoring does not mutate input', () => {
  const answers = responses({ information: -1, coordination: -2 });
  const ties = { energy: -1 };
  const snapshot = JSON.stringify({ answers, ties });
  const first = JSON.stringify(core.score(answers, ties));
  assert.equal(JSON.stringify(core.score(answers, ties)), first);
  assert.equal(JSON.stringify({ answers, ties }), snapshot);
});
