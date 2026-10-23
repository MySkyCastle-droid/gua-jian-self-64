(function (global) {
  'use strict';
  var data = global.GuaData;
  if (!data || !Array.isArray(data.questions) || !Array.isArray(data.axes) || !data.mapping) {
    throw new Error('GuaCore requires questions.js and mapping.js to be loaded first.');
  }
  var VERSION = '1.0.0';
  data.versions = Object.assign({}, data.versions, { scoring: VERSION });
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  function isAnswer(value) { return typeof value === 'number' && Number.isInteger(value) && value >= -2 && value <= 2; }
  function isTie(value) { return value === 1 || value === -1; }
  function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function countAnswered(answers) {
    answers = safeObject(answers);
    return data.questions.reduce(function (count, question) { return count + (own(answers, question.id) && isAnswer(answers[question.id]) ? 1 : 0); }, 0);
  }
  function collect(answers) {
    answers = safeObject(answers);
    var axes = {};
    data.axes.forEach(function (axis) { axes[axis.id] = { sum: 0, answered: 0, total: 0 }; });
    data.questions.forEach(function (question) {
      axes[question.axis].total += 1;
      if (own(answers, question.id) && isAnswer(answers[question.id])) {
        axes[question.axis].sum += answers[question.id] * question.direction;
        axes[question.axis].answered += 1;
      }
    });
    return axes;
  }
  function cleanTies(answers, tieChoices) {
    var collected = collect(answers);
    var clean = {};
    tieChoices = safeObject(tieChoices);
    data.axes.forEach(function (axis) {
      var current = collected[axis.id];
      if (current.answered === current.total && current.sum === 0 && own(tieChoices, axis.id) && isTie(tieChoices[axis.id])) clean[axis.id] = tieChoices[axis.id];
    });
    return clean;
  }
  function score(answers, tieChoices) {
    answers = safeObject(answers);
    var collected = collect(answers);
    var validTies = cleanTies(answers, tieChoices);
    var answered = countAnswered(answers);
    var scores = {};
    var ties = [];
    var unresolvedTies = [];
    data.axes.forEach(function (axis) {
      var current = collected[axis.id];
      var axisComplete = current.answered === current.total;
      var tied = axisComplete && current.sum === 0;
      var signed = current.sum;
      if (tied) {
        ties.push(axis.id);
        if (own(validTies, axis.id)) signed = validTies[axis.id];
        else unresolvedTies.push(axis.id);
      }
      var side = !axisComplete || (tied && !own(validTies, axis.id)) ? null : (signed > 0 ? 'positive' : 'negative');
      var endpoint = side ? axis[side] : null;
      scores[axis.id] = { sum: current.sum, nearMidpoint: Math.abs(current.sum) <= 2, tied: tied, side: side, key: endpoint ? endpoint.key : null, label: endpoint ? endpoint.label : null };
    });
    var complete = answered === data.questions.length && unresolvedTies.length === 0;
    var type = complete ? ['energy', 'information', 'decision', 'organization'].map(function (id) { return scores[id].key; }).join('') : null;
    var emotion = complete ? scores.emotion.key : null;
    var coordination = complete ? scores.coordination.key : null;
    var resultKey = complete ? type + '-' + emotion + '-' + coordination : null;
    return {
      complete: complete, answered: answered, total: data.questions.length, scores: scores, ties: ties, unresolvedTies: unresolvedTies,
      type: type, emotion: emotion, coordination: coordination, resultKey: resultKey,
      hexagramId: resultKey ? data.mapping[resultKey] : null,
      allNeutral: answered === data.questions.length && data.questions.every(function (question) { return answers[question.id] === 0; })
    };
  }
  global.GuaCore = Object.freeze({ VERSION: VERSION, score: score, cleanTies: cleanTies, countAnswered: countAnswered });
})(window);
