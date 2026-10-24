(function (global) {
  'use strict';
  var D = global.GuaData;
  var Core = global.GuaCore;
  var Bank = global.GuaBank;
  if (!D || !Core || !Bank) throw new Error('Question data, core.js and bank.js must load before sessions.js.');
  var VERSION = 5;
  var KEY = 'guajian-self.session.v5';
  var PREVIOUS_KEY = 'guajian-self.session.v4';
  var OLDER_KEY = 'guajian-self.session.v3';
  var LEGACY_KEY = 'guajian-self.session.v2';
  var MODES = [10, 20, 48];
  var UNAVAILABLE = '此瀏覽器暫時無法保存進度，你仍可完成本次探索。';
  var INVALID = '部分儲存紀錄無法讀取，該版本已重新開始；其他版本的進度仍保留。';
  var MIGRATED = '已保留原有進度；舊版結果與二選一澄清紀錄已封存為唯讀。';
  var own = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function modeNumber(value) { var mode = Number(value); return MODES.indexOf(mode) >= 0 ? mode : 10; }
  function index(value, maximum) {
    var n = Number(value);
    return Math.max(0, Math.min(maximum, Number.isInteger(n) ? n : 0));
  }
  function blank(mode) {
    mode = modeNumber(mode);
    var state = { mode: mode, started: false, phase: 'intro', questionIndex: 0, tieIndex: 0 };
    if (mode === 48) state.full = null;
    else state.short = null;
    return state;
  }
  function freshEnvelope() {
    return { version: VERSION, activeMode: 10, preferredMode: 10, migratedLegacy: false,
      sessions: { '10': blank(10), '20': blank(20), '48': blank(48) },
      archives: { '10': null, '20': null, '48': null } };
  }
  function phase(value, started) {
    return ['intro', 'quiz', 'ties', 'done'].indexOf(value) >= 0 ? value : (started ? 'quiz' : 'intro');
  }
  function validAnswer(value) { return Number.isInteger(value) && value >= -2 && value <= 2; }
  // Archived full sessions retain the original validation and binary-tie rules.
  function restoreLegacyFull(saved, standalone) {
    saved = object(saved);
    if (saved.version !== 2 || saved.bankVersion !== (D.bank && D.bank.version) || saved.scoringVersion !== Core.VERSION) throw new Error('Incompatible legacy full session.');
    if (!standalone && saved.mode !== undefined && Number(saved.mode) !== 48) throw new Error('Incorrect legacy session mode.');
    if (!standalone && Array.isArray(saved.questionIds) && saved.questionIds.length === 0 && saved.started !== true) return null;
    var form = Bank.restoreForm(saved.questionIds);
    var result = { mode: 48, started: saved.started === true, phase: phase(saved.phase, saved.started === true),
      questionIndex: index(saved.questionIndex, 47), tieIndex: index(saved.tieIndex, 5), version: 2,
      bankVersion: D.bank && D.bank.version, scoringVersion: Core.VERSION,
      questionIds: form.map(function (question) { return question.id; }), answers: {}, ties: {} };
    var answers = object(saved.answers);
    var totals = {};
    D.axes.forEach(function (axis) { totals[axis.id] = { sum: 0, answered: 0, total: 0 }; });
    form.forEach(function (question) {
      var axis = totals[question.axis];
      axis.total++;
      if (own(answers, question.id) && validAnswer(answers[question.id])) {
        result.answers[question.id] = answers[question.id];
        axis.answered++;
        axis.sum += answers[question.id] * question.direction;
      }
    });
    var ties = object(saved.ties);
    var tieAxes = [];
    var unresolved = [];
    var answered = Object.keys(result.answers).length;
    D.axes.forEach(function (axis) {
      var total = totals[axis.id];
      if (total.answered === total.total && total.sum === 0) {
        tieAxes.push(axis.id);
        if (own(ties, axis.id) && (ties[axis.id] === 1 || ties[axis.id] === -1)) result.ties[axis.id] = ties[axis.id];
        else unresolved.push(axis.id);
      }
    });
    result.tieIndex = index(result.tieIndex, Math.max(0, tieAxes.length - 1));
    if (result.phase === 'done' && (answered !== 48 || unresolved.length)) result.phase = answered === 48 ? 'ties' : 'quiz';
    if (result.phase === 'ties' && answered !== 48) result.phase = 'quiz';
    return result;
  }
  function restoreFull(saved) {
    saved = object(saved);
    if (saved.mode !== undefined && Number(saved.mode) !== 48) throw new Error('Incorrect session mode.');
    var result = blank(48);
    if (saved.full === null && saved.started !== true) return result;
    var engine = global.GuaFull;
    if (!engine || typeof engine.restore !== 'function' || typeof engine.score !== 'function') throw new Error('Full engine unavailable.');
    var restored = engine.restore(saved.full);
    if (restored.mode !== 48) throw new Error('Incorrect full session mode.');
    result.full = restored;
    result.started = saved.started === true;
    result.phase = phase(saved.phase, result.started);
    result.questionIndex = index(saved.questionIndex, Math.max(0, engine.questions(restored).length - 1));
    if (result.phase === 'ties' || (result.phase === 'done' && !engine.score(restored).finished)) result.phase = 'quiz';
    return result;
  }
  function restoreShort(saved, mode, legacy) {
    saved = object(saved);
    if (saved.mode !== undefined && Number(saved.mode) !== mode) throw new Error('Incorrect session mode.');
    var result = blank(mode);
    if (saved.short === null && saved.started !== true) return result;
    var engine = legacy ? global.GuaShortLegacy : global.GuaShort;
    if (!engine || typeof engine.restore !== 'function' || typeof engine.score !== 'function') throw new Error('Short engine unavailable.');
    var restored = engine.restore(saved.short);
    if (restored.mode !== mode) throw new Error('Incorrect short session mode.');
    result.short = restored;
    result.started = saved.started === true;
    result.phase = phase(saved.phase, result.started);
    result.questionIndex = index(saved.questionIndex, Math.max(0, restored.questionIds.length - 1));
    var finished = legacy ? engine.score(restored).complete : engine.score(restored).finished;
    if (result.phase === 'ties' || (result.phase === 'done' && !finished)) result.phase = 'quiz';
    return result;
  }
  function restoreArchive(saved, mode) {
    if (saved === null) return null;
    if (mode === 48) return restoreLegacyFull(saved, false);
    var restored = restoreShort(saved, mode, true);
    return restored.short === null ? null : restored;
  }
  function restoreEnvelope(saved) {
    saved = object(saved);
    if (saved.version !== VERSION) throw new Error('Incompatible storage envelope.');
    var result = freshEnvelope();
    result.activeMode = modeNumber(saved.activeMode);
    result.preferredMode = Number(saved.preferredMode) === 20 ? 20 : 10;
    result.migratedLegacy = saved.migratedLegacy === true;
    var sessions = object(saved.sessions);
    var invalid = false;
    MODES.forEach(function (mode) {
      try {
        if (!own(sessions, String(mode))) throw new Error('Missing session.');
        result.sessions[mode] = mode === 48 ? restoreFull(sessions[mode]) : restoreShort(sessions[mode], mode, false);
      } catch (_) { invalid = true; }
    });
    var archives = object(saved.archives);
    MODES.forEach(function (mode) {
      try {
        if (!own(archives, String(mode))) throw new Error('Missing archive.');
        result.archives[mode] = restoreArchive(archives[mode], mode);
      } catch (_) { invalid = true; }
    });
    return { envelope: result, invalid: invalid };
  }
  function importFull(result, saved, standalone) {
    var archived = restoreLegacyFull(saved, standalone);
    result.archives[48] = archived;
    if (!archived || archived.phase === 'done') return;
    var engine = global.GuaFull;
    if (!engine || typeof engine.importLegacy !== 'function') throw new Error('Full engine unavailable.');
    var state = blank(48);
    state.full = engine.importLegacy(archived.questionIds, archived.answers);
    state.started = archived.started;
    state.phase = archived.phase === 'intro' ? 'intro' : 'quiz';
    state.questionIndex = archived.questionIndex;
    // Old binary choices remain only in archives[48], with no intensity mapping.
    result.sessions[48] = restoreFull(state);
  }
  function migratePrevious(saved, version) {
    saved = object(saved);
    if (saved.version !== version) throw new Error('Incompatible previous envelope.');
    var result = freshEnvelope();
    result.activeMode = modeNumber(saved.activeMode);
    result.preferredMode = Number(saved.preferredMode) === 20 ? 20 : 10;
    result.migratedLegacy = true;
    var sessions = object(saved.sessions);
    var invalid = false;
    MODES.forEach(function (mode) {
      try {
        if (!own(sessions, String(mode))) throw new Error('Missing previous session.');
        if (mode === 48) importFull(result, sessions[48], false);
        else if (version === 4) result.sessions[mode] = restoreShort(sessions[mode], mode, false);
        else result.archives[mode] = restoreArchive(sessions[mode], mode);
      } catch (_) { invalid = true; }
    });
    if (version === 4) {
      var archives = object(saved.archives);
      [10, 20].forEach(function (mode) {
        try {
          if (!own(archives, String(mode))) throw new Error('Missing previous archive.');
          result.archives[mode] = restoreArchive(archives[mode], mode);
        } catch (_) { invalid = true; }
      });
    }
    return { envelope: result, invalid: invalid };
  }
  function outcome(envelope, storageAvailable, message) {
    return { envelope: envelope, storageAvailable: storageAvailable, message: message || '' };
  }
  function load(storage) {
    var envelope = freshEnvelope();
    var current;
    try { current = storage.getItem(KEY); }
    catch (_) { return outcome(envelope, false, UNAVAILABLE); }
    // Any current value, including a reset or corrupt value, blocks backup import.
    if (current !== null && current !== undefined) {
      try {
        var restored = restoreEnvelope(JSON.parse(current));
        return outcome(restored.envelope, true, restored.invalid ? INVALID : '');
      } catch (_) { return outcome(envelope, true, INVALID); }
    }
    var backups = [{ key: PREVIOUS_KEY, version: 4 }, { key: OLDER_KEY, version: 3 }, { key: LEGACY_KEY, version: 2 }];
    for (var i = 0; i < backups.length; i++) {
      var backup = backups[i];
      var raw;
      try { raw = storage.getItem(backup.key); }
      catch (_) { return outcome(envelope, false, UNAVAILABLE); }
      if (raw === null || raw === undefined) continue;
      var migrated;
      try {
        var parsed = JSON.parse(raw);
        if (backup.version === 2) {
          importFull(envelope, parsed, true);
          envelope.activeMode = 48;
          envelope.migratedLegacy = true;
          migrated = { envelope: envelope, invalid: false };
        } else migrated = migratePrevious(parsed, backup.version);
      } catch (_) { return outcome(freshEnvelope(), true, INVALID); }
      try { storage.setItem(KEY, JSON.stringify(migrated.envelope)); }
      catch (_) { return outcome(migrated.envelope, false, UNAVAILABLE); }
      return outcome(migrated.envelope, true, migrated.invalid ? INVALID : MIGRATED);
    }
    return outcome(envelope, true, '');
  }
  function save(storage, envelope) {
    var restored;
    try { restored = restoreEnvelope(envelope); }
    catch (_) { restored = { envelope: freshEnvelope(), invalid: true }; }
    try { storage.setItem(KEY, JSON.stringify(restored.envelope)); }
    catch (_) { return outcome(restored.envelope, false, UNAVAILABLE); }
    return outcome(restored.envelope, true, restored.invalid ? INVALID : '');
  }
  function clear(storage, envelope, mode) {
    var result;
    try { result = restoreEnvelope(envelope).envelope; }
    catch (_) { result = freshEnvelope(); }
    var all = mode === undefined || mode === null;
    if (all) {
      MODES.forEach(function (value) { result.sessions[value] = blank(value); });
      result.archives = { '10': null, '20': null, '48': null };
      result.migratedLegacy = true;
    } else result.sessions[modeNumber(mode)] = blank(mode);
    var saved = save(storage, result);
    if (all) {
      [PREVIOUS_KEY, OLDER_KEY, LEGACY_KEY].forEach(function (key) {
        try { storage.removeItem(key); }
        catch (_) { saved.storageAvailable = false; saved.message = UNAVAILABLE; }
      });
    }
    return saved;
  }
  function select(envelope, mode) {
    return Object.assign({}, envelope, { activeMode: modeNumber(mode) });
  }
  function createNamespace(storage, namespace) {
    if (typeof namespace !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(namespace)) throw new Error('Invalid storage namespace.');
    var prefix = 'guajian-self.qa.' + namespace + '.';
    // Legacy reads and clear-all removals also stay within this storage scope.
    return Object.freeze({
      getItem: function (key) { return storage.getItem(prefix + key); },
      setItem: function (key, value) { return storage.setItem(prefix + key, value); },
      removeItem: function (key) { return storage.removeItem(prefix + key); }
    });
  }
  global.GuaSessions = Object.freeze({ VERSION: VERSION, KEY: KEY, PREVIOUS_KEY: PREVIOUS_KEY, OLDER_KEY: OLDER_KEY, LEGACY_KEY: LEGACY_KEY,
    blank: blank, load: load, save: save, clear: clear, select: select, createNamespace: createNamespace });
})(window);
