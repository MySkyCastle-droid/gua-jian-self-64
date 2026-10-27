'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'dist', 'app.js'), 'utf8');

function renderedPage(hash, imagePolicy) {
  const main = { innerHTML: '', focus() {} };
  const events = new Map();
  const copied = [];
  const errors = [];
  const location = { href: 'https://example.test/' + hash, hash, protocol: 'https:' };
  const report = {
    typeKey: 'ENTJ-calm-autonomous', title: '開創者', subtitle: '為想做的事踏出一步',
    summary: '想法落地的日常練習。', quote: '天行健。', plainMeaning: '持續前進。',
    pairing: '以開創連結到生活。', source: 'https://example.test/source',
    strength: '願意開始。', blindspot: '也留時間聆聽。', advice: ['先做一件小事。'], reflection: '今天想試什麼？'
  };
  const data = {
    imagePolicy, reports: { 1: report },
    iching: { hexagrams: [{ number: 1, chineseName: '乾', pinyinName: 'Qian', topTrigram: 1, bottomTrigram: 1, lines: [1, 1, 1, 1, 1, 1] }], trigrams: [{ number: 1, chineseName: '乾', chineseImage: '天' }] },
    artwork: { 1: { src: './artwork/01.webp', title: '開創者', conceptZh: '原創日常意象', width: 1024, height: 1024 } }
  };
  const window = {
    GuaData: data, GuaCore: {}, GuaShort: {}, GuaFull: {}, GuaShortLegacy: {},
    GuaResultCopy: { VERSION: 'test' }, GuaQuestionCopy: {},
    GuaSessions: { load: () => ({ envelope: { activeMode: 10, sessions: { 10: { mode: 10, started: false } } }, storageAvailable: true, message: '' }) },
    localStorage: {}, addEventListener() {}, scrollTo() {}
  };
  const document = {
    title: '', getElementById: id => id === 'main' ? main : { hidden: true, textContent: '' },
    querySelectorAll: () => [], querySelector: () => null,
    addEventListener: (name, callback) => events.set(name, callback)
  };
  const box = {
    window, document, location, URL,
    history: { scrollRestoration: 'auto', replaceState() {} },
    navigator: { clipboard: { writeText: async value => { copied.push(value); } } },
    requestAnimationFrame: callback => callback(), setTimeout: () => 1, clearTimeout() {},
    console: { error: (...items) => errors.push(items) }
  };
  vm.runInNewContext(app, box, { filename: 'app.js' });
  assert.deepEqual(errors, [], 'public route renders without an error fallback');
  return { main, events, copied, location, document };
}

test('image rights route states paid written authorization and separates existing rights', () => {
  const { main, document } = renderedPage('#image-rights', { contactEmail: 'author@example.test', logoSrc: './assets/brand/twobu-logo.webp', brand: 'TWOBU' });
  assert.match(document.title, /圖片版權與使用授權/);
  assert.match(main.innerHTML, /禁止未經授權的商業使用/);
  assert.match(main.innerHTML, /付費申請並取得書面授權/);
  assert.match(main.innerHTML, /付款本身，都不代表已取得使用許可/);
  assert.match(main.innerHTML, /MIT 權利/);
  assert.match(main.innerHTML, /第三方與公有領域/);
  assert.match(main.innerHTML, /純 AI 生成元素/);
  assert.match(main.innerHTML, /href="mailto:author%40example\.test"/);
  assert.match(main.innerHTML, /href="\.\/licenses\/Image-Use\.txt"[^>]*>圖片使用完整條款/);
  assert.match(main.innerHTML, /class="image-rights-logo"[^>]+src="\.\/assets\/brand\/twobu-logo\.webp"[^>]+alt="TWOBU"/);
});

test('rights page does not load an external or unsafe logo URL', () => {
  for (const logoSrc of ['https://example.test/track.webp', 'javascript:alert(1)', './assets/brand/../track.webp', './assets/brand/a.webp" onerror="alert(1)']) {
    const { main } = renderedPage('#image-rights', { logoSrc });
    assert.doesNotMatch(main.innerHTML, /class="image-rights-logo"|onerror=/);
  }
});

test('source disclosures link to both the image policy and its complete terms', () => {
  const { main } = renderedPage('#sources');
  assert.match(main.innerHTML, /<h3>64 型人格原創插畫<\/h3>/);
  assert.match(main.innerHTML, /href="#image-rights">圖片版權與申請方式/);
  assert.match(main.innerHTML, /href="\.\/licenses\/Image-Use\.txt"[^>]*>圖片使用完整條款/);
});

test('missing or invalid licensing email does not produce a fake contact or unsafe mail link', () => {
  for (const policy of [undefined, {}, { contactEmail: '' }, { contactEmail: 'bad@example.test\" onclick=\"alert(1)' }, { contactEmail: '<script>alert(1)</script>' }]) {
    const { main } = renderedPage('#image-rights', policy);
    assert.doesNotMatch(main.innerHTML, /mailto:|onclick=|<script>|author@example\.test|fishanyvalue/);
    assert.match(main.innerHTML, /商業使用請先聯繫作者/);
  }
});

test('an archetype page offers rights and copies only its page URL', async () => {
  const { main, events, copied, location } = renderedPage('#atlas/1');
  assert.match(main.innerHTML, /data-action="copy-link"/);
  assert.match(main.innerHTML, /href="#image-rights"/);
  assert.doesNotMatch(main.innerHTML, /download-card|下載分享卡|分享／下載結果卡/);
  location.href = 'https://example.test/?source=friend&qa=retired&qaSeed=42#result/10';
  const button = { dataset: { action: 'copy-link' } };
  events.get('click')({ target: { closest: selector => selector === '[data-action]' ? button : null } });
  await Promise.resolve();
  assert.deepEqual(copied, ['https://example.test/?source=friend#atlas/1']);
});

test('visitor presentation omits engineering replay notices and image export implementation', () => {
  assert.doesNotMatch(app, /主要問題固定不變|修改本題會重新安排後續問題|補充情境答案會清除|aria-describedby="branch-notice"/);
  assert.match(app, /再看一個生活情境。/);
  assert.doesNotMatch(app, /download-card|downloadCard|wrappedText|navigator\.(?:share|canShare)\(|createElement\('canvas'\)|\.toBlob\(|\.download\s*=/);
  assert.match(app, /Full\.answer\(state\.full, item\.id, Number\(input\.value\)\)/);
  assert.match(app, /Short\.answer\(state\.short, state\.questionIndex, Number\(input\.value\)\)/);
});
