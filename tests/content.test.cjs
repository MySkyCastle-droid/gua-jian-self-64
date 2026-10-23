'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const plain = value => JSON.parse(JSON.stringify(value));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['data/questions.js', 'data/mapping.js', 'data/hexagrams.js', 'data/reports-a.js', 'data/reports-b.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), sandbox, { filename: file });
}
const { GuaData: data, GuaCore: core } = sandbox.window;

function texts(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(texts).join('');
  if (value && typeof value === 'object') return Object.entries(value).filter(([key]) => key !== 'typeKey' && key !== 'source').map(([, item]) => texts(item)).join('');
  return '';
}
function localAsset(reference, base) {
  assert.ok(nonempty(reference), 'Runtime asset reference cannot be empty');
  assert.doesNotMatch(reference, /^(?:[a-z][a-z\d+.-]*:|\/\/)/i, 'Runtime assets must be local: ' + reference);
  const clean = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  const resolved = path.resolve(base, clean);
  const relative = path.relative(dist, resolved);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Runtime asset must remain inside dist: ' + reference);
  assert.ok(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), 'Missing runtime asset: ' + resolved);
  return resolved;
}

test('all 64 reports have unique identities and match the questionnaire classification', () => {
  assert.ok(data.reports && typeof data.reports === 'object', 'GuaData.reports is available');
  const reports = Object.values(data.reports);
  assert.equal(reports.length, 64, 'Exactly 64 reports are shipped');
  assert.equal(new Set(reports.map(report => report.id)).size, 64, 'Report ids are unique');
  assert.equal(new Set(reports.map(report => report.typeKey)).size, 64, 'Type keys are unique');
  assert.equal(new Set(reports.map(report => report.title)).size, 64, 'Original report titles are unique');
  assert.deepEqual(reports.map(report => report.id).sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i + 1));
  for (const report of reports) {
    assert.equal(Number.isInteger(report.id), true, 'Report id must be a King Wen number');
    assert.equal(data.mapping[report.typeKey], report.id, 'Report type and hexagram disagree: ' + report.typeKey);
    const [type, emotion, coordination] = report.typeKey.split('-');
    const endpoints = [type[0], type[1], type[2], type[3], emotion, coordination];
    const signs = Object.fromEntries(data.axes.map((axis, index) => [axis.id, endpoints[index] === axis.positive.key ? 2 : -2]));
    const answers = Object.fromEntries(data.questions.map(q => [q.id, signs[q.axis] * q.direction]));
    const result = core.score(answers);
    assert.equal(result.complete, true);
    assert.equal(result.resultKey, report.typeKey, 'The actual scoring path reaches each report');
    assert.equal(result.hexagramId, report.id);
  }
});

test('every report contains the promised cultural interpretation and actionable advice', t => {
  const overTarget = [];
  for (const report of Object.values(data.reports)) {
    for (const field of ['title', 'summary', 'quote', 'plainMeaning', 'pairing', 'strength', 'blindspot', 'reflection', 'source', 'typeKey']) {
      assert.ok(nonempty(report[field]), 'Report ' + report.id + ' is missing ' + field);
    }
    assert.ok(Array.isArray(report.advice), 'Report ' + report.id + ' advice must be an array');
    assert.equal(report.advice.length, 3, 'Report ' + report.id + ' must offer three suggestions');
    for (const suggestion of report.advice) assert.ok(nonempty(suggestion), 'Report advice cannot be blank');
    const count = (texts(report).match(/\p{Script=Han}/gu) || []).length;
    assert.ok(count >= 600 && count <= 1000, 'Report ' + report.id + ' contains ' + count + ' Han characters; expected approximately 600–900 (allowed check: 600–1000)');
    if (count > 900) overTarget.push(report.id + ': ' + count);
    const source = new URL(report.source);
    assert.equal(source.protocol, 'https:', 'Sources use stable HTTPS links');
    const hexagram = data.iching.hexagrams.find(hex => hex.number === report.id);
    assert.ok(hexagram, 'Report refers to an existing hexagram');
    // Wikisource preserves classical chapter spellings 无妄 and 恒 even in the zh-hant route.
    const chapterNames = report.id === 25 ? ['無妄', '无妄'] : report.id === 32 ? ['恆', '恒'] : [hexagram.chineseName];
    assert.ok(chapterNames.some(name => decodeURIComponent(source.pathname).endsWith('/周易/' + name)), 'Report ' + report.id + ' must link to its own source chapter');
  }
  if (overTarget.length) t.diagnostic('Reports above the 900-character target: ' + overTarget.join(', '));
});

test('hexagrams contain 64 unique complete figures with the correct line orientation', () => {
  const { hexagrams, trigrams } = data.iching;
  assert.equal(hexagrams.length, 64);
  assert.equal(trigrams.length, 8);
  assert.deepEqual([...new Set(hexagrams.map(hex => hex.number))].sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i + 1));
  assert.equal(new Set(hexagrams.map(hex => hex.binary)).size, 64);
  assert.equal(new Set(hexagrams.map(hex => hex.chineseName)).size, 64);
  assert.equal(new Set(trigrams.map(trigram => trigram.number)).size, 8);
  for (const trigram of trigrams) {
    assert.match(trigram.binary, /^[01]{3}$/);
    assert.deepEqual(plain(trigram.lines), trigram.binary.split('').reverse().map(Number), 'Trigram lines must run from bottom to top');
  }
  for (const hexagram of hexagrams) {
    assert.match(hexagram.binary, /^[01]{6}$/);
    assert.deepEqual(plain(hexagram.lines), hexagram.binary.split('').reverse().map(Number), hexagram.chineseName + ' lines must run from bottom to top');
    const top = trigrams.find(trigram => trigram.number === hexagram.topTrigram);
    const bottom = trigrams.find(trigram => trigram.number === hexagram.bottomTrigram);
    assert.ok(top && bottom, hexagram.chineseName + ' requires two known trigrams');
    assert.equal(hexagram.binary, top.binary + bottom.binary, hexagram.chineseName + ' upper/lower trigram binaries');
    assert.deepEqual(plain(hexagram.lines.slice(0, 3)), plain(bottom.lines), hexagram.chineseName + ' lower three lines');
    assert.deepEqual(plain(hexagram.lines.slice(3)), plain(top.lines), hexagram.chineseName + ' upper three lines');
  }
});

test('canonical 乾、坤、屯、既濟、未濟 figures agree with independent reference fixtures', () => {
  const fixtures = [
    { number: 1, name: '乾', lines: [1,1,1,1,1,1], top: '乾', bottom: '乾' },
    { number: 2, name: '坤', lines: [0,0,0,0,0,0], top: '坤', bottom: '坤' },
    { number: 3, name: '屯', lines: [1,0,0,0,1,0], top: '坎', bottom: '震' },
    { number: 63, name: '既濟', lines: [1,0,1,0,1,0], top: '坎', bottom: '離' },
    { number: 64, name: '未濟', lines: [0,1,0,1,0,1], top: '離', bottom: '坎' }
  ];
  for (const fixture of fixtures) {
    const hexagram = data.iching.hexagrams.find(hex => hex.number === fixture.number);
    assert.equal(hexagram.chineseName, fixture.name);
    assert.deepEqual(plain(hexagram.lines), fixture.lines);
    assert.equal(data.iching.trigrams.find(trigram => trigram.number === hexagram.topTrigram).chineseName, fixture.top);
    assert.equal(data.iching.trigrams.find(trigram => trigram.number === hexagram.bottomTrigram).chineseName, fixture.bottom);
  }
});

test('all HTML scripts and linked assets exist locally and CSS has no remote runtime dependency', () => {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const resources = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    if (match[1].toLowerCase() === 'link' && /\brel\s*=\s*["'](?:canonical|alternate)["']/i.test(match[0])) continue;
    const attribute = match[1].toLowerCase() === 'script' ? 'src' : 'href';
    const reference = match[0].match(new RegExp('\\b' + attribute + '\\s*=\\s*["\x27]([^"\x27]+)["\x27]', 'i'));
    if (reference) resources.push(localAsset(reference[1], dist));
  }
  assert.ok(resources.length >= 10, 'The entry point references its complete local bundle');
  for (const asset of resources.filter(file => file.endsWith('.css'))) {
    const css = fs.readFileSync(asset, 'utf8');
    for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
      if (!match[2].startsWith('data:') && !match[2].startsWith('#')) localAsset(match[2], path.dirname(asset));
    }
    for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi)) localAsset(match[1], path.dirname(asset));
  }
});

test('pinned vendor manifest verifies every downloaded byte and both complete MIT notices', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'vendor-manifest.json'), 'utf8'));
  assert.equal(manifest.surveyjs_version, '3.2.2');
  assert.match(manifest.iching_commit, /^[a-f\d]{40}$/);
  assert.ok(Array.isArray(manifest.files));
  const files = new Set();
  for (const entry of manifest.files) {
    assert.equal(files.has(entry.file), false, 'Manifest must not repeat files');
    files.add(entry.file);
    assert.match(entry.sha256, /^[a-f\d]{64}$/);
    const asset = path.resolve(root, entry.file);
    const relative = path.relative(root, asset);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), 'Manifest paths stay inside the project');
    const bytes = fs.readFileSync(asset);
    assert.equal(bytes.length, entry.bytes, 'Vendor byte length changed: ' + entry.file);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256, 'Vendor SHA256 changed: ' + entry.file);
  }
  for (const file of ['dist/vendor/surveyjs/3.2.2/survey-core.min.css', 'dist/vendor/surveyjs/3.2.2/survey.core.min.js', 'dist/vendor/surveyjs/3.2.2/survey-js-ui.min.js', 'dist/vendor/surveyjs/3.2.2/traditional-chinese.min.js', 'dist/data/iching-source.json', 'dist/licenses/SurveyJS-MIT.txt', 'dist/licenses/i-ching-MIT.txt']) {
    assert.ok(files.has(file), 'Required vendor file must have provenance: ' + file);
  }
  for (const file of ['SurveyJS-MIT.txt', 'i-ching-MIT.txt']) {
    const license = fs.readFileSync(path.join(dist, 'licenses', file), 'utf8');
    assert.match(license, /Copyright/i);
    assert.match(license, /Permission is hereby granted, free of charge/i);
    assert.match(license, /The above copyright notice and this permission notice/i);
    assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/i);
    assert.match(license, /LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE/i);
  }
});
