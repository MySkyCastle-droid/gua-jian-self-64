(function (global) {
  'use strict';
  var D = global.GuaData;
  if (!D || !D.bank || !D.questionCopy || D.questionCopy.version !== 'direct-v1') throw new Error('新版行為題尚未完整載入。');
  var records = {};
  D.questionCopy.items.forEach(function (item) {
    if (!item || typeof item.seedId !== 'string' || typeof item.text !== 'string' || !item.text.trim() || records[item.seedId]) throw new Error('新版行為題資料重複或缺漏。');
    records[item.seedId] = Object.freeze({ text: item.text, openingKey: item.text.split(/[，。；：！？]/)[0].normalize('NFKC').replace(/[\s\p{P}]/gu, '') });
  });
  if (Object.keys(records).length !== D.bank.seeds.length || !D.bank.seeds.every(function (seed) { return records[seed.id]; })) throw new Error('新版行為題未覆蓋完整母題。');
  function has(seedId) { return Object.prototype.hasOwnProperty.call(records, seedId); }
  function render(item) {
    if (!item || !has(item.seedId)) throw new Error('找不到這道新版行為題。');
    return records[item.seedId];
  }
  function catalog(options) {
    options = options || {};
    return D.bank.seeds.filter(function (seed) {
      if (options.axis && seed.axis !== options.axis) return false;
      if (options.typeKey) {
        var parts = options.typeKey.split('-');
        var axisIndex = ['energy','information','decision','organization'].indexOf(seed.axis);
        var key = axisIndex >= 0 ? parts[0].charAt(axisIndex) : parts[seed.axis === 'emotion' ? 1 : 2];
        var axis = D.axes.find(function (value) { return value.id === seed.axis; });
        if ((key === axis.positive.key ? 1 : -1) !== seed.direction) return false;
      }
      return true;
    }).map(function (seed) { return { id:seed.id, seedId:seed.id, text:records[seed.id].text, openingKey:records[seed.id].openingKey, axis:seed.axis, direction:seed.direction, family:seed.family, semanticCluster:seed.semanticCluster, sourceIds:seed.sourceIds.slice(), seedText:seed.text, adaptationNote:seed.adaptationNote }; });
  }
  global.GuaQuestionCopy = Object.freeze({ VERSION:'direct-v1', has:has, render:render, catalog:catalog });
})(window);
