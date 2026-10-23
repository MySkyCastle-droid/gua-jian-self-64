(function (global) {
  'use strict';
  var D = global.GuaData;
  if (!D || !D.bank || !Array.isArray(D.bank.seeds) || !Array.isArray(D.axes)) throw new Error('Question bank data and axes must load before bank.js.');
  var B = D.bank;
  var chapters = ['日常裡的你', '學習與做事', '變化與選擇', '關係與未來'];
  var bySeed = {};
  B.seeds.forEach(function (seed) { bySeed[seed.id] = seed; });
  var typeKeys = Object.keys(D.mapping).sort();
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function bucketForNumber(number) {
    return B.buckets.find(function (bucket) { return number >= bucket.start && number < bucket.start + bucket.count; });
  }
  function makeItem(bucket, localIndex) {
    var seedIndex = localIndex % 24;
    var contextIndex = Math.floor(localIndex / 24);
    var seed = bySeed[bucket.seedIds[seedIndex]];
    var sceneIndex = Math.floor(contextIndex / B.contexts.constraints.length);
    var constraintIndex = contextIndex % B.contexts.constraints.length;
    var scenario = B.contexts.scenarios[bucket.axis][sceneIndex];
    var constraint = B.contexts.constraints[constraintIndex];
    return {
      id: 'QB' + String(bucket.start + localIndex).padStart(6, '0'),
      text: '情境：' + scenario + '，' + constraint + '。\n' + seed.text,
      axis: bucket.axis, direction: bucket.direction, family: seed.family, semanticCluster: seed.semanticCluster || seed.family,
      contextId: 'C-' + bucket.axis + '-' + String(sceneIndex + 1).padStart(2, '0') + '-' + String(constraintIndex + 1).padStart(2, '0'),
      seedId: seed.id, seedText: seed.text, sourceIds: seed.sourceIds.slice(), adaptationNote: seed.adaptationNote
    };
  }
  function itemById(id) {
    assert(typeof id === 'string' && /^QB\d{6}$/.test(id), '題庫編號格式無效。');
    var number = Number(id.slice(2));
    var bucket = bucketForNumber(number);
    assert(bucket, '題庫編號不存在。');
    return makeItem(bucket, number - bucket.start);
  }
  function endpoint(typeKey, axisId) {
    var parts = typeKey.split('-');
    var index = ['energy', 'information', 'decision', 'organization'].indexOf(axisId);
    var key = index >= 0 ? parts[0].charAt(index) : (axisId === 'emotion' ? parts[1] : parts[2]);
    var axis = D.axes.find(function (candidate) { return candidate.id === axisId; });
    return key === axis.positive.key ? 1 : -1;
  }
  function supportedTypes(item) {
    assert(item && D.axes.some(function (axis) { return axis.id === item.axis; }) && (item.direction === 1 || item.direction === -1), '題目向度或方向無效。');
    return typeKeys.filter(function (key) { return endpoint(key, item.axis) === item.direction; });
  }
  function selectedBuckets(options) {
    var axis = options.axis || '';
    var typeKey = options.typeKey || '';
    assert(!axis || D.axes.some(function (candidate) { return candidate.id === axis; }), '查詢向度不存在。');
    assert(!typeKey || Object.prototype.hasOwnProperty.call(D.mapping, typeKey), '查詢人格分型不存在。');
    return B.buckets.filter(function (bucket) { return (!axis || bucket.axis === axis) && (!typeKey || endpoint(typeKey, bucket.axis) === bucket.direction); });
  }
  function query(options) {
    options = options || {};
    var buckets = selectedBuckets(options);
    var offset = options.offset === undefined ? 0 : options.offset;
    var limit = options.limit === undefined ? 12 : options.limit;
    assert(Number.isInteger(offset) && offset >= 0, '分頁起點必須為非負整數。');
    assert(Number.isInteger(limit) && limit >= 0 && limit <= 1000, '每頁筆數必須介於 0 至 1000。');
    var total = buckets.reduce(function (sum, bucket) { return sum + bucket.count; }, 0);
    var items = [];
    var remainingOffset = offset;
    for (var i = 0; i < buckets.length && items.length < limit; i++) {
      var bucket = buckets[i];
      if (remainingOffset >= bucket.count) { remainingOffset -= bucket.count; continue; }
      var available = Math.min(bucket.count - remainingOffset, limit - items.length);
      for (var local = remainingOffset; local < remainingOffset + available; local++) items.push(makeItem(bucket, local));
      remainingOffset = 0;
    }
    return { total: total, items: items };
  }
  function randomSource(seedNumber) {
    assert(Number.isInteger(seedNumber) && seedNumber >= 0 && seedNumber <= 4294967295, '組卷種子必須為 32 位元無號整數。');
    var state = seedNumber >>> 0;
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
  function restoreForm(ids) {
    assert(Array.isArray(ids) && ids.length === 48, '續答需保留完整的 48 題題目編號。');
    assert(new Set(ids).size === 48, '題目編號不能重複。');
    var families = new Set();
    var semanticClusters = new Set();
    var chapterCounts = {};
    var form = ids.map(function (id, index) {
      var item = itemById(id);
      assert(!families.has(item.family), '同一份測驗不能重複使用同一語意家族。');
      families.add(item.family);
      assert(!semanticClusters.has(item.semanticCluster), '同一份測驗不能重複使用同一近義群組。');
      semanticClusters.add(item.semanticCluster);
      var chapter = Math.floor(index / 12) + 1;
      var group = chapter + '/' + item.axis + '/' + item.direction;
      chapterCounts[group] = (chapterCounts[group] || 0) + 1;
      item.chapter = chapter;
      item.chapterTitle = chapters[chapter - 1];
      return item;
    });
    for (var chapter = 1; chapter <= 4; chapter++) {
      D.axes.forEach(function (axis) {
        [1, -1].forEach(function (direction) { assert(chapterCounts[chapter + '/' + axis.id + '/' + direction] === 1, '每章每個向度須各含一道正向與反向題。'); });
      });
    }
    return form;
  }
  function createForm(seedNumber) {
    var random = randomSource(seedNumber);
    var picks = {};
    var slots = [];
    B.buckets.forEach(function (bucket) {
      picks[bucket.axis + '/' + bucket.direction] = [];
      for (var i = 0; i < 4; i++) slots.push({ bucket: bucket, candidates: shuffle(bucket.seedIds.map(function (_, index) { return index; }), random) });
    });
    // Match the 48 axis/direction slots to different semantic clusters. Augmenting
    // paths preserve balance even when a cluster occurs on opposing endpoints.
    var matchedClusters = new Map();
    var chosenSeedIndices = [];
    function assignSlot(slotIndex, visited) {
      var slot = slots[slotIndex];
      for (var candidate = 0; candidate < slot.candidates.length; candidate++) {
        var seedIndex = slot.candidates[candidate];
        var seed = bySeed[slot.bucket.seedIds[seedIndex]];
        var cluster = seed.semanticCluster || seed.family;
        if (visited.has(cluster)) continue;
        visited.add(cluster);
        var previousSlot = matchedClusters.get(cluster);
        if (previousSlot === undefined || assignSlot(previousSlot, visited)) {
          matchedClusters.set(cluster, slotIndex);
          chosenSeedIndices[slotIndex] = seedIndex;
          return true;
        }
      }
      return false;
    }
    slots.forEach(function (_, index) { assert(assignSlot(index, new Set()), '題庫的近義群組不足以組成平衡的 48 題。'); });
    slots.forEach(function (slot, index) {
      var seedIndex = chosenSeedIndices[index];
      var availableContexts = Math.floor((slot.bucket.count - 1 - seedIndex) / 24) + 1;
      var contextIndex = Math.floor(random() * availableContexts);
      picks[slot.bucket.axis + '/' + slot.bucket.direction].push(makeItem(slot.bucket, contextIndex * 24 + seedIndex));
    });
    var ids = [];
    for (var chapterIndex = 0; chapterIndex < 4; chapterIndex++) {
      var axisOrder = shuffle(D.axes.map(function (axis) { return axis.id; }), random);
      var firstDirections = axisOrder.map(function () { return random() >= 0.5 ? 1 : -1; });
      axisOrder.forEach(function (axisId, index) { ids.push(picks[axisId + '/' + firstDirections[index]][chapterIndex].id); });
      axisOrder.forEach(function (axisId, index) { ids.push(picks[axisId + '/' + (-firstDirections[index])][chapterIndex].id); });
    }
    return restoreForm(ids);
  }
  function activate(form) {
    assert(Array.isArray(form), '缺少要使用的問卷。');
    var canonical = restoreForm(form.map(function (item) { return item && item.id; }));
    D.questions = canonical;
    return canonical;
  }
  function stats() { return { sourceCount: B.sourceCount, seedCount: B.seeds.length, count: B.count, semanticClusterCount: new Set(B.seeds.map(function (seed) { return seed.semanticCluster || seed.family; })).size }; }
  global.GuaBank = Object.freeze({ stats: stats, createForm: createForm, restoreForm: restoreForm, activate: activate, query: query, supportedTypes: supportedTypes });
})(window);
