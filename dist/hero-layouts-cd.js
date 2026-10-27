(function (global) {
  'use strict';

  const HERO = global.GuaHero;
  if (!HERO || typeof HERO.register !== 'function') throw new Error('Load hero.js before hero-layouts-cd.js.');

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function linesOf(value, count) {
    if (!value || !Array.isArray(value.lines) || value.lines.length !== count || value.lines.some(function (line) { return line !== 0 && line !== 1; })) {
      throw new Error('Hero requires validated hexagram and trigram lines.');
    }
    return value.lines;
  }

  function readContext(ctx) {
    if (!ctx || !Number.isInteger(ctx.id) || ctx.id < 1 || ctx.id > 64 || !Array.isArray(ctx.hexagrams) || ctx.hexagrams.length !== 64 || !Array.isArray(ctx.trigrams) || ctx.trigrams.length !== 8) {
      throw new Error('Hero requires a complete hexagram context.');
    }
    linesOf(ctx.hexagram, 6);
    linesOf(ctx.top, 3);
    linesOf(ctx.bottom, 3);
    return ctx;
  }

  function lineRects(lines, width, thickness, step) {
    const part = width * 0.4;
    return lines.slice().reverse().map(function (line, i) {
      const y = i * step;
      return line
        ? `<rect y="${y}" width="${width}" height="${thickness}"/>`
        : `<rect y="${y}" width="${part}" height="${thickness}"/><rect x="${width - part}" y="${y}" width="${part}" height="${thickness}"/>`;
    }).join('');
  }

  function ringGlyphs(ctx) {
    return ctx.hexagrams.map(function (hexagram, i) {
      const angle = i * 360 / 64 - 90;
      const rad = angle * Math.PI / 180;
      const x = 240 + Math.cos(rad) * 198;
      const y = 240 + Math.sin(rad) * 198;
      const fill = hexagram.number === ctx.id ? '#a44232' : i % 8 === 0 ? '#788372' : '#9da58f';
      return `<g fill="${fill}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(angle + 90).toFixed(2)}) translate(-6 -7)">${lineRects(linesOf(hexagram, 6), 12, 1.15, 2.6)}</g>`;
    }).join('');
  }

  function circle(ctx, prefix) {
    const name = esc(ctx.name);
    const top = esc(ctx.top.chineseName);
    const bottom = esc(ctx.bottom.chineseName);
    const number = ctx.id;
    const lineDescription = linesOf(ctx.hexagram, 6).map(function (line) { return line ? '陽' : '陰'; }).join('、');
    return `<svg class="${prefix}-circle" viewBox="0 0 480 480" role="img" aria-label="文王六十四卦環；中央為第 ${number} 卦${name}，上${top}下${bottom}。六爻由下至上為${lineDescription}。">
      <circle cx="240" cy="240" r="221" fill="none" stroke="#bec4b1" stroke-width=".8"/>
      <circle cx="240" cy="240" r="178" fill="none" stroke="#d2d5c6" stroke-width=".7"/>
      <g stroke="#a9b19c" stroke-width=".8"><path d="M240 13v12M240 455v12M13 240h12M455 240h12"/></g>
      ${ringGlyphs(ctx)}
      <circle cx="240" cy="240" r="141" fill="#eeeede" fill-opacity="${prefix === 'concept-c' ? '.7' : '.55'}"/>
      <circle cx="240" cy="240" r="130" fill="none" stroke="#c9cebb" stroke-width=".7"/>
      <text x="240" y="127" text-anchor="middle" fill="#747e6d" font-size="10" font-family="sans-serif" letter-spacing="3">第 ${number} 卦</text>
      <g class="${prefix}-main-glyph" data-hexagram="${number}" data-lines="${ctx.hexagram.lines.join('')}" data-line-order="bottom-to-top" fill="#283830" transform="translate(198 158)">${lineRects(ctx.hexagram.lines, 84, 7, 22)}</g>
      <path d="M222 299h36" stroke="#a44232" stroke-width="1.2"/>
      <text x="240" y="329" text-anchor="middle" fill="#283830" font-size="19" font-family="serif" letter-spacing="4">${name}</text>
      <circle cx="240" cy="19" r="2.6" fill="#a44232"/>
    </svg>`;
  }

  function renderC(input) {
    const ctx = readContext(input);
    const quote = ctx.quote ? esc(ctx.quote) : '一種意象，一個理解自己的角度。';
    return `<figure class="concept-c" data-hero-layout="C" data-hexagram="${ctx.id}"><div class="concept-c-topline"><span class="concept-c-edition">卦見自己 · 意象之書</span><span class="concept-c-rule" aria-hidden="true"></span><span class="concept-c-seal" aria-hidden="true">易</span></div><div class="concept-c-body">${circle(ctx, 'concept-c')}<div class="concept-c-side"><span class="concept-c-bookmark">本次意象</span><strong class="concept-c-title">${esc(ctx.shortName)}</strong><dl class="concept-c-pair"><div><dt>上卦</dt><dd>${esc(ctx.top.chineseName)} · ${esc(ctx.top.chineseImage)}</dd></div><div><dt>下卦</dt><dd>${esc(ctx.bottom.chineseName)} · ${esc(ctx.bottom.chineseImage)}</dd></div></dl></div></div><figcaption class="concept-c-caption"><div class="concept-c-folio"><strong>64</strong><span>種文化原型</span></div><p class="concept-c-note">${quote}<small>第 ${ctx.id} 卦 · ${esc(ctx.name)}</small></p></figcaption></figure>`;
  }

  function sameTrigram(left, right) {
    return left.number === right.number && left.chineseName === right.chineseName;
  }

  function trigramLabels(ctx) {
    const order = ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'];
    return ctx.trigrams.slice().sort(function (left, right) {
      return order.indexOf(left.chineseName) - order.indexOf(right.chineseName);
    }).map(function (trigram) {
      const upper = sameTrigram(trigram, ctx.top);
      const lower = sameTrigram(trigram, ctx.bottom);
      const roles = upper && lower ? '上・下卦' : upper ? '上卦' : lower ? '下卦' : '';
      const classes = `concept-d-label${upper || lower ? ' concept-d-label-active' : ''}${upper ? ' concept-d-label-upper' : ''}${lower ? ' concept-d-label-lower' : ''}`;
      return `<li class="${classes}" data-trigram="${esc(trigram.chineseName)}"${roles ? ` aria-label="${esc(trigram.chineseName)}，${esc(trigram.chineseImage)}，本卦${roles}"` : ''}><svg class="concept-d-trigram" viewBox="0 0 28 26" aria-hidden="true"><g transform="translate(1 2)">${lineRects(linesOf(trigram, 3), 26, 3, 8)}</g></svg><span class="concept-d-words"><span class="concept-d-name">${esc(trigram.chineseName)}</span><span class="concept-d-image">${esc(trigram.chineseImage)}</span></span>${roles ? `<small class="concept-d-role">${roles}</small>` : '<small class="concept-d-role" aria-hidden="true">&nbsp;</small>'}</li>`;
    }).join('');
  }

  function renderD(input) {
    const ctx = readContext(input);
    const quote = ctx.quote ? esc(ctx.quote) : '在古老意象裡，讀見當代生活。';
    return `<figure class="concept-d" data-hero-layout="D" data-hexagram="${ctx.id}"><div class="concept-d-topline"><span class="concept-d-kicker">八種自然意象 · 六十四面鏡子</span><span class="concept-d-seal" aria-hidden="true">易</span></div>${circle(ctx, 'concept-d')}<figcaption class="concept-d-caption"><p>${esc(ctx.top.chineseImage)}在上，${esc(ctx.bottom.chineseImage)}在下。</p><small>${quote}</small></figcaption><ul class="concept-d-labels" aria-label="八卦與自然意象；${esc(ctx.name)}，上卦為${esc(ctx.top.chineseName)}，下卦為${esc(ctx.bottom.chineseName)}。">${trigramLabels(ctx)}</ul><div class="concept-d-foot"><span>自然有象</span><i aria-hidden="true"></i><span>生活有自己的節奏</span></div></figure>`;
  }

  HERO.register('C', renderC);
  HERO.register('D', renderD);
}(window));
