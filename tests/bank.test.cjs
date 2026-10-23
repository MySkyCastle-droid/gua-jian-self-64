'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const readline = require('node:readline');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['data/questions.js', 'data/mapping.js', 'data/bank.js', 'core.js', 'bank.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), sandbox, { filename: file });
}
const { GuaData: D, GuaCore: Core, GuaBank: Bank } = sandbox.window;
const B = D.bank;
const plain = value => JSON.parse(JSON.stringify(value));
const originalArchive = JSON.parse(fs.readFileSync(path.join(root, 'research', 'source-items.json'), 'utf8'));
const sourceById = new Map(originalArchive.items.map(item => [item.id, item]));
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const typeKeys = Object.keys(D.mapping).sort();

function endpoint(typeKey, axis) {
  const [type, emotion, coordination] = typeKey.split('-');
  const positives = { energy: 'E', information: 'S', decision: 'T', organization: 'J', emotion: 'calm', coordination: 'autonomous' };
  const value = ['energy', 'information', 'decision', 'organization'].includes(axis) ? type[['energy', 'information', 'decision', 'organization'].indexOf(axis)] : axis === 'emotion' ? emotion : coordination;
  return value === positives[axis] ? 1 : -1;
}
function verifyForm(form) {
  assert.equal(form.length, 48);
  assert.equal(new Set(form.map(q => q.id)).size, 48);
  assert.equal(new Set(form.map(q => q.family)).size, 48, 'A semantic family must not repeat in a single form');
  assert.equal(new Set(form.map(q => q.semanticCluster)).size, 48, 'Near-synonyms must not repeat even across opposing endpoints');
  for (const axis of D.axes) {
    for (const direction of [1, -1]) {
      assert.equal(form.filter(q => q.axis === axis.id && q.direction === direction).length, 4);
      for (let chapter = 1; chapter <= 4; chapter++) assert.equal(form.filter(q => q.chapter === chapter && q.axis === axis.id && q.direction === direction).length, 1);
    }
  }
  form.forEach((q, index) => {
    assert.match(q.id, /^QB\d{6}$/);
    assert.equal(q.chapter, Math.floor(index / 12) + 1);
    assert.ok(q.chapterTitle);
    const number = Number(q.id.slice(2));
    const item = Bank.query({ offset: number - 1, limit: 1 }).items[0];
    for (const field of ['id', 'text', 'axis', 'direction', 'family', 'semanticCluster', 'contextId', 'seedId', 'seedText', 'adaptationNote']) assert.equal(q[field], item[field], 'Selected questions must be real members of the finite pool');
    assert.deepEqual(plain(q.sourceIds), plain(item.sourceIds));
  });
}

test('the bank separates 3370 real source items, 288 seed families, and 100000 derivatives', () => {
  const stats = Bank.stats();
  assert.equal(stats.sourceCount, 3370);
  assert.equal(stats.seedCount, 288);
  assert.equal(stats.count, 100000);
  assert.equal(stats.semanticClusterCount, new Set(B.seeds.map(seed => seed.semanticCluster)).size);
  assert.equal(stats.semanticClusterCount, B.semanticClusterCount);
  assert.equal(stats.semanticClusterCount, 277);
  assert.equal(B.version, '2.1.0');
  assert.equal(sourceById.size, 3370);
  assert.deepEqual(plain(B.sourceCounts), { 'ipip-ori': 3320, 'tipi-gosling': 10, 'minimarkers-saucier': 40 });
  assert.equal(new Set(B.seeds.map(seed => seed.id)).size, 288);
  assert.equal(new Set(B.seeds.map(seed => seed.family)).size, 288);
  assert.equal(new Set(B.seeds.map(seed => normalize(seed.text))).size, 288);
  for (const seed of B.seeds) {
    assert.ok(typeof seed.semanticCluster === 'string' && seed.semanticCluster);
    assert.ok(seed.sourceIds.length > 0 && seed.adaptationNote);
    for (const parentId of seed.sourceIds) {
      const original = sourceById.get(parentId);
      assert.ok(original, 'Seed parent exists: ' + parentId);
      assert.ok(!original.review.status.startsWith('excluded'), 'Clinical or excluded parent cannot seed the runtime bank');
      const catalog = B.sources.find(source => source.id === parentId);
      assert.ok(catalog);
      for (const key of ['text', 'sourceId', 'source', 'license', 'licenseSource']) assert.equal(catalog[key], original[key]);
    }
  }
  assert.equal(Bank.query({ limit: 0 }).total, 100000);
});

test('twelve buckets use the agreed quotas and cover stable QB000001..QB100000 without gaps', () => {
  assert.equal(B.buckets.length, 12);
  let expectedStart = 1;
  B.buckets.forEach((bucket, index) => {
    const axis = D.axes[Math.floor(index / 2)].id;
    assert.equal(bucket.axis, axis);
    assert.equal(bucket.direction, index % 2 === 0 ? 1 : -1);
    assert.equal(bucket.count, index < 4 ? 8334 : 8333);
    assert.equal(bucket.start, expectedStart);
    assert.equal(bucket.capacity, 24 * 29 * 12);
    assert.equal(bucket.seedIds.length, 24);
    assert.deepEqual(plain(bucket.seedIds), plain(bucket.seedIds).sort());
    const boundary = Bank.query({ offset: expectedStart - 1, limit: 1 }).items[0];
    assert.equal(boundary.axis, axis);
    assert.equal(boundary.direction, bucket.direction);
    assert.equal(boundary.id, 'QB' + String(expectedStart).padStart(6, '0'));
    expectedStart += bucket.count;
  });
  assert.equal(expectedStart, 100001);
  assert.equal(Bank.query({ offset: 99999, limit: 5 }).items[0].id, 'QB100000');
  assert.equal(Bank.query({ offset: 100000, limit: 5 }).items.length, 0);
  assert.deepEqual(plain(Bank.query({ offset: 8333, limit: 3 }).items.map(q => q.id)), ['QB008334', 'QB008335', 'QB008336']);
});

test('the full 100000-line archive is materialized, normalized-unique, and identical to paginated runtime results', async () => {
  const file = path.join(root, 'question-bank', 'derived-items.jsonl');
  assert.ok(fs.statSync(file).size > 10_000_000, 'A full archive must contain actual items rather than a count-only placeholder');
  const reader = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  let index = 0;
  let batch = [];
  const uniqueTexts = new Set();
  const counts = new Map();
  for await (const line of reader) {
    assert.ok(line.trim());
    const item = JSON.parse(line);
    if (index % 1000 === 0) batch = Bank.query({ offset: index, limit: Math.min(1000, 100000 - index) }).items;
    assert.deepEqual(item, plain(batch[index % 1000]), 'Materialized item and compact runtime disagree at offset ' + index);
    assert.equal(item.id, 'QB' + String(index + 1).padStart(6, '0'));
    const norm = normalize(item.text);
    assert.ok(!uniqueTexts.has(norm), 'Normalized duplicate text: ' + item.id);
    uniqueTexts.add(norm);
    counts.set(item.axis + '/' + item.direction, (counts.get(item.axis + '/' + item.direction) || 0) + 1);
    index++;
  }
  assert.equal(index, 100000);
  assert.equal(uniqueTexts.size, 100000);
  for (const bucket of B.buckets) assert.equal(counts.get(bucket.axis + '/' + bucket.direction), bucket.count);
});

test('all 3370 original-item archive lines retain their original IDs, wording, license, and scale keys', async () => {
  const reader = readline.createInterface({ input: fs.createReadStream(path.join(root, 'question-bank', 'original-items.jsonl'), { encoding: 'utf8' }), crlfDelay: Infinity });
  const ids = new Set();
  for await (const line of reader) {
    const item = JSON.parse(line);
    assert.ok(!ids.has(item.id));
    ids.add(item.id);
    assert.deepEqual(item, sourceById.get(item.id));
  }
  assert.equal(ids.size, 3370);
});

test('64 type routes are reachable, each agreement direction supports exactly 32 types, and filters preserve meaning', () => {
  const routing = JSON.parse(fs.readFileSync(path.join(root, 'question-bank', 'routing-index.json'), 'utf8'));
  assert.deepEqual(Object.keys(routing.routes).sort(), typeKeys);
  for (const key of typeKeys) {
    const route = routing.routes[key];
    assert.equal(route.total, 50000);
    assert.equal(route.ranges.length, 6);
    assert.equal(Bank.query({ typeKey: key, limit: 0 }).total, route.total);
    for (const axis of D.axes) {
      const filtered = Bank.query({ typeKey: key, axis: axis.id, limit: 1 });
      assert.equal(filtered.items.length, 1);
      assert.equal(filtered.items[0].direction, endpoint(key, axis.id));
      assert.equal(filtered.items[0].axis, axis.id);
      const range = route.ranges.find(range => range.axis === axis.id);
      assert.equal(filtered.total, range.count);
      assert.equal(filtered.items[0].id, 'QB' + String(range.start).padStart(6, '0'));
    }
  }
  for (const bucket of B.buckets) {
    const item = Bank.query({ offset: bucket.start - 1, limit: 1 }).items[0];
    const supported = Bank.supportedTypes(item);
    assert.equal(supported.length, 32);
    assert.equal(new Set(supported).size, 32);
    for (const key of supported) assert.equal(endpoint(key, item.axis), item.direction);
  }
});

test('seeded forms reproduce their exact questions and vary across seeds with balanced unique families', () => {
  const first = Bank.createForm(123456789);
  assert.deepEqual(plain(first), plain(Bank.createForm(123456789)));
  assert.notDeepEqual(plain(first.map(q => q.id)), plain(Bank.createForm(123456790).map(q => q.id)));
  for (const seed of [0, 1, 2, 17, 123456789, 4294967295]) verifyForm(Bank.createForm(seed));
  // Many independent forms exercise quota truncation, family selection and the PRNG.
  for (let seed = 10; seed < 210; seed++) {
    const form = Bank.createForm(seed);
    assert.equal(form.length, 48);
    assert.equal(new Set(form.map(q => q.family)).size, 48);
    assert.equal(new Set(form.map(q => q.semanticCluster)).size, 48);
    for (const axis of D.axes) for (const direction of [1, -1]) assert.equal(form.filter(q => q.axis === axis.id && q.direction === direction).length, 4);
  }
});

test('restoring validates exact IDs and returns the original questions; activation canonicalizes objects', () => {
  const original = Bank.createForm(9876);
  const ids = plain(original.map(q => q.id));
  const snapshot = JSON.stringify(ids);
  assert.deepEqual(plain(Bank.restoreForm(ids)), plain(original));
  assert.equal(JSON.stringify(ids), snapshot);
  const spoofed = plain(original);
  spoofed[0].text = 'altered question';
  spoofed[0].direction *= -1;
  Bank.activate(spoofed);
  assert.deepEqual(plain(D.questions), plain(original), 'Only canonical pool objects may become active questions');
  const answers = Object.fromEntries(D.questions.map(q => [q.id, q.direction * 2]));
  const score = Core.score(answers);
  assert.equal(score.complete, true);
  assert.equal(score.answered, 48);
  assert.equal(score.resultKey, 'ESTJ-calm-autonomous');
  assert.equal(score.hexagramId, 34);
  for (const axis of D.axes) assert.equal(score.scores[axis.id].sum, 16);
});

test('illegal, duplicate, incomplete, and unbalanced restored forms are rejected', () => {
  const ids = plain(Bank.createForm(7).map(q => q.id));
  assert.throws(() => Bank.restoreForm(ids.slice(1)));
  assert.throws(() => Bank.restoreForm([...ids, ids[0]]));
  assert.throws(() => Bank.restoreForm([ids[0], ...ids.slice(0, 47)]));
  for (const illegal of ['QB000000', 'QB100001', 'QB00001', 'q01', '__proto__', null, 1]) {
    const corrupt = ids.slice(); corrupt[0] = illegal;
    assert.throws(() => Bank.restoreForm(corrupt));
  }
  const wrongChapter = ids.slice();
  const other = wrongChapter[0]; wrongChapter[0] = wrongChapter[13]; wrongChapter[13] = other;
  assert.throws(() => Bank.restoreForm(wrongChapter));
  assert.throws(() => Bank.restoreForm(Bank.query({ limit: 48 }).items.map(q => q.id)));
  assert.throws(() => Bank.activate(null));
  for (const seed of [-1, 1.5, NaN, Infinity, 4294967296, '3']) assert.throws(() => Bank.createForm(seed));
  for (const options of [{ axis: 'invalid' }, { typeKey: 'ESTJ-invalid' }, { offset: -1 }, { offset: 0.5 }, { limit: -1 }, { limit: 1001 }]) assert.throws(() => Bank.query(options));
});

test('shared semantic clusters remain exclusive across seeds and restored opposite directions', () => {
  const clusters = new Map();
  for (const seed of B.seeds) {
    if (!clusters.has(seed.semanticCluster)) clusters.set(seed.semanticCluster, []);
    clusters.get(seed.semanticCluster).push(seed);
  }
  const shared = [...clusters.entries()].filter(([, members]) => members.length > 1);
  assert.equal(shared.length, 4, 'Four reviewed near-synonym groups must be represented');
  assert.ok(shared.some(([, members]) => new Set(members.map(seed => seed.direction)).size === 2), 'The fixture must include groups spanning positive and negative items');
  for (let seed = 500; seed < 1000; seed++) {
    const form = Bank.createForm(seed);
    assert.equal(new Set(form.map(q => q.semanticCluster)).size, 48);
  }
  for (const [cluster, members] of shared) {
    let original;
    for (let seed = 0; seed < 100 && !original; seed++) {
      const form = Bank.createForm(seed);
      if (form.some(q => q.semanticCluster === cluster)) original = form;
    }
    assert.ok(original, 'A shared cluster is reachable by normal form selection');
    const retained = original.find(q => q.semanticCluster === cluster);
    // Prefer an opposing endpoint; the preorder-only group uses another chapter.
    const sibling = members.find(seed => seed.direction !== retained.direction) || members.find(seed => seed.id !== retained.seedId);
    const bucket = B.buckets.find(bucket => bucket.axis === sibling.axis && bucket.direction === sibling.direction);
    const siblingId = 'QB' + String(bucket.start + bucket.seedIds.indexOf(sibling.id)).padStart(6, '0');
    const target = original.findIndex(q => q.axis === sibling.axis && q.direction === sibling.direction && (sibling.direction !== retained.direction ? q.chapter === retained.chapter : q.chapter !== retained.chapter));
    assert.ok(target >= 0);
    const alteredIds = plain(original.map(q => q.id));
    alteredIds[target] = siblingId;
    assert.equal(new Set(alteredIds).size, 48, 'Semantic duplicate fixture keeps unique question IDs');
    assert.throws(() => Bank.restoreForm(alteredIds), /近義群組/, 'A distinct family with the same meaning must be rejected on restore');
  }
});

test('manifest hashes cover actual materialized outputs and the exact source, seed and context inputs', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'question-bank', 'manifest.json'), 'utf8'));
  assert.equal(manifest.derivedCount, 100000);
  assert.equal(manifest.uniqueNormalizedDerivedCount, 100000);
  assert.equal(manifest.sourceCount, 3370);
  assert.equal(manifest.familyCount, 288);
  assert.equal(manifest.version, '2.1.0');
  assert.equal(manifest.semanticClusterCount, B.semanticClusterCount);
  assert.ok(fs.statSync(path.join(root, 'dist', 'data', 'bank.js')).size < 500000, 'The site ships the compact recipe rather than the full 100000-item archive');
  for (const [file, expectedHash] of Object.entries(manifest.inputs)) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    assert.equal(hash, expectedHash, 'Bank input changed after build: ' + file);
  }
  for (const entry of manifest.outputs) {
    const file = path.join(root, entry.file);
    assert.equal(fs.statSync(file).size, entry.bytes);
    const hash = crypto.createHash('sha256');
    for await (const bytes of fs.createReadStream(file)) hash.update(bytes);
    assert.equal(hash.digest('hex'), entry.sha256, 'Bank output changed after build: ' + entry.file);
  }
});
