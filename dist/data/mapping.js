(function (global) {
  'use strict';
  var data = global.GuaData = global.GuaData || {};
  data.versions = Object.assign({}, data.versions, { mapping: '1.0.0' });
  var rows = {
    INTJ: [26, 50, 23, 18], INTP: [52, 48, 4, 64], ENTJ: [1, 7, 43, 49], ENTP: [38, 14, 51, 21],
    INFJ: [20, 53, 36, 61], INFP: [12, 15, 29, 31], ENFJ: [19, 13, 30, 42], ENFP: [56, 46, 44, 59],
    ISTJ: [32, 37, 60, 39], ISFJ: [27, 2, 62, 41], ESTJ: [34, 11, 6, 63], ESFJ: [10, 8, 54, 45],
    ISTP: [25, 40, 47, 28], ISFP: [33, 17, 22, 57], ESTP: [5, 9, 3, 35], ESFP: [24, 16, 55, 58]
  };
  var variants = ['calm-autonomous', 'calm-cooperative', 'sensitive-autonomous', 'sensitive-cooperative'];
  data.mapping = {};
  Object.keys(rows).forEach(function (type) {
    variants.forEach(function (variant, index) { data.mapping[type + '-' + variant] = rows[type][index]; });
  });
})(window);
