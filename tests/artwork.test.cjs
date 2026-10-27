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
    assert.equal(p.src,`./assets/personality/twobu/hexagram-${String(id).padStart(2,'0')}.webp`);
    assert.ok(record.promptEnglish && record.conceptZh && record.reviewNotes);
    assert.ok(record.meaningSourcesURLs.every(url=>url.startsWith('https://zh.wikisource.org/')));
    assert.ok(record.imageInspirationURLs.every(url=>url.startsWith('https://www.metmuseum.org/')));
    assert.ok(!JSON.stringify(record).includes('C:\\Users\\'));
  }
});

test('public illustrations retain original provenance and ship only branded derivatives',()=>{
  assert.equal(manifest.watermark.version,'twobu-corners-v3');
  assert.equal(manifest.images[0].sha256,manifest.watermark.approvedSample.sha256,'first portrait matches approved option A byte for byte');
  const logo=manifest.watermark.logo;
  const logoBytes=fs.readFileSync(path.resolve(root,'dist',logo.src.slice(2)));
  assert.equal(crypto.createHash('sha256').update(logoBytes).digest('hex'),logo.sha256);
  assert.equal(logoBytes.length,logo.bytes);
  assert.match(logo.sourceSha256,/^[a-f0-9]{64}$/);
  for(const p of manifest.images){
    const d=p.derivative;
    assert.equal(data.artwork[p.hexagramNumber].derivativeVersion,manifest.watermark.version);
    assert.equal(d.logoSha256,logo.sha256);
    assert.equal(d.logoSourceSha256,logo.sourceSha256);
    assert.equal(d.logoSrc,logo.src);
    assert.notEqual(d.sourceWebp.sha256,p.sha256);
    assert.equal(fs.existsSync(path.resolve(root,'dist',d.sourceWebp.src.slice(2))),false,'unbranded files are absent from the current public tree');
    const size=Math.round(p.width*.04),margin=Math.round(p.width*.025);
    assert.deepEqual(d.corners,[
      {corner:'top-left',left:margin,top:margin,width:size,height:size},
      {corner:'top-right',left:p.width-margin-size,top:margin,width:size,height:size},
      {corner:'bottom-left',left:margin,top:p.height-margin-size,width:size,height:size},
      {corner:'bottom-right',left:p.width-margin-size,top:p.height-margin-size,width:size,height:size}
    ]);
    const original=path.resolve(root,p.original);
    if(fs.existsSync(original)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex'),p.originalSha256,'private original is unchanged');
  }
  assert.equal(fs.readFileSync(path.join(root,'dist/data/artwork-sources.json'),'utf8'),fs.readFileSync(path.join(root,'art-direction/artwork-manifest.json'),'utf8'));
});

let sharp;
try{sharp=require('sharp');}catch{}
test('all 256 rendered corners visibly contain the supplied logo', {skip:!sharp && 'Sharp is an optional development-only pixel verifier'}, async()=>{
  const logoFile=path.resolve(root,'dist',manifest.watermark.logo.src.slice(2));
  for(const p of manifest.images){
    const file=path.resolve(root,'dist',p.src.slice(2));
    const size=Math.round(p.width*.04),margin=Math.round(p.width*.025);
    const expected=await sharp(logoFile).resize(size,size).flatten({background:'#ffffff'}).removeAlpha().raw().toBuffer();
    for(const [left,top] of [[margin,margin],[p.width-margin-size,margin],[margin,p.height-margin-size],[p.width-margin-size,p.height-margin-size]]){
      const pixels=await sharp(file).extract({left,top,width:size,height:size}).removeAlpha().raw().toBuffer();
      let sum=0;
      for(let index=0;index<pixels.length;index++) sum+=Math.abs(pixels[index]-expected[index]);
      assert.ok(sum/pixels.length<12,`portrait ${p.hexagramNumber} logo at ${left},${top} differs from supplied design`);
    }
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
