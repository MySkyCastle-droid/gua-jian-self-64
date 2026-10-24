(function (global) {
  'use strict';
  var D = global.GuaData;
  var Bank = global.GuaBank;
  if (!D || !D.bank || !Array.isArray(D.axes) || !D.mapping || !Bank || typeof Bank.query !== 'function') {
    throw new Error('GuaShort requires question data, mapping data, and bank.js.');
  }
  var VERSION = '1.0.0';
  var fields = ['mode', 'seed', 'version', 'bankVersion', 'questionIds', 'answers'];
  var axisIds = D.axes.map(function (axis) { return axis.id; });
  var seedById = {};
  D.bank.seeds.forEach(function (seed) { seedById[seed.id] = seed; });

  function assert(condition, message) { if (!condition) throw new Error(message); }
  function isAnswer(value) { return value === 1 || value === -1; }
  function validateOptions(mode, seed) {
    assert(mode === 10 || mode === 20, '短版測驗必須為 10 題或 20 題。');
    assert(Number.isInteger(seed) && seed >= 0 && seed <= 4294967295, '短版測驗種子必須為 32 位元無號整數。');
  }
  // Domain-separated deterministic streams keep axis order, polarity, and item
  // selection independent. The raw answer prefix is part of each item stream.
  function randomFor(seed, mode, domain) {
    var text = String(seed) + '/' + mode + '/' + domain;
    var state = 2166136261;
    for (var i = 0; i < text.length; i++) state = Math.imul(state ^ text.charCodeAt(i), 16777619) >>> 0;
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
  function planFor(mode, seed) {
    return {
      initialAxes: shuffle(axisIds, randomFor(seed, mode, 'initial-axes')),
      initialDirections: shuffle([1, 1, 1, -1, -1, -1], randomFor(seed, mode, 'initial-directions')),
      priority: shuffle(axisIds, randomFor(seed, mode, 'follow-up-priority'))
    };
  }
  function sumsThrough(items, answers, end) {
    var sums = {};
    axisIds.forEach(function (axis) { sums[axis] = 0; });
    for (var i = 0; i < end; i++) sums[items[i].axis] += answers[i] * items[i].direction;
    return sums;
  }
  function nextSlot(index, items, answers, plan) {
    if (index < 6) return { axis: plan.initialAxes[index], direction: plan.initialDirections[index] };
    var block = Math.floor((index - 6) / 2);
    var start = 6 + block * 2;
    var sums = sumsThrough(items, answers, start);
    var axis = plan.priority[block];
    if (block === 6) {
      // All six axes have exactly three answers at this point. Iteration in the
      // seeded priority order gives a stable tie break for equal |sum| / 3.
      axis = plan.priority[0];
      plan.priority.forEach(function (candidate) {
        if (Math.abs(sums[candidate]) / 3 < Math.abs(sums[axis]) / 3) axis = candidate;
      });
    }
    var sign = sums[axis] > 0 ? 1 : -1;
    // Both directions are locked to the odd, nonzero sum at block start. The
    // first probe can temporarily produce zero without changing the second.
    return { axis: axis, direction: index === start ? -sign : sign };
  }
  function chooseItem(mode, seed, answers, items, slot) {
    var bucket = D.bank.buckets.find(function (candidate) { return candidate.axis === slot.axis && candidate.direction === slot.direction; });
    assert(bucket, '題庫缺少所需的向度與方向。');
    var usedIds = new Set(items.map(function (item) { return item.id; }));
    var usedFamilies = new Set(items.map(function (item) { return item.family; }));
    var usedClusters = new Set(items.map(function (item) { return item.semanticCluster; }));
    var random = randomFor(seed, mode, 'item/' + answers.join(',') + '/' + slot.axis + '/' + slot.direction);
    var candidates = shuffle(bucket.seedIds.map(function (_, index) { return index; }), random);
    for (var i = 0; i < candidates.length; i++) {
      var seedIndex = candidates[i];
      var seedItem = seedById[bucket.seedIds[seedIndex]];
      var cluster = seedItem.semanticCluster || seedItem.family;
      if (usedFamilies.has(seedItem.family) || usedClusters.has(cluster)) continue;
      var contextCount = Math.floor((bucket.count - 1 - seedIndex) / bucket.seedIds.length) + 1;
      var contextIndex = Math.floor(random() * contextCount);
      var offset = bucket.start - 1 + contextIndex * bucket.seedIds.length + seedIndex;
      var item = Bank.query({ offset: offset, limit: 1 }).items[0];
      if (item && !usedIds.has(item.id)) return item;
    }
    throw new Error('題庫沒有可用且語意不重複的短版題目。');
  }
  function replay(mode, seed, answers) {
    var plan = planFor(mode, seed);
    var items = [];
    var prefix = [];
    for (var index = 0; index < Math.min(answers.length + 1, mode); index++) {
      items.push(chooseItem(mode, seed, prefix, items, nextSlot(index, items, prefix, plan)));
      if (index < answers.length) prefix.push(answers[index]);
    }
    return {
      mode: mode, seed: seed, version: VERSION, bankVersion: D.bank.version,
      questionIds: items.map(function (item) { return item.id; }), answers: answers.slice()
    };
  }
  function create(mode, seed) {
    validateOptions(mode, seed);
    return replay(mode, seed, []);
  }
  function denseArray(value) {
    if (!Array.isArray(value) || Object.keys(value).length !== value.length) return false;
    for (var i = 0; i < value.length; i++) if (!Object.prototype.hasOwnProperty.call(value, i)) return false;
    return true;
  }
  function restore(saved) {
    assert(saved && typeof saved === 'object' && !Array.isArray(saved), '短版續答資料格式無效。');
    assert(Object.keys(saved).length === fields.length && fields.every(function (field) { return Object.prototype.hasOwnProperty.call(saved, field); }), '短版續答欄位無效。');
    validateOptions(saved.mode, saved.seed);
    assert(saved.version === VERSION && saved.bankVersion === D.bank.version, '短版續答版本不相容。');
    assert(denseArray(saved.answers) && saved.answers.length <= saved.mode, '短版答案必須連續且不得超過題數。');
    assert(saved.answers.every(isAnswer), '短版答案只能為 1 或 -1。');
    assert(denseArray(saved.questionIds) && saved.questionIds.length === Math.min(saved.answers.length + 1, saved.mode), '短版續答必須保留唯一的下一題。');
    var canonical = replay(saved.mode, saved.seed, saved.answers);
    assert(saved.questionIds.every(function (id, index) { return id === canonical.questionIds[index]; }), '短版題目路徑與種子、答案不符。');
    return canonical;
  }
  function canonicalItem(id) {
    return Bank.query({ offset: Number(id.slice(2)) - 1, limit: 1 }).items[0];
  }
  function questions(session) {
    var canonical = restore(session);
    return canonical.questionIds.map(canonicalItem);
  }
  function answer(session, index, value) {
    var canonical = restore(session);
    assert(Number.isInteger(index) && index >= 0 && index < canonical.questionIds.length, '短版答題位置不存在。');
    assert(isAnswer(value), '短版答案只能為 1 或 -1。');
    if (index < canonical.answers.length && canonical.answers[index] === value) return canonical;
    var answers = canonical.answers.slice(0, index);
    answers.push(value);
    return replay(canonical.mode, canonical.seed, answers);
  }
  function score(session) {
    var canonical = restore(session);
    var items = canonical.questionIds.map(canonicalItem);
    var collected = {};
    D.axes.forEach(function (axis) { collected[axis.id] = { sum: 0, answered: 0, total: 0, positive: false, negative: false }; });
    items.forEach(function (item, index) {
      var current = collected[item.axis];
      current.total += 1;
      if (index >= canonical.answers.length) return;
      var vote = canonical.answers[index] * item.direction;
      current.sum += vote;
      current.answered += 1;
      current[vote > 0 ? 'positive' : 'negative'] = true;
    });
    var scores = {};
    D.axes.forEach(function (axis) {
      var current = collected[axis.id];
      var side = current.answered === current.total && current.answered > 0 && current.sum !== 0 ? (current.sum > 0 ? 'positive' : 'negative') : null;
      var endpoint = side ? axis[side] : null;
      scores[axis.id] = {
        sum: current.sum, answered: current.answered, total: current.total, maxAbs: current.total,
        normalized: current.total ? current.sum / current.total : 0,
        nearMidpoint: false, tied: false, side: side,
        key: endpoint ? endpoint.key : null, label: endpoint ? endpoint.label : null,
        singleItem: current.total === 1, mixed: current.positive && current.negative
      };
    });
    var complete = canonical.answers.length === canonical.mode;
    var type = complete ? ['energy', 'information', 'decision', 'organization'].map(function (id) { return scores[id].key; }).join('') : null;
    var emotion = complete ? scores.emotion.key : null;
    var coordination = complete ? scores.coordination.key : null;
    var resultKey = complete ? type + '-' + emotion + '-' + coordination : null;
    return {
      complete: complete, answered: canonical.answers.length, total: canonical.mode, scores: scores,
      resultKey: resultKey, hexagramId: resultKey ? D.mapping[resultKey] : null,
      type: type, emotion: emotion, coordination: coordination,
      ties: [], unresolvedTies: [], allNeutral: false, mode: canonical.mode
    };
  }
  global.GuaShort = Object.freeze({ VERSION: VERSION, create: create, questions: questions, answer: answer, restore: restore, score: score });
})(window);
