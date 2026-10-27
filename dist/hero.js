(function (global) {
  'use strict';
  var VERSION = '1.0.0';
  var KEY = 'gj-home-visual-v1';
  var STORAGE_VERSION = 1;
  var layouts = ['A', 'B', 'C', 'D', 'E'];
  var renderers = Object.create(null);
  var visitChoice = null;
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function uint32(value) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4294967295; }
  function mix(seed) {
    var value = seed >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
    return (value ^ (value >>> 16)) >>> 0;
  }
  function choose(seed) {
    assert(uint32(seed), 'GuaHero seed must be a 32-bit unsigned integer.');
    var value = mix(seed);
    return Object.freeze({ seed: seed, layout: layouts[(value >>> 6) % layouts.length], hexagramId: (value & 63) + 1 });
  }
  function register(key, renderFn) {
    assert(layouts.indexOf(key) >= 0, 'GuaHero layout must be A, B, C, D or E.');
    assert(typeof renderFn === 'function', 'GuaHero renderer must be a function.');
    assert(!own(renderers, key) || renderers[key] === renderFn, 'GuaHero layout ' + key + ' is already registered.');
    renderers[key] = renderFn;
  }
  function freshSeed(entropyFn) {
    var seed;
    if (entropyFn !== undefined) {
      assert(typeof entropyFn === 'function', 'GuaHero entropyFn must return a 32-bit unsigned integer.');
      seed = entropyFn();
    } else {
      assert(global.crypto && typeof global.crypto.getRandomValues === 'function', 'GuaHero requires crypto.getRandomValues to start a new visit.');
      var values = new Uint32Array(1);
      global.crypto.getRandomValues(values);
      seed = values[0];
    }
    assert(uint32(seed), 'GuaHero entropyFn must return a 32-bit unsigned integer.');
    return seed;
  }
  function validSaved(value) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === 2 && own(value, 'version') && own(value, 'seed') &&
      value.version === STORAGE_VERSION && uint32(value.seed);
  }
  function getVisit(storage, entropyFn) {
    if (visitChoice) return visitChoice;
    if (storage === undefined) { try { storage = global.sessionStorage; } catch (_) { storage = null; } }
    var saved = null;
    try {
      if (storage && typeof storage.getItem === 'function') saved = JSON.parse(storage.getItem(KEY));
    } catch (_) { saved = null; }
    if (validSaved(saved)) visitChoice = choose(saved.seed);
    else {
      visitChoice = choose(freshSeed(entropyFn));
      try {
        if (storage && typeof storage.setItem === 'function') storage.setItem(KEY, JSON.stringify({ version: STORAGE_VERSION, seed: visitChoice.seed }));
      } catch (_) { /* This visit remains stable in memory when session storage is unavailable. */ }
    }
    return visitChoice;
  }
  function validChoice(choice) {
    return choice && typeof choice === 'object' && uint32(choice.seed) && layouts.indexOf(choice.layout) >= 0 &&
      Number.isInteger(choice.hexagramId) && choice.hexagramId >= 1 && choice.hexagramId <= 64;
  }
  function context(choice, data) {
    assert(validChoice(choice), 'GuaHero requires a valid choice with seed, layout and hexagramId.');
    var iching = data && data.iching;
    assert(iching && Array.isArray(iching.hexagrams) && iching.hexagrams.length === 64 && Array.isArray(iching.trigrams) && iching.trigrams.length === 8, 'GuaHero requires the original 64 hexagrams and eight trigrams.');
    var hexagram = iching.hexagrams.find(function (item) { return item.number === choice.hexagramId; });
    assert(hexagram && typeof hexagram.chineseName === 'string' && Array.isArray(hexagram.lines) && hexagram.lines.length === 6 && hexagram.lines.every(function (line) { return line === 0 || line === 1; }), 'GuaHero hexagram data is incomplete.');
    var top = iching.trigrams.find(function (item) { return item.number === hexagram.topTrigram; });
    var bottom = iching.trigrams.find(function (item) { return item.number === hexagram.bottomTrigram; });
    assert(top && bottom && Array.isArray(top.lines) && top.lines.length === 3 && Array.isArray(bottom.lines) && bottom.lines.length === 3 && typeof top.chineseImage === 'string' && typeof bottom.chineseImage === 'string', 'GuaHero trigram data is incomplete.');
    assert(hexagram.lines.join('') === bottom.lines.concat(top.lines).join(''), 'GuaHero hexagram lines must match its lower and upper trigrams.');
    var name = top.number === bottom.number ? hexagram.chineseName + '為' + top.chineseImage : top.chineseImage + bottom.chineseImage + hexagram.chineseName;
    var report = data.reports && data.reports[choice.hexagramId];
    var quote = report && typeof report.quote === 'string' && report.quote.trim() ? report.quote : '以一卦為起點，留意今天的自己。';
    // These are original source values. Each layout escapes text when creating its own markup.
    return Object.freeze({ id: choice.hexagramId, name: name, shortName: hexagram.chineseName, hexagram: hexagram,
      top: top, bottom: bottom, trigrams: iching.trigrams, hexagrams: iching.hexagrams, quote: quote });
  }
  function render(choice, data) {
    assert(validChoice(choice), 'GuaHero requires a valid choice with seed, layout and hexagramId.');
    assert(own(renderers, choice.layout), 'GuaHero layout ' + choice.layout + ' has not been registered.');
    var html = renderers[choice.layout](context(choice, data));
    assert(typeof html === 'string' && html.trim(), 'GuaHero layout ' + choice.layout + ' must return HTML.');
    return html;
  }
  global.GuaHero = Object.freeze({ VERSION: VERSION, register: register, choose: choose, getVisit: getVisit, context: context, render: render });
})(window);
