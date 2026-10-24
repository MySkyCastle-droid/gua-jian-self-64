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
if (fs.existsSync(path.join(dist, 'short-legacy.js'))) files.push('short-legacy.js');
if (fs.existsSync(path.join(dist, 'short.js'))) files.push('short.js');
files.push('sessions.js');
for (const file of files) vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), sandbox, { filename: file });
const { GuaData: D, GuaCore: Core, GuaBank: Bank, GuaShort: Short, GuaShortLegacy: LegacyShort, GuaSessions: Sessions } = sandbox.window;
const plain = value => JSON.parse(JSON.stringify(value));
const originalQuestions = D.questions;
const originalQuestionData = plain(D.questions);
test.afterEach(() => {
  assert.equal(D.questions, originalQuestions);
  assert.deepEqual(plain(D.questions), originalQuestionData);
});

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
  return Object.assign(plain(Sessions.blank(mode)), { started: true, phase: Short.score(session).finished ? 'done' : 'quiz', questionIndex: Math.max(0, count - 1), short: plain(session) });
}
const binaryIds = {
  10: ['QB054945', 'QB076985', 'QB023710', 'QB038224', 'QB010468', 'QB097132', 'QB061884', 'QB052749', 'QB081506', 'QB069526'],
  20: ['QB098855', 'QB037125', 'QB016458', 'QB072377', 'QB059239', 'QB023461', 'QB056313', 'QB065179', 'QB024584', 'QB025418', 'QB003403', 'QB016226', 'QB070749', 'QB077293', 'QB088393', 'QB099197', 'QB039229', 'QB042807', 'QB066176', 'QB053875']
};
function binaryState(mode, count = 3) {
  return {
    mode, started: true, phase: count === mode ? 'done' : 'quiz', questionIndex: Math.max(0, count - 1), tieIndex: 0,
    short: { mode, seed: 911, version: '1.0.0', bankVersion: D.bank.version,
      questionIds: binaryIds[mode].slice(0, Math.min(count + 1, mode)), answers: Array.from({ length: count }, (_, i) => i % 2 ? -1 : 1) }
  };
}
function previousEnvelope() {
  return { version: 3, activeMode: 10, preferredMode: 10, migratedLegacy: false,
    sessions: { 10: plain(Sessions.blank(10)), 20: plain(Sessions.blank(20)), 48: plain(Sessions.blank(48)) } };
}

test('fresh storage has independent blank 10, 20 and 48 slots without drawing or activating questions', () => {
  const storage = memory();
  const loaded = Sessions.load(storage);
  assert.equal(Sessions.VERSION, 4);
  assert.equal(Sessions.KEY, 'guajian-self.session.v4');
  assert.equal(Sessions.PREVIOUS_KEY, 'guajian-self.session.v3');
  assert.equal(Sessions.LEGACY_KEY, 'guajian-self.session.v2');
  assert.equal(loaded.storageAvailable, true);
  assert.equal(loaded.envelope.activeMode, 10);
  assert.equal(loaded.envelope.preferredMode, 10);
  assert.equal(loaded.envelope.migratedLegacy, false);
  assert.deepEqual(plain(loaded.envelope.archives), { 10: null, 20: null });
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

test('v3 migration preserves only the 48-question active progress and archives binary short records unchanged', { skip: !Short || !LegacyShort }, () => {
  const saved = previousEnvelope();
  saved.activeMode = 48;
  saved.preferredMode = 20;
  saved.sessions[10] = binaryState(10, 10);
  saved.sessions[20] = binaryState(20, 7);
  saved.sessions[20].questionIndex = 2;
  saved.sessions[48] = full({ phase: 'ties', questionIndex: 47, tieIndex: 3 });
  saved.sessions[48].answers = allAnswers(saved.sessions[48]);
  saved.sessions[48].ties = { energy: -1, information: 1 };
  const raw = JSON.stringify(saved);
  const storage = memory({ [Sessions.PREVIOUS_KEY]: raw, [Sessions.LEGACY_KEY]: JSON.stringify(legacy({ questionIndex: 1 })) });
  const result = Sessions.load(storage);
  assert.equal(result.storageAvailable, true);
  assert.equal(result.envelope.version, 4);
  assert.equal(result.envelope.activeMode, 48);
  assert.equal(result.envelope.preferredMode, 20);
  assert.equal(result.envelope.migratedLegacy, true);
  assert.deepEqual(plain(result.envelope.sessions[48]), saved.sessions[48]);
  for (const mode of [10, 20]) {
    assert.deepEqual(plain(result.envelope.sessions[mode]), plain(Sessions.blank(mode)));
    assert.deepEqual(plain(result.envelope.archives[mode]), saved.sessions[mode]);
    assert.equal(result.envelope.archives[mode].short.version, '1.0.0');
    assert.equal(LegacyShort.questions(result.envelope.archives[mode].short).length, saved.sessions[mode].short.questionIds.length);
  }
  assert.equal(LegacyShort.score(result.envelope.archives[10].short).complete, true);
  assert.equal(LegacyShort.score(result.envelope.archives[20].short).complete, false);
  assert.equal(LegacyShort.answer, undefined);
  assert.equal(LegacyShort.create, undefined);
  assert.equal(storage.entries.get(Sessions.PREVIOUS_KEY), raw);
  assert.deepEqual(storage.writes, [Sessions.KEY]);
  // The first five-point save must not discard either archived binary session.
  result.envelope.sessions[10] = shortState(10, 4);
  const firstSave = Sessions.save(storage, result.envelope);
  assert.deepEqual(plain(firstSave.envelope.archives), { 10: saved.sessions[10], 20: saved.sessions[20] });
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(firstSave.envelope));
});

test('v3 blank short slots remain unarchived and a completed 48-question report stays done', () => {
  const saved = previousEnvelope();
  saved.sessions[48] = full({ phase: 'done', questionIndex: 47 });
  saved.sessions[48].answers = allAnswers(saved.sessions[48], q => 2 * q.direction);
  const result = Sessions.load(memory({ [Sessions.PREVIOUS_KEY]: JSON.stringify(saved) }));
  assert.equal(result.envelope.sessions[48].phase, 'done');
  assert.deepEqual(plain(result.envelope.sessions[48]), saved.sessions[48]);
  assert.deepEqual(plain(result.envelope.archives), { 10: null, 20: null });
});

test('a corrupt v3 slot is isolated during migration while other archives and full progress survive', { skip: !LegacyShort }, () => {
  const saved = previousEnvelope();
  saved.sessions[10] = binaryState(10, 10);
  saved.sessions[20] = binaryState(20);
  saved.sessions[20].short.answers[0] = 0;
  saved.sessions[48] = full({ questionIndex: 17 });
  const result = Sessions.load(memory({ [Sessions.PREVIOUS_KEY]: JSON.stringify(saved) }));
  assert.ok(result.message);
  assert.deepEqual(plain(result.envelope.archives[10]), saved.sessions[10]);
  assert.equal(result.envelope.archives[20], null);
  assert.deepEqual(plain(result.envelope.sessions[48]), saved.sessions[48]);
});

test('a corrupt or incompatible v3 value reports the problem and never falls back to v2', () => {
  for (const raw of ['{', JSON.stringify({ version: 2 }), 'null']) {
    const storage = memory({ [Sessions.PREVIOUS_KEY]: raw, [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
    const result = Sessions.load(storage);
    assert.equal(result.storageAvailable, true);
    assert.equal(result.envelope.sessions[48].started, false);
    assert.deepEqual(plain(result.envelope.archives), { 10: null, 20: null });
    assert.ok(result.message);
    assert.deepEqual(storage.writes, []);
    assert.equal(storage.entries.get(Sessions.PREVIOUS_KEY), raw);
  }
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

test('invalid v2 JSON, versions and forms never write a migrated v4 record', () => {
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

test('a corrupt or incompatible v4 value never reimports either backup', () => {
  for (const raw of ['{', JSON.stringify({ version: 2 })]) {
    const storage = memory({ [Sessions.KEY]: raw, [Sessions.PREVIOUS_KEY]: JSON.stringify(previousEnvelope()), [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
    const result = Sessions.load(storage);
    assert.equal(result.storageAvailable, true);
    assert.equal(result.envelope.activeMode, 10);
    assert.equal(result.envelope.sessions[48].started, false);
    assert.equal(storage.writes.length, 0);
  }
});

test('v4 corruption in one mode preserves the other modes and binary archives during load and save', { skip: !Short || !LegacyShort }, () => {
  const saved = envelope();
  saved.sessions[10] = shortState(10);
  saved.sessions[20] = shortState(20);
  saved.sessions[48] = full();
  saved.sessions[48].answers = { [saved.sessions[48].questionIds[0]]: 0 };
  saved.archives[10] = binaryState(10, 10);
  saved.archives[20] = binaryState(20, 7);
  saved.sessions[20].short.questionIds[0] = 'bad-id';
  saved.activeMode = 20;
  const result = Sessions.load(memory({ [Sessions.KEY]: JSON.stringify(saved) }));
  assert.equal(result.envelope.activeMode, 20);
  assert.equal(result.envelope.sessions[20].started, false);
  assert.deepEqual(plain(result.envelope.sessions[10]), saved.sessions[10]);
  assert.deepEqual(plain(result.envelope.sessions[48]), saved.sessions[48]);
  assert.deepEqual(plain(result.envelope.archives), plain(saved.archives));
  const storage = memory();
  const persisted = Sessions.save(storage, saved);
  assert.equal(persisted.storageAvailable, true);
  assert.equal(persisted.envelope.sessions[20].short, null);
  assert.deepEqual(plain(persisted.envelope.sessions[10]), saved.sessions[10]);
  assert.deepEqual(plain(Sessions.load(storage).envelope.sessions[48]), saved.sessions[48]);
  assert.deepEqual(plain(Sessions.load(storage).envelope.archives), plain(saved.archives));
  assert.ok(persisted.message);
  assert.equal(D.questions, originalQuestions);
});

test('a corrupt archive is isolated without losing current short progress, full progress or the other archive', { skip: !Short || !LegacyShort }, () => {
  const saved = envelope();
  saved.sessions[10] = shortState(10, 5);
  saved.sessions[48] = full({ questionIndex: 17 });
  saved.archives[10] = binaryState(10, 10);
  saved.archives[20] = binaryState(20, 20);
  saved.archives[20].short.questionIds[0] = 'bad-id';
  const storage = memory();
  const result = Sessions.save(storage, saved);
  assert.ok(result.message);
  assert.deepEqual(plain(result.envelope.sessions), plain(saved.sessions));
  assert.deepEqual(plain(result.envelope.archives[10]), saved.archives[10]);
  assert.equal(result.envelope.archives[20], null);
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
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

test('finished unclassified five-point records remain done after clarification and reload', { skip: !Short }, () => {
  const saved = envelope();
  for (const mode of [10, 20]) {
    let session = Short.create(mode, 77);
    while (!Short.score(session).finished) session = Short.answer(session, session.answers.length, 0);
    assert.equal(session.answers.length, mode + 6);
    assert.equal(Short.score(session).complete, false);
    saved.sessions[mode] = Object.assign(plain(Sessions.blank(mode)), {
      started: true, phase: 'done', questionIndex: 999, short: plain(session)
    });
  }
  const storage = memory();
  const result = Sessions.save(storage, saved);
  assert.equal(result.message, '');
  for (const mode of [10, 20]) {
    const state = result.envelope.sessions[mode];
    assert.equal(state.phase, 'done');
    assert.equal(state.questionIndex, mode + 5);
    assert.equal(state.short.answers.length, mode + 6);
    assert.equal(state.short.questionIds.length, mode + 6);
    assert.deepEqual(Object.keys(state.short).sort(), ['answers', 'bankVersion', 'mode', 'questionIds', 'seed', 'version'].sort());
  }
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
  // A canonical unfinished session cannot retain the result phase.
  let unfinished = Short.create(10, 77);
  for (let i = 0; i < 15; i++) unfinished = Short.answer(unfinished, i, 0);
  saved.sessions[10].short = plain(unfinished);
  assert.equal(Sessions.save(memory(), saved).envelope.sessions[10].phase, 'quiz');
});

test('clearing one mode persists a blank slot and retains the other two, archives and both backups', { skip: !Short || !LegacyShort }, () => {
  const saved = envelope();
  saved.sessions[10] = shortState(10);
  saved.sessions[20] = shortState(20);
  saved.sessions[48] = full();
  saved.archives[10] = binaryState(10, 10);
  saved.archives[20] = binaryState(20);
  saved.migratedLegacy = true;
  const before = plain(saved);
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()), [Sessions.PREVIOUS_KEY]: JSON.stringify(previousEnvelope()) });
  const cleared = Sessions.clear(storage, saved, 10);
  assert.equal(cleared.storageAvailable, true);
  assert.deepEqual(plain(cleared.envelope.sessions[10]), plain(Sessions.blank(10)));
  assert.deepEqual(plain(cleared.envelope.sessions[20]), before.sessions[20]);
  assert.deepEqual(plain(cleared.envelope.sessions[48]), before.sessions[48]);
  assert.deepEqual(plain(cleared.envelope.archives), before.archives);
  assert.deepEqual(plain(saved), before);
  assert.equal(storage.entries.has(Sessions.LEGACY_KEY), true);
  assert.equal(storage.entries.has(Sessions.PREVIOUS_KEY), true);
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

test('clearing all modes saves a durable reset marker and removes archives and both backups', { skip: !LegacyShort }, () => {
  const old = previousEnvelope();
  old.sessions[10] = binaryState(10, 10);
  old.sessions[20] = binaryState(20);
  old.sessions[48] = full();
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()), [Sessions.PREVIOUS_KEY]: JSON.stringify(old) });
  const loaded = Sessions.load(storage);
  const cleared = Sessions.clear(storage, loaded.envelope);
  assert.equal(cleared.storageAvailable, true);
  assert.equal(cleared.envelope.migratedLegacy, true);
  assert.equal(storage.entries.has(Sessions.LEGACY_KEY), false);
  assert.equal(storage.entries.has(Sessions.PREVIOUS_KEY), false);
  assert.deepEqual(plain(cleared.envelope.archives), { 10: null, 20: null });
  for (const mode of [10, 20, 48]) assert.deepEqual(plain(cleared.envelope.sessions[mode]), plain(Sessions.blank(mode)));
  // Even restored old backups cannot override the saved v4 reset.
  storage.entries.set(Sessions.LEGACY_KEY, JSON.stringify(legacy()));
  storage.entries.set(Sessions.PREVIOUS_KEY, JSON.stringify(old));
  const reloaded = Sessions.load(storage);
  assert.equal(reloaded.envelope.sessions[48].started, false);
  assert.equal(reloaded.envelope.migratedLegacy, true);
  assert.deepEqual(plain(reloaded.envelope.archives), { 10: null, 20: null });
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

test('v3 migration and later storage failures retain the validated archives and progress in memory', { skip: !Short || !LegacyShort }, () => {
  const saved = previousEnvelope();
  saved.sessions[10] = binaryState(10, 10);
  saved.sessions[20] = binaryState(20);
  saved.sessions[48] = full({ questionIndex: 31 });
  const raw = JSON.stringify(saved);
  const storage = memory({ [Sessions.PREVIOUS_KEY]: raw });
  storage.setItem = () => { throw new Error('quota'); };
  const migrated = Sessions.load(storage);
  assert.equal(migrated.storageAvailable, false);
  assert.ok(migrated.message);
  assert.deepEqual(plain(migrated.envelope.archives), { 10: saved.sessions[10], 20: saved.sessions[20] });
  assert.deepEqual(plain(migrated.envelope.sessions[48]), saved.sessions[48]);
  assert.equal(storage.entries.get(Sessions.PREVIOUS_KEY), raw);
  assert.equal(storage.entries.has(Sessions.KEY), false);
  migrated.envelope.sessions[10] = shortState(10, 2);
  const failed = Sessions.save(undefined, migrated.envelope);
  assert.equal(failed.storageAvailable, false);
  assert.deepEqual(plain(failed.envelope), plain(migrated.envelope));
  const cleared = Sessions.clear(undefined, migrated.envelope, 10);
  assert.equal(cleared.storageAvailable, false);
  assert.equal(cleared.envelope.sessions[10].short, null);
  assert.deepEqual(plain(cleared.envelope.archives), plain(migrated.envelope.archives));
});

test('an unreadable v3 storage entry does not trigger a v2 fallback and failed backup removal keeps a v4 reset', () => {
  const reads = [];
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  const getItem = storage.getItem.bind(storage);
  storage.getItem = key => {
    reads.push(key);
    if (key === Sessions.PREVIOUS_KEY) throw new Error('blocked');
    return getItem(key);
  };
  const result = Sessions.load(storage);
  assert.equal(result.storageAvailable, false);
  assert.deepEqual(reads, [Sessions.KEY, Sessions.PREVIOUS_KEY]);
  assert.equal(result.envelope.sessions[48].started, false);
  storage.removeItem = () => { throw new Error('blocked'); };
  const cleared = Sessions.clear(storage, envelope());
  assert.equal(cleared.storageAvailable, false);
  assert.equal(storage.entries.has(Sessions.KEY), true);
  assert.equal(Sessions.load(storage).envelope.migratedLegacy, true);
  assert.equal(Sessions.load(storage).envelope.sessions[48].started, false);
});
