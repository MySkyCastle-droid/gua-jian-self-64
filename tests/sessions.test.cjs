'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.join(__dirname, '..', 'dist');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['data/questions.js', 'data/mapping.js', 'data/bank.js', 'core.js', 'bank.js', 'short-legacy.js', 'short.js', 'full.js', 'sessions.js']) {
  vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), sandbox, { filename: file });
}
const { GuaData: D, GuaCore: Core, GuaBank: Bank, GuaShort: Short, GuaShortLegacy: LegacyShort, GuaFull: Full, GuaSessions: Sessions } = sandbox.window;
const plain = value => JSON.parse(JSON.stringify(value));
const originalQuestions = D.questions;
const originalQuestionData = plain(D.questions);
test.afterEach(() => {
  assert.equal(D.questions, originalQuestions);
  assert.deepEqual(plain(D.questions), originalQuestionData);
});
function memory(initial = {}) {
  const entries = new Map(Object.entries(initial));
  const reads = [], writes = [], removals = [];
  return { entries, reads, writes, removals,
    getItem(key) { reads.push(key); return entries.has(key) ? entries.get(key) : null; },
    setItem(key, value) { writes.push(key); entries.set(key, value); },
    removeItem(key) { removals.push(key); entries.delete(key); }
  };
}
function legacyBlank() {
  return { mode: 48, started: false, phase: 'intro', questionIndex: 0, tieIndex: 0, version: 2,
    bankVersion: D.bank.version, scoringVersion: Core.VERSION, questionIds: [], answers: {}, ties: {} };
}
function oldFull(options = {}) {
  return Object.assign(legacyBlank(), { questionIds: Array.from(Bank.createForm(1873), q => q.id), started: true, phase: 'quiz' }, options);
}
function legacy(options = {}) { const state = oldFull(options); delete state.mode; return state; }
function allAnswers(state, value = 0) {
  return Object.fromEntries(Bank.restoreForm(state.questionIds).map(q => [q.id, typeof value === 'function' ? value(q) : value]));
}
function full(options = {}) {
  let session = Full.create(1873);
  session = Full.answer(session, session.questionIds[0], 0);
  return Object.assign(plain(Sessions.blank(48)), { started: true, phase: 'quiz', full: plain(session) }, options);
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
  return { mode, started: true, phase: count === mode ? 'done' : 'quiz', questionIndex: Math.max(0, count - 1), tieIndex: 0,
    short: { mode, seed: 911, version: '1.0.0', bankVersion: D.bank.version,
      questionIds: binaryIds[mode].slice(0, Math.min(count + 1, mode)), answers: Array.from({ length: count }, (_, i) => i % 2 ? -1 : 1) } };
}
function previousEnvelope(version = 3) {
  const result = { version, activeMode: 10, preferredMode: 10, migratedLegacy: false,
    sessions: { 10: plain(Sessions.blank(10)), 20: plain(Sessions.blank(20)), 48: legacyBlank() } };
  if (version === 4) result.archives = { 10: null, 20: null };
  return result;
}
function backupKey(version) { return version === 4 ? Sessions.PREVIOUS_KEY : version === 3 ? Sessions.OLDER_KEY : Sessions.LEGACY_KEY; }
function migrate(saved, version = saved.version) { return Sessions.load(memory({ [backupKey(version)]: JSON.stringify(saved) })); }
function assertImported(state, saved) {
  assert.equal(state.questionIndex, saved.questionIndex);
  assert.equal(state.started, saved.started);
  assert.equal(state.phase, saved.phase === 'intro' ? 'intro' : 'quiz');
  assert.deepEqual(plain(state.full.questionIds), saved.questionIds);
  assert.deepEqual(plain(state.full.answers), saved.answers);
  assert.deepEqual(plain(state.full.clarificationAnswers), {});
  assert.equal(state.full.formOrigin, 'legacy');
  assert.equal(Object.hasOwn(state.full, 'ties'), false);
}

test('fresh storage has independent blank 10, 20 and 48 slots without drawing or activating questions', () => {
  const storage = memory(), loaded = Sessions.load(storage);
  assert.equal(Sessions.VERSION, 5);
  assert.equal(Sessions.KEY, 'guajian-self.session.v5');
  assert.equal(Sessions.PREVIOUS_KEY, 'guajian-self.session.v4');
  assert.equal(Sessions.OLDER_KEY, 'guajian-self.session.v3');
  assert.equal(Sessions.LEGACY_KEY, 'guajian-self.session.v2');
  assert.equal(loaded.storageAvailable, true);
  assert.equal(loaded.envelope.activeMode, 10);
  assert.equal(loaded.envelope.preferredMode, 10);
  assert.equal(loaded.envelope.migratedLegacy, false);
  assert.deepEqual(plain(loaded.envelope.archives), { 10: null, 20: null, 48: null });
  for (const mode of [10, 20, 48]) {
    assert.deepEqual(plain(loaded.envelope.sessions[mode]), plain(Sessions.blank(mode)));
    assert.equal(loaded.envelope.sessions[mode][mode === 48 ? 'full' : 'short'], null);
    assert.equal(Object.hasOwn(loaded.envelope.sessions[mode], 'answers'), false);
  }
  assert.equal(storage.writes.length, 0);
});

test('v3 migration imports unfinished full progress and preserves binary short archives unchanged', () => {
  const saved = previousEnvelope();
  saved.activeMode = 48; saved.preferredMode = 20;
  saved.sessions[10] = binaryState(10, 10); saved.sessions[20] = binaryState(20, 7);
  saved.sessions[20].questionIndex = 2;
  saved.sessions[48] = oldFull({ phase: 'ties', questionIndex: 47, tieIndex: 3 });
  saved.sessions[48].answers = allAnswers(saved.sessions[48]);
  saved.sessions[48].ties = { energy: -1, information: 1 };
  const raw = JSON.stringify(saved);
  const storage = memory({ [Sessions.OLDER_KEY]: raw, [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  const result = Sessions.load(storage);
  assert.equal(result.envelope.version, 5); assert.equal(result.envelope.activeMode, 48);
  assert.equal(result.envelope.preferredMode, 20); assert.equal(result.envelope.migratedLegacy, true);
  assertImported(result.envelope.sessions[48], saved.sessions[48]);
  assert.deepEqual(plain(result.envelope.archives[48]), saved.sessions[48]);
  for (const mode of [10, 20]) {
    assert.deepEqual(plain(result.envelope.sessions[mode]), plain(Sessions.blank(mode)));
    assert.deepEqual(plain(result.envelope.archives[mode]), saved.sessions[mode]);
    assert.equal(LegacyShort.questions(result.envelope.archives[mode].short).length, saved.sessions[mode].short.questionIds.length);
  }
  assert.equal(LegacyShort.score(result.envelope.archives[10].short).complete, true);
  assert.equal(LegacyShort.score(result.envelope.archives[20].short).complete, false);
  assert.equal(LegacyShort.answer, undefined); assert.equal(LegacyShort.create, undefined);
  assert.equal(storage.entries.get(Sessions.OLDER_KEY), raw); assert.deepEqual(storage.writes, [Sessions.KEY]);
  result.envelope.sessions[10] = shortState(10, 4);
  const firstSave = Sessions.save(storage, result.envelope);
  assert.deepEqual(plain(firstSave.envelope.archives), plain(result.envelope.archives));
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(firstSave.envelope));
});

test('v3 blank short slots stay unarchived and completed full reports stay in the readonly archive', () => {
  const saved = previousEnvelope();
  saved.sessions[48] = oldFull({ phase: 'done', questionIndex: 47 });
  saved.sessions[48].answers = allAnswers(saved.sessions[48], q => 2 * q.direction);
  const result = migrate(saved);
  assert.deepEqual(plain(result.envelope.sessions[48]), plain(Sessions.blank(48)));
  assert.deepEqual(plain(result.envelope.archives), { 10: null, 20: null, 48: saved.sessions[48] });
});

test('a corrupt v3 slot is isolated while other archives and imported full progress survive', () => {
  const saved = previousEnvelope();
  saved.sessions[10] = binaryState(10, 10); saved.sessions[20] = binaryState(20);
  saved.sessions[20].short.answers[0] = 0;
  saved.sessions[48] = oldFull({ questionIndex: 17 });
  const result = migrate(saved);
  assert.ok(result.message); assert.deepEqual(plain(result.envelope.archives[10]), saved.sessions[10]);
  assert.equal(result.envelope.archives[20], null); assertImported(result.envelope.sessions[48], saved.sessions[48]);
});

test('a corrupt or incompatible v3 value reports the problem and never falls back to v2', () => {
  for (const raw of ['{', JSON.stringify({ version: 2 }), 'null']) {
    const storage = memory({ [Sessions.OLDER_KEY]: raw, [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
    const result = Sessions.load(storage);
    assert.equal(result.storageAvailable, true); assert.equal(result.envelope.sessions[48].started, false);
    assert.deepEqual(plain(result.envelope.archives), { 10: null, 20: null, 48: null });
    assert.ok(result.message); assert.deepEqual(storage.writes, []); assert.equal(storage.entries.get(Sessions.OLDER_KEY), raw);
  }
});

test('unfinished v2 migration preserves its form, valid zero answers, index and backup', () => {
  const saved = legacy({ questionIndex: 23 });
  saved.answers = { [saved.questionIds[0]]: 0, [saved.questionIds[1]]: -2, [saved.questionIds[2]]: 2, extra: 1, [saved.questionIds[3]]: '1' };
  saved.ties = { energy: 1 };
  const raw = JSON.stringify(saved), storage = memory({ [Sessions.LEGACY_KEY]: raw });
  const loaded = Sessions.load(storage), state = loaded.envelope.sessions[48];
  assert.equal(loaded.envelope.activeMode, 48); assert.equal(loaded.envelope.preferredMode, 10);
  assert.equal(loaded.envelope.migratedLegacy, true);
  assert.deepEqual(plain(state.full.questionIds), saved.questionIds);
  assert.deepEqual(plain(state.full.answers), Object.fromEntries(saved.questionIds.slice(0, 3).map(id => [id, saved.answers[id]])));
  assert.deepEqual(plain(state.full.clarificationAnswers), {});
  assert.deepEqual(plain(loaded.envelope.archives[48].ties), {});
  assert.equal(state.questionIndex, 23); assert.equal(state.phase, 'quiz'); assert.equal(state.started, true);
  assert.equal(storage.entries.get(Sessions.LEGACY_KEY), raw); assert.deepEqual(storage.writes, [Sessions.KEY]);
});

test('v2 binary ties stay archived and are never converted into clarification intensity', () => {
  const saved = legacy({ phase: 'ties', questionIndex: 47, tieIndex: 2 });
  saved.answers = allAnswers(saved); saved.ties = { energy: 1, information: -1, unknown: 1, decision: 0 };
  let result = migrate(saved, 2);
  assert.equal(result.envelope.sessions[48].phase, 'quiz');
  assert.deepEqual(plain(result.envelope.sessions[48].full.clarificationAnswers), {});
  assert.deepEqual(plain(result.envelope.archives[48].ties), { energy: 1, information: -1 });
  assert.equal(result.envelope.archives[48].tieIndex, 2);
  saved.phase = 'done'; saved.ties = Object.fromEntries(D.axes.map((axis, i) => [axis.id, i % 2 ? -1 : 1]));
  result = migrate(saved, 2);
  assert.equal(result.envelope.sessions[48].full, null);
  assert.equal(result.envelope.archives[48].phase, 'done');
  assert.deepEqual(plain(result.envelope.archives[48].ties), saved.ties);
});

test('completed directional v2 exploration retains only relevant binary ties in its archive', () => {
  const saved = legacy({ phase: 'done', questionIndex: 47 });
  saved.answers = allAnswers(saved, q => q.direction * 2); saved.ties = Object.fromEntries(D.axes.map(axis => [axis.id, -1]));
  const result = migrate(saved, 2), archived = result.envelope.archives[48];
  assert.equal(archived.phase, 'done'); assert.deepEqual(plain(archived.answers), saved.answers);
  assert.deepEqual(plain(archived.ties), {}); assert.equal(archived.scoringVersion, Core.VERSION);
  assert.equal(result.envelope.sessions[48].full, null);
});

test('incomplete old done records downgrade before import and safely clamp indexes', () => {
  const saved = legacy({ phase: 'done', questionIndex: 900, tieIndex: -4 });
  let result = migrate(saved, 2);
  assert.equal(result.envelope.sessions[48].phase, 'quiz'); assert.equal(result.envelope.sessions[48].questionIndex, 47);
  assert.equal(result.envelope.archives[48].tieIndex, 0);
  saved.answers = allAnswers(saved); saved.tieIndex = 900;
  result = migrate(saved, 2);
  assert.equal(result.envelope.archives[48].phase, 'ties'); assert.equal(result.envelope.archives[48].tieIndex, 5);
  assert.equal(result.envelope.sessions[48].phase, 'quiz');
  saved.phase = 'ties'; delete saved.answers[saved.questionIds[0]];
  assert.equal(migrate(saved, 2).envelope.archives[48].phase, 'quiz');
});

test('invalid v2 JSON, versions and forms never write a migrated v5 record', () => {
  const invalid = ['{', JSON.stringify(legacy({ version: 1 })), JSON.stringify(legacy({ bankVersion: 'obsolete' })),
    JSON.stringify(legacy({ scoringVersion: 'obsolete' })), JSON.stringify(legacy({ questionIds: [] })),
    JSON.stringify(legacy({ questionIds: Array(48).fill('QB000001') })), JSON.stringify(legacy({ questionIds: Array(48).fill('bad-id') }))];
  for (const raw of invalid) {
    const storage = memory({ [Sessions.LEGACY_KEY]: raw }), result = Sessions.load(storage);
    assert.equal(result.storageAvailable, true); assert.equal(result.envelope.activeMode, 10);
    assert.equal(result.envelope.sessions[48].started, false); assert.equal(result.envelope.migratedLegacy, false);
    assert.equal(storage.entries.has(Sessions.KEY), false); assert.equal(storage.entries.get(Sessions.LEGACY_KEY), raw);
  }
});

test('a corrupt or incompatible v5 value never reimports any backup', () => {
  for (const raw of ['{', JSON.stringify({ version: 4 })]) {
    const storage = memory({ [Sessions.KEY]: raw, [Sessions.PREVIOUS_KEY]: JSON.stringify(previousEnvelope(4)),
      [Sessions.OLDER_KEY]: JSON.stringify(previousEnvelope()), [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
    const result = Sessions.load(storage);
    assert.equal(result.storageAvailable, true); assert.equal(result.envelope.activeMode, 10);
    assert.equal(result.envelope.sessions[48].started, false); assert.equal(storage.writes.length, 0);
    assert.deepEqual(storage.reads, [Sessions.KEY]);
  }
});

test('v5 corruption in one mode preserves other sessions and all archives during load and save', () => {
  const saved = envelope();
  saved.sessions[10] = shortState(10); saved.sessions[20] = shortState(20); saved.sessions[48] = full();
  saved.archives[10] = binaryState(10, 10); saved.archives[20] = binaryState(20, 7); saved.archives[48] = oldFull();
  saved.sessions[20].short.questionIds[0] = 'bad-id'; saved.activeMode = 20;
  const storage = memory(), result = Sessions.save(storage, saved);
  assert.ok(result.message); assert.equal(result.envelope.activeMode, 20); assert.equal(result.envelope.sessions[20].short, null);
  assert.deepEqual(plain(result.envelope.sessions[10]), saved.sessions[10]); assert.deepEqual(plain(result.envelope.sessions[48]), saved.sessions[48]);
  assert.deepEqual(plain(result.envelope.archives), plain(saved.archives));
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
});

test('a corrupt archive is isolated without losing current progress or other archives', () => {
  const saved = envelope(); saved.sessions[10] = shortState(10, 5); saved.sessions[48] = full({ questionIndex: 17 });
  saved.archives[10] = binaryState(10, 10); saved.archives[20] = binaryState(20, 20); saved.archives[48] = oldFull();
  saved.archives[20].short.questionIds[0] = 'bad-id';
  const storage = memory(), result = Sessions.save(storage, saved);
  assert.ok(result.message); assert.deepEqual(plain(result.envelope.sessions), plain(saved.sessions));
  assert.deepEqual(plain(result.envelope.archives[10]), saved.archives[10]); assert.equal(result.envelope.archives[20], null);
  assert.deepEqual(plain(result.envelope.archives[48]), saved.archives[48]);
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
});

test('mode selection is pure and keeps question IDs, answers, indexes and archives', () => {
  const original = envelope(); original.sessions[10] = shortState(10); original.sessions[20] = shortState(20, 7);
  original.sessions[48] = full({ questionIndex: 12 }); original.archives[48] = oldFull();
  const before = plain(original); let selected = original;
  for (const mode of [20, 48, 10, 48, 20]) selected = Sessions.select(selected, mode);
  assert.equal(selected.activeMode, 20); assert.equal(selected.preferredMode, 10);
  assert.deepEqual(plain(selected.sessions), before.sessions); assert.deepEqual(plain(selected.archives), before.archives);
  assert.deepEqual(plain(original), before);
});

test('short reload retains review position, clamps unreachable indexes and validates its nested session', () => {
  const saved = envelope(); saved.sessions[10] = shortState(10, 6); saved.sessions[10].questionIndex = 2;
  saved.sessions[20] = shortState(20, 2); saved.sessions[20].questionIndex = 99; saved.sessions[20].phase = 'done';
  const storage = memory(), result = Sessions.save(storage, saved);
  assert.equal(result.envelope.sessions[10].questionIndex, 2); assert.equal(result.envelope.sessions[20].questionIndex, 2);
  assert.equal(result.envelope.sessions[20].phase, 'quiz'); assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
  saved.sessions[10].short.mode = 20; assert.equal(Sessions.save(storage, saved).envelope.sessions[10].short, null);
});

test('finished unclassified short five-point records remain done after clarification and reload', () => {
  const saved = envelope();
  for (const mode of [10, 20]) {
    let session = Short.create(mode, 77);
    while (!Short.score(session).finished) session = Short.answer(session, session.answers.length, 0);
    assert.equal(session.answers.length, mode + 6); assert.equal(Short.score(session).complete, false);
    saved.sessions[mode] = Object.assign(plain(Sessions.blank(mode)), { started: true, phase: 'done', questionIndex: 999, short: plain(session) });
  }
  const storage = memory(), result = Sessions.save(storage, saved);
  assert.equal(result.message, '');
  for (const mode of [10, 20]) {
    const state = result.envelope.sessions[mode]; assert.equal(state.phase, 'done'); assert.equal(state.questionIndex, mode + 5);
    assert.equal(state.short.answers.length, mode + 6); assert.equal(state.short.questionIds.length, mode + 6);
    assert.deepEqual(Object.keys(state.short).sort(), ['answers', 'bankVersion', 'mode', 'questionIds', 'seed', 'version'].sort());
  }
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
  let unfinished = Short.create(10, 77);
  for (let i = 0; i < 15; i++) unfinished = Short.answer(unfinished, i, 0);
  saved.sessions[10].short = plain(unfinished); assert.equal(Sessions.save(memory(), saved).envelope.sessions[10].phase, 'quiz');
});

test('clearing one mode retains other sessions, every archive and all backups', () => {
  const saved = envelope(); saved.sessions[10] = shortState(10); saved.sessions[20] = shortState(20); saved.sessions[48] = full();
  saved.archives[10] = binaryState(10, 10); saved.archives[20] = binaryState(20); saved.archives[48] = oldFull(); saved.migratedLegacy = true;
  const before = plain(saved), storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()),
    [Sessions.PREVIOUS_KEY]: JSON.stringify(previousEnvelope(4)), [Sessions.OLDER_KEY]: JSON.stringify(previousEnvelope()) });
  const cleared = Sessions.clear(storage, saved, 10);
  assert.equal(cleared.storageAvailable, true); assert.deepEqual(plain(cleared.envelope.sessions[10]), plain(Sessions.blank(10)));
  assert.deepEqual(plain(cleared.envelope.sessions[20]), before.sessions[20]); assert.deepEqual(plain(cleared.envelope.sessions[48]), before.sessions[48]);
  assert.deepEqual(plain(cleared.envelope.archives), before.archives); assert.deepEqual(plain(saved), before);
  for (const key of [Sessions.PREVIOUS_KEY, Sessions.OLDER_KEY, Sessions.LEGACY_KEY]) assert.equal(storage.entries.has(key), true);
  assert.equal(Sessions.load(storage).envelope.sessions[10].started, false); assert.deepEqual(storage.removals, []);
});

test('clearing 48 mode prevents reimport and preserves its readonly archive', () => {
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) }), loaded = Sessions.load(storage);
  const cleared = Sessions.clear(storage, loaded.envelope, 48);
  assert.equal(cleared.envelope.sessions[48].full, null); assert.equal(storage.entries.has(Sessions.LEGACY_KEY), true);
  assert.equal(Sessions.load(storage).envelope.sessions[48].started, false); assert.equal(Sessions.load(storage).envelope.migratedLegacy, true);
  assert.deepEqual(plain(cleared.envelope.archives), plain(loaded.envelope.archives));
});

test('clearing all saves a durable reset marker and removes all archives and v2/v3/v4 backups', () => {
  const old = previousEnvelope(4); old.sessions[10] = shortState(10); old.sessions[48] = oldFull(); old.archives[10] = binaryState(10, 10);
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()), [Sessions.OLDER_KEY]: JSON.stringify(previousEnvelope()), [Sessions.PREVIOUS_KEY]: JSON.stringify(old) });
  const cleared = Sessions.clear(storage, Sessions.load(storage).envelope);
  assert.equal(cleared.storageAvailable, true); assert.equal(cleared.envelope.migratedLegacy, true);
  for (const key of [Sessions.LEGACY_KEY, Sessions.OLDER_KEY, Sessions.PREVIOUS_KEY]) assert.equal(storage.entries.has(key), false);
  assert.deepEqual(plain(cleared.envelope.archives), { 10: null, 20: null, 48: null });
  for (const mode of [10, 20, 48]) assert.deepEqual(plain(cleared.envelope.sessions[mode]), plain(Sessions.blank(mode)));
  storage.entries.set(Sessions.LEGACY_KEY, JSON.stringify(legacy())); storage.entries.set(Sessions.PREVIOUS_KEY, JSON.stringify(old));
  const reloaded = Sessions.load(storage);
  assert.equal(reloaded.envelope.sessions[48].started, false); assert.equal(reloaded.envelope.migratedLegacy, true);
  assert.deepEqual(plain(reloaded.envelope.archives), { 10: null, 20: null, 48: null });
});

test('save persists blank envelopes instead of leaving a previous exploration behind', () => {
  const storage = memory(), saved = envelope(); saved.sessions[48] = full(); Sessions.save(storage, saved);
  assert.equal(Sessions.save(storage, envelope()).storageAvailable, true);
  assert.equal(Sessions.load(storage).envelope.sessions[48].full, null); assert.equal(storage.writes.length, 2);
});

test('storage access, migration writes, writes and clears fail safely without losing in-memory progress', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('blocked'); } };
  assert.equal(Sessions.load(blocked).storageAvailable, false); assert.equal(Sessions.load(undefined).storageAvailable, false);
  const saved = envelope(); saved.sessions[48] = full({ questionIndex: 13 });
  const failed = Sessions.save(blocked, saved);
  assert.equal(failed.storageAvailable, false); assert.deepEqual(plain(failed.envelope.sessions[48]), saved.sessions[48]); assert.ok(failed.message);
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) }); storage.setItem = blocked.setItem;
  const migration = Sessions.load(storage);
  assert.equal(migration.storageAvailable, false); assert.equal(migration.envelope.activeMode, 48); assert.equal(migration.envelope.sessions[48].started, true);
  assert.equal(storage.entries.has(Sessions.LEGACY_KEY), true); assert.equal(storage.entries.has(Sessions.KEY), false);
  const cleared = Sessions.clear(blocked, saved);
  assert.equal(cleared.storageAvailable, false); assert.equal(cleared.envelope.migratedLegacy, true); assert.equal(cleared.envelope.sessions[48].started, false);
});

test('v3 migration and later storage failures retain validated archives and progress in memory', () => {
  const saved = previousEnvelope(); saved.sessions[10] = binaryState(10, 10); saved.sessions[20] = binaryState(20); saved.sessions[48] = oldFull({ questionIndex: 31 });
  const raw = JSON.stringify(saved), storage = memory({ [Sessions.OLDER_KEY]: raw }); storage.setItem = () => { throw Error('quota'); };
  const migrated = Sessions.load(storage);
  assert.equal(migrated.storageAvailable, false); assert.ok(migrated.message);
  assert.deepEqual(plain(migrated.envelope.archives), { 10: saved.sessions[10], 20: saved.sessions[20], 48: saved.sessions[48] });
  assertImported(migrated.envelope.sessions[48], saved.sessions[48]); assert.equal(storage.entries.get(Sessions.OLDER_KEY), raw); assert.equal(storage.entries.has(Sessions.KEY), false);
  migrated.envelope.sessions[10] = shortState(10, 2);
  const failed = Sessions.save(undefined, migrated.envelope);
  assert.equal(failed.storageAvailable, false); assert.deepEqual(plain(failed.envelope), plain(migrated.envelope));
  const cleared = Sessions.clear(undefined, migrated.envelope, 10);
  assert.equal(cleared.storageAvailable, false); assert.equal(cleared.envelope.sessions[10].short, null);
  assert.deepEqual(plain(cleared.envelope.archives), plain(migrated.envelope.archives));
});

test('unreadable backup storage blocks fallback and failed backup removal still keeps a v5 reset', () => {
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) }); const getItem = storage.getItem.bind(storage);
  storage.getItem = key => { if (key === Sessions.OLDER_KEY) { storage.reads.push(key); throw Error('blocked'); } return getItem(key); };
  const result = Sessions.load(storage);
  assert.equal(result.storageAvailable, false); assert.deepEqual(storage.reads, [Sessions.KEY, Sessions.PREVIOUS_KEY, Sessions.OLDER_KEY]);
  assert.equal(result.envelope.sessions[48].started, false);
  storage.removeItem = () => { throw Error('blocked'); };
  const cleared = Sessions.clear(storage, envelope());
  assert.equal(cleared.storageAvailable, false); assert.equal(storage.entries.has(Sessions.KEY), true);
  assert.equal(Sessions.load(storage).envelope.migratedLegacy, true); assert.equal(Sessions.load(storage).envelope.sessions[48].started, false);
});

test('v4 migration preserves five-point short progress and existing binary archives', () => {
  const saved = previousEnvelope(4); saved.sessions[10] = shortState(10, 7); saved.sessions[10].questionIndex = 2;
  saved.sessions[20] = shortState(20, 16); saved.archives[10] = binaryState(10, 10); saved.archives[20] = binaryState(20, 8);
  const result = migrate(saved);
  assert.deepEqual(plain(result.envelope.sessions[10]), saved.sessions[10]); assert.deepEqual(plain(result.envelope.sessions[20]), saved.sessions[20]);
  assert.deepEqual(plain(result.envelope.archives), { ...saved.archives, 48: null }); assert.equal(result.message.includes('無法'), false);
});

test('v4 finished unclassified short reports stay done during migration', () => {
  const saved = previousEnvelope(4);
  for (const mode of [10, 20]) {
    let session = Short.create(mode, 77);
    while (!Short.score(session).finished) session = Short.answer(session, session.answers.length, 0);
    saved.sessions[mode] = Object.assign(plain(Sessions.blank(mode)), {
      started: true, phase: 'done', questionIndex: mode + 5, short: plain(session)
    });
  }
  const result = migrate(saved);
  for (const mode of [10, 20]) {
    assert.equal(Short.score(result.envelope.sessions[mode].short).complete, false);
    assert.deepEqual(plain(result.envelope.sessions[mode]), saved.sessions[mode]);
  }
});

test('v4 completed neutral and directional full results are archived while new full slots stay blank', () => {
  for (const neutral of [false, true]) {
    const saved = previousEnvelope(4); saved.sessions[48] = oldFull({ phase: 'done', questionIndex: 47, tieIndex: neutral ? 5 : 0 });
    saved.sessions[48].answers = allAnswers(saved.sessions[48], neutral ? 0 : q => q.direction * 2);
    if (neutral) saved.sessions[48].ties = Object.fromEntries(D.axes.map((axis, i) => [axis.id, i % 2 ? -1 : 1]));
    const result = migrate(saved);
    assert.deepEqual(plain(result.envelope.sessions[48]), plain(Sessions.blank(48)));
    assert.deepEqual(plain(result.envelope.archives[48]), saved.sessions[48]);
    const storage = memory(); Sessions.save(storage, result.envelope);
    assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
  }
});

test('v4 unfinished full forms preserve holes, later answers and review index without importing binary ties', () => {
  const saved = previousEnvelope(4); saved.sessions[48] = oldFull({ questionIndex: 35 });
  const old = saved.sessions[48]; old.answers = { [old.questionIds[0]]: 0, [old.questionIds[17]]: -2, [old.questionIds[47]]: 1 };
  old.ties = { energy: 1 };
  const result = migrate(saved);
  assertImported(result.envelope.sessions[48], old); assert.equal(Object.hasOwn(result.envelope.sessions[48].full.answers, old.questionIds[1]), false);
  assert.deepEqual(plain(result.envelope.archives[48].ties), {});
  const storage = memory(); Sessions.save(storage, result.envelope);
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
});

test('v4 unfinished binary clarification choices are retained only in the old full archive', () => {
  const saved = previousEnvelope(4);
  saved.sessions[48] = oldFull({ phase: 'ties', questionIndex: 47, tieIndex: 3 });
  saved.sessions[48].answers = allAnswers(saved.sessions[48]);
  saved.sessions[48].ties = { energy: -1, information: 1 };
  const result = migrate(saved);
  assertImported(result.envelope.sessions[48], saved.sessions[48]);
  assert.equal(result.envelope.sessions[48].full.clarificationIds.length, 6);
  assert.deepEqual(plain(result.envelope.archives[48]), saved.sessions[48]);
  assert.equal(Full.score(result.envelope.sessions[48].full).finished, false);
});

test('v4 corruption is isolated and a corrupt v4 value takes precedence over valid v3 and v2', () => {
  const saved = previousEnvelope(4); saved.sessions[10] = shortState(10); saved.sessions[20] = shortState(20);
  saved.sessions[48] = oldFull({ bankVersion: 'obsolete' }); saved.archives[10] = binaryState(10);
  const result = migrate(saved);
  assert.ok(result.message); assert.equal(result.envelope.sessions[48].full, null); assert.equal(result.envelope.archives[48], null);
  assert.deepEqual(plain(result.envelope.sessions[10]), saved.sessions[10]); assert.deepEqual(plain(result.envelope.archives[10]), saved.archives[10]);
  const storage = memory({ [Sessions.PREVIOUS_KEY]: '{', [Sessions.OLDER_KEY]: JSON.stringify(previousEnvelope()), [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  assert.ok(Sessions.load(storage).message); assert.deepEqual(storage.reads, [Sessions.KEY, Sessions.PREVIOUS_KEY]); assert.deepEqual(storage.writes, []);
});

test('new all-neutral full sessions stay done when finished but unclassified after save and reload', () => {
  let session = Full.create(41);
  for (const id of session.questionIds) session = Full.answer(session, id, 0);
  assert.equal(Full.score(session).finished, false);
  for (const q of Full.questions(session).filter(q => q.isClarification)) session = Full.answer(session, q.id, 0);
  assert.equal(Full.score(session).finished, true); assert.equal(Full.score(session).complete, false);
  const saved = envelope(); saved.sessions[48] = full({ phase: 'done', questionIndex: 999, full: plain(session) });
  const storage = memory(), result = Sessions.save(storage, saved);
  assert.equal(result.message, ''); assert.equal(result.envelope.sessions[48].phase, 'done');
  assert.equal(result.envelope.sessions[48].questionIndex, Full.questions(session).length - 1);
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
  delete saved.sessions[48].full.clarificationAnswers[saved.sessions[48].full.clarificationIds[0]];
  assert.equal(Sessions.save(memory(), saved).envelope.sessions[48].phase, 'quiz');
});

test('new full restore retains answer holes and isolates a malformed full slot from every other slot', () => {
  let session = Full.create(8); session = Full.answer(session, session.questionIds[47], -2);
  const saved = envelope(); saved.sessions[10] = shortState(10); saved.sessions[48] = full({ full: plain(session), questionIndex: 47 });
  saved.archives[48] = oldFull();
  const storage = memory(); const result = Sessions.save(storage, saved);
  assert.deepEqual(plain(result.envelope.sessions[48]), saved.sessions[48]);
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(result.envelope));
  saved.sessions[48].full.questionIds[0] = 'bad-id'; const invalid = Sessions.save(memory(), saved);
  assert.equal(invalid.envelope.sessions[48].full, null); assert.ok(invalid.message);
  assert.deepEqual(plain(invalid.envelope.sessions[10]), saved.sessions[10]); assert.deepEqual(plain(invalid.envelope.archives[48]), saved.archives[48]);
});

test('a malformed old full archive cannot discard the new full session or short archives', () => {
  const saved = envelope(); saved.sessions[48] = full(); saved.archives[10] = binaryState(10, 10);
  saved.archives[48] = oldFull({ scoringVersion: 'obsolete' });
  const result = Sessions.save(memory(), saved);
  assert.ok(result.message); assert.equal(result.envelope.archives[48], null);
  assert.deepEqual(plain(result.envelope.sessions[48]), saved.sessions[48]);
  assert.deepEqual(plain(result.envelope.archives[10]), saved.archives[10]);
});

test('QA namespaces isolate normal records, legacy imports, reloads and clear operations', () => {
  const normal = envelope(); normal.sessions[10] = shortState(10); normal.sessions[48] = full(); normal.archives[48] = oldFull();
  const storage = memory({ [Sessions.KEY]: JSON.stringify(normal), [Sessions.PREVIOUS_KEY]: JSON.stringify(previousEnvelope(4)),
    [Sessions.OLDER_KEY]: JSON.stringify(previousEnvelope()), [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  const before = Array.from(storage.entries), qa = Sessions.createNamespace(storage, 'matrix_48-1'), other = Sessions.createNamespace(storage, 'matrix_48-2');
  const initial = Sessions.load(qa);
  assert.equal(initial.envelope.migratedLegacy, false); assert.deepEqual(plain(initial.envelope), plain(envelope()));
  for (const key of storage.reads) assert.ok(key.startsWith('guajian-self.qa.matrix_48-1.'));
  const qaSaved = envelope(); qaSaved.sessions[20] = shortState(20, 8); qaSaved.sessions[48] = full({ questionIndex: 31 });
  Sessions.save(qa, qaSaved);
  assert.deepEqual(plain(Sessions.load(qa).envelope), plain(qaSaved));
  assert.equal(Sessions.load(other).envelope.sessions[20].short, null);
  assert.deepEqual(plain(Sessions.load(storage).envelope), plain(normal));
  for (const [key, value] of before) assert.equal(storage.entries.get(key), value);
  Sessions.clear(qa, qaSaved, 48);
  assert.equal(Sessions.load(qa).envelope.sessions[48].full, null); assert.deepEqual(plain(Sessions.load(qa).envelope.sessions[20]), qaSaved.sessions[20]);
  Sessions.clear(qa, qaSaved);
  assert.equal(Sessions.load(qa).envelope.migratedLegacy, true);
  for (const [key, value] of before) assert.equal(storage.entries.get(key), value);
  for (const key of [...storage.writes, ...storage.removals]) assert.ok(key.startsWith('guajian-self.qa.matrix_48-1.'));
});

test('QA imports only its own prefixed backup and its reset marker blocks reimport', () => {
  const old = previousEnvelope(4); old.sessions[48] = oldFull({ questionIndex: 19 });
  const storage = memory({ [Sessions.LEGACY_KEY]: JSON.stringify(legacy()) });
  const qa = Sessions.createNamespace(storage, 'legacy'); qa.setItem(Sessions.PREVIOUS_KEY, JSON.stringify(old));
  const result = Sessions.load(qa); assertImported(result.envelope.sessions[48], old.sessions[48]);
  const normalLegacy = storage.entries.get(Sessions.LEGACY_KEY); Sessions.clear(qa, result.envelope);
  qa.setItem(Sessions.PREVIOUS_KEY, JSON.stringify(old));
  assert.equal(Sessions.load(qa).envelope.sessions[48].full, null); assert.equal(storage.entries.get(Sessions.LEGACY_KEY), normalLegacy);
});

test('namespace validation rejects ambiguous or unsafe prefixes', () => {
  for (const value of ['', '../normal', 'a.b', 'a b', '測試', 'a'.repeat(65), null, 48]) {
    assert.throws(() => Sessions.createNamespace(memory(), value), /namespace/);
  }
});
