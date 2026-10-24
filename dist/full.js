(function (global) {
  'use strict';
  var D = global.GuaData;
  var Bank = global.GuaBank;
  if (!D || !D.bank || !Array.isArray(D.axes) || !D.mapping || !Bank || typeof Bank.createForm !== 'function' || typeof Bank.restoreForm !== 'function' || typeof Bank.query !== 'function') {
    throw new Error('GuaFull requires question data, mapping data, and bank.js.');
  }
  var VERSION = '1.0.0';
  var MODE = 48;
  var fields = ['mode', 'seed', 'formOrigin', 'version', 'bankVersion', 'questionIds', 'answers', 'clarificationIds', 'clarificationAnswers'];
  var axisIds = D.axes.map(function (axis) { return axis.id; });
  var seedById = {};
  D.bank.seeds.forEach(function (item) { seedById[item.id] = item; });
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };

  function assert(condition, message) { if (!condition) throw new Error(message); }
  function isAnswer(value) { return typeof value === 'number' && Number.isInteger(value) && value >= -2 && value <= 2; }
  function isObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    if (prototype !== null && Object.getPrototypeOf(prototype) !== null) return false;
    if (Object.getOwnPropertySymbols(value).length) return false;
    return Object.getOwnPropertyNames(value).every(function (key) {
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor.enumerable && own(descriptor, 'value');
    });
  }
  function validateSeed(seed) { assert(Number.isInteger(seed) && seed >= 0 && seed <= 4294967295, '完整版測驗種子必須為 32 位元無號整數。'); }
  function denseArray(value) {
    if (!Array.isArray(value) || Object.keys(value).length !== value.length || Object.getOwnPropertyNames(value).length !== value.length + 1 || Object.getOwnPropertySymbols(value).length) return false;
    for (var i = 0; i < value.length; i++) {
      var descriptor = Object.getOwnPropertyDescriptor(value, i);
      if (!descriptor || !descriptor.enumerable || !own(descriptor, 'value')) return false;
    }
    return true;
  }
  function sameIds(left, right) { return left.length === right.length && left.every(function (id, index) { return id === right[index]; }); }
  function hash(text) {
    var state = 2166136261;
    for (var i = 0; i < text.length; i++) state = Math.imul(state ^ text.charCodeAt(i), 16777619) >>> 0;
    return state;
  }
  function legacySeed(ids) { return hash('full/legacy/' + ids.join('/')); }
  function randomFor(seed, ids, domain) {
    var state = hash('full/' + seed + '/' + ids.join('/') + '/' + domain);
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(values, random) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var temporary = result[i]; result[i] = result[j]; result[j] = temporary;
    }
    return result;
  }
  function itemById(id) {
    assert(typeof id === 'string' && /^QB\d{6}$/.test(id), '題庫編號格式無效。');
    var item = Bank.query({ offset: Number(id.slice(2)) - 1, limit: 1 }).items[0];
    assert(item && item.id === id, '題庫編號不存在。');
    return item;
  }
  function cleanAnswers(answers, ids, label) {
    assert(isObject(answers) && !Object.getOwnPropertySymbols(answers).length, label + '格式無效。');
    var allowed = new Set(ids);
    Object.keys(answers).forEach(function (id) { assert(allowed.has(id) && isAnswer(answers[id]), label + '含有未知題目或非 -2 至 2 整數的答案。'); });
    var result = {};
    ids.forEach(function (id) { if (own(answers, id)) { assert(isAnswer(answers[id]), label + '格式無效。'); result[id] = answers[id]; } });
    return result;
  }
  function mainSums(items, answers) {
    var sums = {};
    axisIds.forEach(function (axis) { sums[axis] = 0; });
    items.forEach(function (item) { if (own(answers, item.id)) sums[item.axis] += answers[item.id] * item.direction; });
    return sums;
  }
  // A tied axis gets one real five-point bank item. Domains include the fixed
  // main form, so replay does not depend on clocks or the order answers arrive.
  function clarificationItems(seed, ids, main, answers) {
    if (Object.keys(answers).length !== MODE) return [];
    var sums = mainSums(main, answers);
    var usedIds = new Set(main.map(function (item) { return item.id; }));
    var usedFamilies = new Set(main.map(function (item) { return item.family; }));
    var usedClusters = new Set(main.map(function (item) { return item.semanticCluster; }));
    return axisIds.filter(function (axis) { return sums[axis] === 0; }).map(function (axis) {
      var direction = randomFor(seed, ids, 'clarification-direction/' + axis)() < 0.5 ? -1 : 1;
      var bucket = D.bank.buckets.find(function (item) { return item.axis === axis && item.direction === direction; });
      assert(bucket, '題庫缺少所需的釐清題方向。');
      var random = randomFor(seed, ids, 'clarification-item/' + axis);
      var candidates = shuffle(bucket.seedIds.map(function (_, index) { return index; }), random);
      for (var i = 0; i < candidates.length; i++) {
        var seedIndex = candidates[i];
        var seedItem = seedById[bucket.seedIds[seedIndex]];
        var cluster = seedItem.semanticCluster || seedItem.family;
        if (usedFamilies.has(seedItem.family) || usedClusters.has(cluster)) continue;
        var contextCount = Math.floor((bucket.count - 1 - seedIndex) / bucket.seedIds.length) + 1;
        var contextIndex = Math.floor(random() * contextCount);
        var item = Bank.query({ offset: bucket.start - 1 + contextIndex * bucket.seedIds.length + seedIndex, limit: 1 }).items[0];
        if (!item || usedIds.has(item.id)) continue;
        usedIds.add(item.id); usedFamilies.add(item.family); usedClusters.add(item.semanticCluster);
        return item;
      }
      throw new Error('題庫沒有可用且語意不重複的釐清題。');
    });
  }
  function build(seed, origin, ids, answers, clarificationAnswers) {
    var main = Bank.restoreForm(ids);
    var cleaned = cleanAnswers(answers, ids, '完整版主題答案');
    var clarificationIds = clarificationItems(seed, ids, main, cleaned).map(function (item) { return item.id; });
    return {
      mode: MODE, seed: seed, formOrigin: origin, version: VERSION, bankVersion: D.bank.version,
      questionIds: ids.slice(), answers: cleaned, clarificationIds: clarificationIds,
      clarificationAnswers: cleanAnswers(clarificationAnswers, clarificationIds, '完整版釐清題答案')
    };
  }
  function create(seed) {
    validateSeed(seed);
    var ids = Bank.createForm(seed).map(function (item) { return item.id; });
    return build(seed, 'seed', ids, {}, {});
  }
  function restore(saved) {
    assert(isObject(saved), '完整版續答資料格式無效。');
    assert(!Object.getOwnPropertySymbols(saved).length && Object.keys(saved).length === fields.length && fields.every(function (field) { return own(saved, field); }), '完整版續答欄位無效。');
    assert(saved.mode === MODE && saved.version === VERSION && saved.bankVersion === D.bank.version, '完整版續答版本或題數不相容。');
    validateSeed(saved.seed);
    assert(saved.formOrigin === 'seed' || saved.formOrigin === 'legacy', '完整版組卷來源無效。');
    assert(denseArray(saved.questionIds) && denseArray(saved.clarificationIds), '完整版題目編號必須為連續陣列。');
    Bank.restoreForm(saved.questionIds);
    if (saved.formOrigin === 'seed') {
      assert(sameIds(saved.questionIds, Bank.createForm(saved.seed).map(function (item) { return item.id; })), '完整版題目與組卷種子不符。');
    } else {
      assert(saved.seed === legacySeed(saved.questionIds), '舊版完整版的衍生種子不符。');
    }
    var canonical = build(saved.seed, saved.formOrigin, saved.questionIds, saved.answers, saved.clarificationAnswers);
    assert(sameIds(saved.clarificationIds, canonical.clarificationIds), '完整版釐清題與主題答案不符。');
    return canonical;
  }
  function questions(session) {
    var canonical = restore(session);
    return Bank.restoreForm(canonical.questionIds).map(function (item) { item.isClarification = false; return item; }).concat(canonical.clarificationIds.map(function (id) {
      var item = itemById(id); item.isClarification = true; return item;
    }));
  }
  function answer(session, questionId, value) {
    var canonical = restore(session);
    assert(isAnswer(value), '完整版答案必須為 -2 至 2 的整數。');
    var isMain = canonical.questionIds.indexOf(questionId) >= 0;
    assert(isMain || canonical.clarificationIds.indexOf(questionId) >= 0, '完整版答題位置不存在。');
    var answers = isMain ? canonical.answers : canonical.clarificationAnswers;
    if (own(answers, questionId) && answers[questionId] === value) return canonical;
    answers[questionId] = value;
    // Every other main answer, including answers after a hole, remains intact.
    return build(canonical.seed, canonical.formOrigin, canonical.questionIds, canonical.answers, isMain ? {} : canonical.clarificationAnswers);
  }
  function importLegacy(questionIds, answersObject) {
    assert(denseArray(questionIds), '舊版完整版題目編號必須為連續陣列。');
    Bank.restoreForm(questionIds);
    return build(legacySeed(questionIds), 'legacy', questionIds, answersObject, {});
  }
  function score(session) {
    var canonical = restore(session);
    var items = Bank.restoreForm(canonical.questionIds).concat(canonical.clarificationIds.map(itemById));
    var collected = {};
    D.axes.forEach(function (axis) { collected[axis.id] = { sum: 0, mainSum: 0, clarificationSum: 0, answered: 0, mainCount: 0, clarificationCount: 0, total: 0, positive: false, negative: false }; });
    items.forEach(function (item, index) {
      var current = collected[item.axis];
      var isMain = index < MODE;
      var answers = isMain ? canonical.answers : canonical.clarificationAnswers;
      current.total += 1;
      current[isMain ? 'mainCount' : 'clarificationCount'] += 1;
      if (!own(answers, item.id)) return;
      var vote = answers[item.id] * item.direction;
      current.sum += vote;
      current[isMain ? 'mainSum' : 'clarificationSum'] += vote;
      current.answered += 1;
      if (vote !== 0) current[vote > 0 ? 'positive' : 'negative'] = true;
    });
    var mainAnswered = Object.keys(canonical.answers).length;
    var clarificationAnswered = Object.keys(canonical.clarificationAnswers).length;
    var ties = mainAnswered === MODE ? axisIds.filter(function (axis) { return collected[axis].mainSum === 0; }) : [];
    var total = MODE + ties.length;
    var answered = mainAnswered + clarificationAnswered;
    var finished = answered === total;
    var unresolvedTies = mainAnswered === MODE ? axisIds.filter(function (axis) { return collected[axis].sum === 0; }) : [];
    var scores = {};
    D.axes.forEach(function (axis) {
      var current = collected[axis.id];
      var side = finished && current.sum !== 0 ? (current.sum > 0 ? 'positive' : 'negative') : null;
      var endpoint = side ? axis[side] : null;
      scores[axis.id] = {
        sum: current.sum, mainSum: current.mainSum, clarificationSum: current.clarificationSum,
        mainCount: current.mainCount, clarificationCount: current.clarificationCount,
        answered: current.answered, total: current.total, maxAbs: 2 * current.total,
        normalized: current.total ? current.sum / (2 * current.total) : 0,
        nearMidpoint: current.total > 0 && Math.abs(current.sum / (2 * current.total)) <= 1 / 8,
        tied: mainAnswered === MODE && current.sum === 0, side: side,
        key: endpoint ? endpoint.key : null, label: endpoint ? endpoint.label : null,
        singleItem: current.total === 1, mixed: current.positive && current.negative
      };
    });
    var complete = finished && unresolvedTies.length === 0;
    var type = complete ? ['energy', 'information', 'decision', 'organization'].map(function (id) { return scores[id].key; }).join('') : null;
    var emotion = complete ? scores.emotion.key : null;
    var coordination = complete ? scores.coordination.key : null;
    var resultKey = complete ? type + '-' + emotion + '-' + coordination : null;
    var candidateHexagramIds = Object.keys(D.mapping).filter(function (key) {
      var parts = key.split('-');
      return D.axes.every(function (axis, index) {
        var known = scores[axis.id].key;
        var candidate = index < 4 ? parts[0].charAt(index) : (axis.id === 'emotion' ? parts[1] : parts[2]);
        return known === null || known === candidate;
      });
    }).map(function (key) { return D.mapping[key]; }).sort(function (a, b) { return a - b; });
    return {
      finished: finished, complete: complete, mainAnswered: mainAnswered,
      clarificationAnswered: clarificationAnswered, clarificationTotal: ties.length,
      answered: answered, total: total, scores: scores,
      resultKey: resultKey, hexagramId: resultKey ? D.mapping[resultKey] : null,
      type: type, emotion: emotion, coordination: coordination,
      ties: ties, unresolvedTies: unresolvedTies, candidateHexagramIds: candidateHexagramIds,
      allNeutral: finished && Object.keys(canonical.answers).every(function (id) { return canonical.answers[id] === 0; }) && Object.keys(canonical.clarificationAnswers).every(function (id) { return canonical.clarificationAnswers[id] === 0; }), mode: MODE
    };
  }
  global.GuaFull = Object.freeze({ VERSION: VERSION, create: create, questions: questions, answer: answer, restore: restore, score: score, importLegacy: importLegacy });
})(window);
