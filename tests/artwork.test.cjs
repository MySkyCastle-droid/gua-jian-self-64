'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const context = {window:{GuaData:{}}};
vm.createContext(context);
for (const file of ['mapping','reports-a','reports-b','artwork']) vm.runInContext(fs.readFileSync(path.join(root,'dist/data',file+'.js'),'utf8'),context);
const data = context.window.GuaData;
const manifest = JSON.parse(fs.readFileSync(path.join(root,'art-direction/artwork-manifest.json'),'utf8'));
test('all 64 portraits belong to exactly the matching type and report',()=>{
  assert.equal(manifest.complete,true);
  assert.equal(manifest.count,64);
  assert.equal(Object.keys(data.artwork).length,64);
  assert.equal(new Set(manifest.images.map(p=>p.originalSha256)).size,64);
  assert.equal(new Set(manifest.images.map(p=>p.sha256)).size,64);
  for(let id=1;id<=64;id++){
    const p=data.artwork[id],record=manifest.images.find(p=>p.hexagramNumber===id);
    assert.ok(p && record,`portrait ${id}`);
    assert.equal(p.typeKey,data.reports[id].typeKey);
    assert.equal(data.mapping[p.typeKey],id);
    assert.equal(p.title,data.reports[id].title);
    assert.equal(p.src,`./assets/personality/hexagram-${String(id).padStart(2,'0')}.webp`);
    assert.ok(record.promptEnglish && record.conceptZh && record.reviewNotes);
    assert.ok(record.meaningSourcesURLs.every(url=>url.startsWith('https://zh.wikisource.org/')));
    assert.ok(record.imageInspirationURLs.every(url=>url.startsWith('https://www.metmuseum.org/')));
    assert.ok(!JSON.stringify(record).includes('C:\\Users\\'));
  }
});
test('every shipped portrait has a valid WebP file and the recorded hash',()=>{
  for(const p of manifest.images){
    const file=path.resolve(root,'dist',p.src.slice(2));
    assert.ok(file.startsWith(path.join(root,'dist')+path.sep));
    const bytes=fs.readFileSync(file);
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');
    assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.sha256);
    assert.equal(bytes.length,p.bytes);
    assert.ok(p.width>=1000 && p.width===p.height);
    assert.ok(bytes.length<1024*1024,'web asset remains portable');
  }
});
