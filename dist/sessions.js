(function (global) {
  'use strict';
  var D = global.GuaData;
  var Core = global.GuaCore;
  var Bank = global.GuaBank;
  if (!D || !Core || !Bank) throw new Error('Question data, core.js and bank.js must load before sessions.js.');
  var VERSION = 3;
  var KEY = 'guajian-self.session.v3';
  var LEGACY_KEY = 'guajian-self.session.v2';
  var MODES = [10, 20, 48];
  var UNAVAILABLE = '此瀏覽器暫時無法保存進度，你仍可完成本次探索。';
  var INVALID = '部分儲存紀錄無法讀取，該版本已重新開始；其他版本的進度仍保留。';
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function modeNumber(value) { var mode = Number(value); return MODES.indexOf(mode) >= 0 ? mode : 10; }
  function index(value, maximum) {
    var n = Number(value);
    return Math.max(0, Math.min(maximum, Number.isInteger(n) ? n : 0));
  }
  function blank(mode) {
    mode = modeNumber(mode);
    var state = { mode: mode, started: false, phase: 'intro', questionIndex: 0, tieIndex: 0 };
    if (mode === 48) {
      state.version = 2;
      state.bankVersion = D.bank && D.bank.version;
      state.scoringVersion = Core.VERSION;
      state.questionIds = [];
      state.answers = {};
      state.ties = {};
    } else state.short = null;
    return state;
  }
  function freshEnvelope() {
    return { version: VERSION, activeMode: 10, preferredMode: 10, migratedLegacy: false,
      sessions: { '10': blank(10), '20': blank(20), '48': blank(48) } };
  }
  function phase(value, started) {
    return ['intro', 'quiz', 'ties', 'done'].indexOf(value) >= 0 ? value : (started ? 'quiz' : 'intro');
  }
  function validAnswer(value) { return Number.isInteger(value) && value >= -2 && value <= 2; }
  function restoreFull(saved, legacy) {
    saved = object(saved);
    if (saved.version !== 2 || saved.bankVersion !== (D.bank && D.bank.version) || saved.scoringVersion !== Core.VERSION) throw new Error('Incompatible full session.');
    if (!legacy && saved.mode !== undefined && Number(saved.mode) !== 48) throw new Error('Incorrect session mode.');
    var result = blank(48);
    // A blank v3 slot is a real saved reset, and must remain blank after reload.
    if (!legacy && Array.isArray(saved.questionIds) && saved.questionIds.length === 0 && saved.started !== true) return result;
    var form = Bank.restoreForm(saved.questionIds);
    result.questionIds = form.map(function (question) { return question.id; });
    result.started = saved.started === true;
    result.phase = phase(saved.phase, result.started);
    result.questionIndex = index(saved.questionIndex, 47);
    result.tieIndex = index(saved.tieIndex, 5);
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
  function restoreShort(saved, mode) {
    saved = object(saved);
    if (saved.mode !== undefined && Number(saved.mode) !== mode) throw new Error('Incorrect session mode.');
    var result = blank(mode);
    if (saved.short === null && saved.started !== true) return result;
    if (!global.GuaShort || typeof global.GuaShort.restore !== 'function') throw new Error('Short engine unavailable.');
    var restored = global.GuaShort.restore(saved.short);
    if (restored.mode !== mode) throw new Error('Incorrect short session mode.');
    result.short = restored;
    result.started = saved.started === true;
    result.phase = phase(saved.phase, result.started);
    result.questionIndex = index(saved.questionIndex, Math.max(0, restored.questionIds.length - 1));
    if (result.phase === 'ties' || (result.phase === 'done' && !global.GuaShort.score(restored).complete)) result.phase = 'quiz';
    return result;
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
        result.sessions[mode] = mode === 48 ? restoreFull(sessions[mode], false) : restoreShort(sessions[mode], mode);
      } catch (_) { invalid = true; }
    });
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
    // Any v3 value takes precedence over the v2 backup, including a saved reset.
    if (current !== null && current !== undefined) {
      try {
        var restored = restoreEnvelope(JSON.parse(current));
        return outcome(restored.envelope, true, restored.invalid ? INVALID : '');
      } catch (_) { return outcome(envelope, true, INVALID); }
    }
    var legacy;
    try { legacy = storage.getItem(LEGACY_KEY); }
    catch (_) { return outcome(envelope, false, UNAVAILABLE); }
    if (legacy === null || legacy === undefined) return outcome(envelope, true, '');
    try { envelope.sessions[48] = restoreFull(JSON.parse(legacy), true); }
    catch (_) { return outcome(envelope, true, '舊版紀錄無法讀取或題庫規則已更新，請開始一份新的探索。'); }
    envelope.activeMode = 48;
    envelope.migratedLegacy = true;
    try { storage.setItem(KEY, JSON.stringify(envelope)); }
    catch (_) { return outcome(envelope, false, UNAVAILABLE); }
    return outcome(envelope, true, '已保留原本的 48 題與作答進度，可在資深版繼續探索。');
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
      result.migratedLegacy = true;
    } else result.sessions[modeNumber(mode)] = blank(mode);
    var saved = save(storage, result);
    if (all) {
      try { storage.removeItem(LEGACY_KEY); }
      catch (_) { saved.storageAvailable = false; saved.message = UNAVAILABLE; }
    }
    return saved;
  }
  function select(envelope, mode) {
    // Selecting an entry point never creates questions or changes another mode.
    return Object.assign({}, envelope, { activeMode: modeNumber(mode) });
  }
  global.GuaSessions = Object.freeze({ VERSION: VERSION, KEY: KEY, LEGACY_KEY: LEGACY_KEY,
    blank: blank, load: load, save: save, clear: clear, select: select });
})(window);
