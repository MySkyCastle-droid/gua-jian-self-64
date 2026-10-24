'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.join(__dirname, '..', 'dist');
const sandbox = { window: {} };
vm.createContext(sandbox);
const files = ['data/questions.js', 'data/mapping.js', 'data/bank.js', 'core.js', 'bank.js'];
if (fs.existsSync(path.join(dist, 'short.js'))) files.push('short.js');
files.push('sessions.js');
for (const file of files) vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), sandbox, { filename: file });
const { GuaData: D, GuaCore: Core, GuaBank: Bank, GuaShort: Short, GuaSessions: Sessions } = sandbox.window;
const plain = value => JSON.parse(JSON.stringify(value));
const originalQuestions = D.questions;

function memory(initial = {}) {
  const entries = new Map(Object.entries(initial));
  const writes = [];
  const removals = [];
  return {
    entries, writes, removals,
    getItem(key) { return entries.has(key) ? entries.get(key) : null; },
    setItem(key, value) { writes.push(key); entries.set(key, value); },
    removeItem(key) { removals.push(key); entries.delete(key); }
  };
}
function full(options = {}) {
  const form = Bank.createForm(1873);
  return Object.assign(plain(Sessions.blank(48)), {
    questionIds: Array.from(form, q => q.id), started: true, phase: 'quiz'
  }, options);
}
function legacy(options = {}) {
  const state = full(options);
  delete state.mode;
  return state;
}
function allAnswers(state, value = 0) {
  return Object.fromEntries(Bank.restoreForm(state.questionIds).map(q => [q.id, typeof value === 'function' ? value(q) : value]));
}
function envelope() { return Sessions.load(memory()).envelope; }
function shortState(mode, count = 3) {
  let session = Short.create(mode, 911);
  for (let i = 0; i < count; i++) session = Short.answer(session, i, i % 2 ? -1 : 1);
  return Object.assign(plain(Sessions.blank(mode)), { started: true, phase: count === mode ? 'done' : 'quiz', questionIndex: Math.max(0, count - 1), short: plain(session) });
}

test('fresh storage has independent blank 10, 20 and 48 slots without drawing or activating questions', () => {
  const storage = memory();
  const loaded = Sessions.load(storage);
  assert.equal(Sessions.VERSION, 3);
  assert.equal(Sessions.KEY, 'guajian-self.session.v3');
  assert.equal(Sessions.LEGACY_KEY, 'guajian-self.session.v2');
  assert.equal(loaded.storageAvailable, true);
  assert.equal(loaded.envelope.activeMode, 10);
  assert.equal(loaded.envelope.preferredMode, 10);
  assert.equal(loaded.envelope.migratedLegacy, false);
  for (const mode of [10, 20, 48]) {
    const state = loaded.envelope.sessions[mode];
    assert.equal(state.mode, mode);
    assert.equal(state.started, false);
    assert.equal(state.phase, 'intro');
    if (mode === 48) assert.deepEqual(plain(state.questionIds), []);
    else { assert.equal(state.short, null); assert.equal(Object.hasOwn(state, 'answers'), false); }
  }
  assert.equal(storage.writes.length, 0);
  assert.equal(D.questions, originalQuestions);
});

test('unfinished v2 migration preserves original form, zero answers, phase and index, and keeps its backup', () => {
  const saved = legacy({ questionIndex: 23 });
  saved.answers = { [saved.questionIds[0]]: 0, [saved.questionIds[1]]: -2, [saved.questionIds[2]]: 2, extra: 1 };
  saved.answers[saved.questionIds[3]] = '1';
  saved.ties = { energy: 1 };
  const raw = JSON.stringify(saved);
  const storage = memory({ [Sessions.LEGACY_KEY]: raw });
  const loaded = Sessions.load(storage);
  const result = loaded.envelope.sessions[48];
  assert.equal(loaded.envelope.activeMode, 48);
  assert.equal(loaded.envelope.preferredMode, 10);
  assert.equal(loaded.envelope.migratedLegacy, true);
  assert.deepEqual(plain(result.questionIds), saved.questionIds);
  assert.deepEqual(plain(result.answers), Object.fromEntries(saved.questionIds.slice(0, 3).map(id => [id, saved.answers[id]])));
  assert.deepEqual(plain(result.ties), {});
  assert.equal(result.questionIndex, 23);
  assert.equal(result.phase, 'quiz');
  assert.equal(result.started, true);
  assert.equal(storage.entries.get(Sessions.LEGACY_KEY), raw);
  assert.deepEqual(storage.writes, [Sessions.KEY]);
  assert.equal(D.questions, originalQuestions);
});

test('v2 tie phase and completed neutral exploration preserve their valid tie choices', () => {
  const saved = legacy({ phase: 'ties', questionIndex: 47, tieIndex: 2 });
  saved.answers = allAnswers(saved);
  saved.ties = { energy: 1, information: -1, unknown: 1, decision: 0 };
  let storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(saved) });
  let state = Sessions.load(storage).envelope.sessions[48];
  assert.equal(state.phase, 'ties');
  assert.equal(state.tieIndex, 2);
  assert.deepEqual(plain(state.ties), { energy: 1, information: -1 });
  saved.phase = 'done';
  saved.ties = Object.fromEntries(D.axes.map((axis, i) => [axis.id, i % 2 ? -1 : 1]));
  storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(saved) });
  state = Sessions.load(storage).envelope.sessions[48];
  assert.equal(state.phase, 'done');
  assert.deepEqual(plain(state.ties), saved.ties);
  assert.deepEqual(plain(state.answers), saved.answers);
  assert.equal(D.questions, originalQuestions);
});

test('completed directional v2 exploration remains done and uses only relevant ties', () => {
  const saved = legacy({ phase: 'done', questionIndex: 47 });
  saved.answers = allAnswers(saved, q => q.direction * 2);
  saved.ties = Object.fromEntries(D.axes.map(axis => [axis.id, -1]));
  const state = Sessions.load(memory({ [Sessions.LEGACY_KEY]: JSON.stringify(saved) })).envelope.sessions[48];
  assert.equal(state.phase, 'done');
  assert.deepEqual(plain(state.answers), saved.answers);
  assert.deepEqual(plain(state.ties), {});
  assert.equal(state.scoringVersion, Core.VERSION);
});

test('incomplete done records downgrade to the needed phase and safely clamp indexes', () => {
  const saved = legacy({ phase: 'done', questionIndex: 900, tieIndex: -4 });
  let state = Sessions.load(memory({ [Sessions.LEGACY_KEY]: JSON.stringify(saved) })).envelope.sessions[48];
  assert.equal(state.phase, 'quiz');
  assert.equal(state.questionIndex, 47);
  assert.equal(state.tieIndex, 0);
  saved.answers = allAnswers(saved);
  saved.tieIndex = 900;
  state = Sessions.load(memory({ [Sessions.LEGACY_KEY]: JSON.stringify(saved) })).envelope.sessions[48];
  assert.equal(state.phase, 'ties');
  assert.equal(state.tieIndex, 5);
  saved.phase = 'ties';
  delete saved.answers[saved.questionIds[0]];
  state = Sessions.load(memory({ [Sessions.LEGACY_KEY]: JSON.stringify(saved) })).envelope.sessions[48];
  assert.equal(state.phase, 'quiz');
});

test('invalid v2 JSON, versions and forms never write a migrated v3 record', () => {
  const invalid = [
    '{',
    JSON.stringify(legacy({ version: 1 })),
    JSON.stringify(legacy({ bankVersion: 'obsolete' })),
    JSON.stringify(legacy({ scoringVersion: 'obsolete' })),
    JSON.stringify(legacy({ questionIds: [] })),
    JSON.stringify(legacy({ questionIds: Array(48).fill('QB000001') })),
    JSON.stringify(legacy({ questionIds: Array(48).fill('bad-id') }))
  ];
  for (const raw of invalid) {
    const storage = memory({ [Sessions.LEGACY_KEY]: raw });
    const result = Sessions.load(storage);
    assert.equal(result.storageAvailable, true);
    assert.equal(result.envelope.activeMode, 10);
    assert.equal(result.envelope.sessions[48].started, false);
    assert.equal(result.envelope.migratedLegacy, false);
    assert.equal(storage.entries.has(Sessions.KEY), false);
    assert.equal(storage.entries.get(Sessions.LEGACY_KEY), raw);
  }
  assert.equal(D.questions, originalQuestions);
});

test('a corrupt or incompatible v3 value never reimports the old v2 backup', () => {
  for (const raw of ['{', JSON.stringify({ version: 2 })]) {
    const storage = memory({ [Sessions.KEY]: raw, [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
    const result = Sessions.load(storage);
    assert.equal(result.storageAvailable, true);
    assert.equal(result.envelope.activeMode, 10);
    assert.equal(result.envelope.sessions[48].started, false);
    assert.equal(storage.writes.length, 0);
  }
});

test('v3 corruption in one mode preserves the other modes during load and save', { skip: !Short }, () => {
  const saved = envelope();
  saved.sessions[10] = shortState(10);
  saved.sessions[20] = shortState(20);
  saved.sessions[48] = full();
  saved.sessions[48].answers = { [saved.sessions[48].questionIds[0]]: 0 };
  saved.sessions[20].short.questionIds[0] = 'bad-id';
  saved.activeMode = 20;
  const result = Sessions.load(memory({ [Sessions.KEY]: JSON.stringify(saved) }));
  assert.equal(result.envelope.activeMode, 20);
  assert.equal(result.envelope.sessions[20].started, false);
  assert.deepEqual(plain(result.envelope.sessions[10]), saved.sessions[10]);
  assert.deepEqual(plain(result.envelope.sessions[48]), saved.sessions[48]);
  const storage = memory();
  const persisted = Sessions.save(storage, saved);
  assert.equal(persisted.storageAvailable, true);
  assert.equal(persisted.envelope.sessions[20].short, null);
  assert.deepEqual(plain(persisted.envelope.sessions[10]), saved.sessions[10]);
  assert.deepEqual(plain(Sessions.load(storage).envelope.sessions[48]), saved.sessions[48]);
  assert.equal(D.questions, originalQuestions);
});

test('mode selection is pure and keeps all question IDs, answers and indexes', { skip: !Short }, () => {
  const original = envelope();
  original.sessions[10] = shortState(10);
  original.sessions[20] = shortState(20, 7);
  original.sessions[48] = full({ questionIndex: 12 });
  const before = plain(original);
  let selected = original;
  for (const mode of [20, 48, 10, 48, 20]) selected = Sessions.select(selected, mode);
  assert.equal(selected.activeMode, 20);
  assert.equal(selected.preferredMode, 10);
  assert.deepEqual(plain(selected.sessions), before.sessions);
  assert.deepEqual(plain(original), before);
  assert.equal(D.questions, originalQuestions);
});

test('short reload retains review position, clamps unreachable indexes, and validates the nested engine session', { skip: !Short }, () => {
  const saved = envelope();
  saved.sessions[10] = shortState(10, 6);
  saved.sessions[10].questionIndex = 2;
  saved.sessions[20] = shortState(20, 2);
  saved.sessions[20].questionIndex = 99;
  saved.sessions[20].phase = 'done';
  const storage = memory();
  const result = Sessions.save(storage, saved);
  assert.equal(result.envelope.sessions[10].questionIndex, 2);
  assert.equal(result.envelope.sessions[20].questionIndex, 2);
  assert.equal(result.envelope.sessions[20].phase, 'quiz');
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
  saved.sessions[10].short.mode = 20;
  assert.equal(Sessions.save(storage, saved).envelope.sessions[10].short, null);
});

test('clearing one mode persists a blank slot and retains the other two and the v2 backup', { skip: !Short }, () => {
  const saved = envelope();
  saved.sessions[10] = shortState(10);
  saved.sessions[20] = shortState(20);
  saved.sessions[48] = full();
  saved.migratedLegacy = true;
  const before = plain(saved);
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  const cleared = Sessions.clear(storage, saved, 10);
  assert.equal(cleared.storageAvailable, true);
  assert.deepEqual(plain(cleared.envelope.sessions[10]), plain(Sessions.blank(10)));
  assert.deepEqual(plain(cleared.envelope.sessions[20]), before.sessions[20]);
  assert.deepEqual(plain(cleared.envelope.sessions[48]), before.sessions[48]);
  assert.deepEqual(plain(saved), before);
  assert.equal(storage.entries.has(Sessions.LEGACY_KEY), true);
  assert.equal(Sessions.load(storage).envelope.sessions[10].started, false);
});

test('clearing 48 mode prevents reimport from its retained legacy backup', () => {
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  const loaded = Sessions.load(storage);
  const cleared = Sessions.clear(storage, loaded.envelope, 48);
  assert.equal(cleared.envelope.sessions[48].started, false);
  assert.equal(storage.entries.has(Sessions.LEGACY_KEY), true);
  assert.equal(Sessions.load(storage).envelope.sessions[48].started, false);
  assert.equal(Sessions.load(storage).envelope.migratedLegacy, true);
});

test('clearing all modes saves a durable reset marker and removes the v2 backup', () => {
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  const loaded = Sessions.load(storage);
  const cleared = Sessions.clear(storage, loaded.envelope);
  assert.equal(cleared.storageAvailable, true);
  assert.equal(cleared.envelope.migratedLegacy, true);
  assert.equal(storage.entries.has(Sessions.LEGACY_KEY), false);
  for (const mode of [10, 20, 48]) assert.deepEqual(plain(cleared.envelope.sessions[mode]), plain(Sessions.blank(mode)));
  // Even a restored old backup cannot override the saved v3 reset.
  storage.entries.set(Sessions.LEGACY_KEY, JSON.stringify(legacy()));
  const reloaded = Sessions.load(storage);
  assert.equal(reloaded.envelope.sessions[48].started, false);
  assert.equal(reloaded.envelope.migratedLegacy, true);
  assert.equal(D.questions, originalQuestions);
});

test('save persists blank envelopes rather than leaving a previous exploration behind', () => {
  const storage = memory();
  const saved = envelope();
  saved.sessions[48] = full();
  Sessions.save(storage, saved);
  const blankResult = Sessions.save(storage, envelope());
  assert.equal(blankResult.storageAvailable, true);
  assert.equal(Sessions.load(storage).envelope.sessions[48].started, false);
  assert.equal(storage.writes.length, 2);
});

test('storage access, migration writes, normal writes and clears fail without throwing or losing in-memory progress', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(Sessions.load(blocked).storageAvailable, false);
  assert.equal(Sessions.load(undefined).storageAvailable, false);
  const saved = envelope();
  saved.sessions[48] = full({ questionIndex: 13 });
  const failed = Sessions.save(blocked, saved);
  assert.equal(failed.storageAvailable, false);
  assert.deepEqual(plain(failed.envelope.sessions[48]), saved.sessions[48]);
  assert.ok(failed.message);
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  storage.setItem = blocked.setItem;
  const migration = Sessions.load(storage);
  assert.equal(migration.storageAvailable, false);
  assert.equal(migration.envelope.activeMode, 48);
  assert.equal(migration.envelope.sessions[48].started, true);
  assert.equal(storage.entries.has(Sessions.LEGACY_KEY), true);
  assert.equal(storage.entries.has(Sessions.KEY), false);
  const cleared = Sessions.clear(blocked, saved);
  assert.equal(cleared.storageAvailable, false);
  assert.equal(cleared.envelope.migratedLegacy, true);
  assert.equal(cleared.envelope.sessions[48].started, false);
  assert.equal(D.questions, originalQuestions);
});
