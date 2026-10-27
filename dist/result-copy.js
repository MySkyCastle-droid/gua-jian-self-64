(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuaResultCopy = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  // Presentation only. The scoring engines remain the source of every flag and side.
  var wording = {
    energy: { label: '精神恢復的方式', positive: '透過交流充電', negative: '留點安靜充電', positiveText: '忙完一段之後，你較常透過聊天、互動，慢慢找回精神。', negativeText: '忙完一段之後，你較常需要一點獨處時間，慢慢找回精神。' },
    information: { label: '理解事情的方式', positive: '先看細節與經驗', negative: '先找關聯與可能', positiveText: '接觸新事情時，你較常先找具體例子、細節，或過去的經驗。', negativeText: '接觸新事情時，你較常先想整體的關聯，以及還有哪些可能。' },
    decision: { label: '做決定的起點', positive: '先整理理由與原則', negative: '先想人的感受與處境', positiveText: '需要做決定時，你較常先整理理由，找一個前後一致的判準。', negativeText: '需要做決定時，你較常先想相關的人在意什麼、正處於什麼情況。' },
    organization: { label: '安排生活的節奏', positive: '先定下安排', negative: '先留些調整空間', positiveText: '面對一件要做的事，你較常先定下方向和順序，心裡也比較有底。', negativeText: '面對一件要做的事，你較常先留些選擇，隨著新發現調整做法。' },
    emotion: { label: '面對變化的感受', positive: '感受較平緩', negative: '感受較鮮明', positiveText: '事情出現變化時，你這次描述的內在感受通常比較平緩。', negativeText: '事情出現變化時，你這次描述的內在感受通常比較鮮明。' },
    coordination: { label: '形成方案的方式', positive: '先自己整理想法', negative: '先一起交換想法', positiveText: '要和別人一起處理事情時，你較常先自己想出初步做法，再拿出來商量。', negativeText: '要和別人一起處理事情時，你較常先交換想法，再慢慢形成做法。' }
  };
  function axis(scored, definition) {
    var score = scored.scores[definition.id];
    var copy = wording[definition.id] || { label: definition.label, positive: definition.positive.label, negative: definition.negative.label, positiveText: definition.positive.description, negativeText: definition.negative.description };
    var side = score.side;
    var open = !side;
    var legacyTie = Boolean(scored.legacy && score.tied && side);
    var clarificationDependent = Boolean(!scored.legacy && score.mainSum === 0 && score.clarificationCount > 0 && score.sum !== 0);
    var qualifiers = [];
    var direction = open ? '這個面向暫時保持開放。' : legacyTie ? '當時的主要問題沒有偏向；原封存分類保留「' + definition[side].label + '」。' : copy[side + 'Text'];
    if (open) qualifiers.push('這次回答還沒有讓其中一端比較明顯，先不替你選邊。');
    if (score.singleItem) qualifiers.push('這個面向只來自一道題，先把它當成一個小線索。');
    if (clarificationDependent) qualifiers.push('這個方向主要由補充情境的回答帶出，還需要更多生活觀察。');
    if (legacyTie) qualifiers.push('這裡沿用當時補充情境所決定的分類，沒有重新判定。');
    if (score.mixed) qualifiers.push('你的回答同時支持兩種做法；可以回想哪些情境讓你做出不同選擇。');
    if (score.nearMidpoint && !open) qualifiers.push('兩邊的回答很接近，換個情境也值得再看看。');
    var maximum = score.maxAbs || 16;
    var position = Math.max(1, Math.min(99, (maximum - score.sum) / (maximum * 2) * 100));
    var heading = open ? '這個面向暫時保持開放' : legacyTie ? '保留當時的分類' : '這次較靠近「' + copy[side] + '」';
    return {
      id: definition.id, label: copy.label, positive: copy.positive, negative: copy.negative,
      side: side, open: open, nearMidpoint: Boolean(score.nearMidpoint), mixed: Boolean(score.mixed),
      singleItem: Boolean(score.singleItem), clarificationDependent: clarificationDependent, legacyTie: legacyTie,
      heading: heading, direction: direction, qualifiers: qualifiers,
      count: score.total, position: position,
      accessibleLabel: copy.label + '。左側是' + copy.positive + '，右側是' + copy.negative + '。' + direction + qualifiers.join('')
    };
  }
  function axes(scored, definitions) { return definitions.map(function (definition) { return axis(scored, definition); }); }
  return Object.freeze({ VERSION: 'reader-v1', axis: axis, axes: axes });
});
