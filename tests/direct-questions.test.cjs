'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
function load() {
  const box = { window: {} }; vm.createContext(box);
  vm.runInContext('Math.random = function () { throw new Error("Unseeded randomness"); };', box);
  for (const file of ['data/questions.js','data/mapping.js','data/bank.js','core.js','bank.js','short.js','full.js','data/question-copy.js','question-copy.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), box, {filename:file});
  }
  return box.window;
}
const w = load();
const {GuaData:D, GuaBank:Bank, GuaShort:Short, GuaFull:Full, GuaQuestionCopy:Copy} = w;
const opts = {wording:'direct-v1'};
const axisIds = D.axes.map(axis => axis.id);
const open = text => text.split(/[，。；：！？]/)[0].normalize('NFKC').replace(/[\s\p{P}]/gu, '');
test.afterEach(() => { w.GuaQuestionCopy = Copy; });
function start(mode, seed=82027) { return mode===48 ? Full.create(seed,opts) : Short.create(mode,seed,opts); }
function engine(mode) { return mode===48 ? Full : Short; }
function answer(mode, session, index, value) {
  const e=engine(mode), question=e.questions(session)[index];
  return e.answer(session,mode===48 ? question.id : index,value);
}
function finish(mode, respond) {
  const e=engine(mode); let session=start(mode);
  for(let index=0; index<mode+6 && !e.score(session).finished; index++) {
    const q=e.questions(session)[index]; session=answer(mode,session,index,respond(q,index));
    if(index===Math.floor(mode/2)) session=e.restore(plain(session));
  }
  return session;
}
function unique(mode, session) {
  const items=engine(mode).questions(session);
  for(const field of ['id','family','semanticCluster']) assert.equal(new Set(items.map(q=>q[field])).size,items.length,field);
  assert.equal(new Set(items.map(q=>Copy.render(q).openingKey)).size,items.length,'real first clauses do not repeat');
  for(const q of items) {
    const rendered=Copy.render(q);
    assert.equal(rendered.openingKey,open(rendered.text));
    assert.equal(q.text,Bank.query({offset:Number(q.id.slice(2))-1,limit:1}).items[0].text,'raw bank wording is unchanged');
  }
  return items;
}

test('direct copy covers 288 traced seeds and derives keys from actual sentence clauses',()=>{
  const catalog=Copy.catalog(); assert.equal(catalog.length,288);
  assert.equal(new Set(catalog.map(q=>q.seedId)).size,288);
  assert.equal(new Set(catalog.map(q=>q.text)).size,288);
  assert.ok(new Set(catalog.map(q=>q.openingKey)).size>=54);
  for(const q of catalog) {
    assert.equal(q.openingKey,open(q.text));
    assert.notEqual(q.openingKey,q.seedId);
    assert.doesNotMatch(q.text,/你對相關背景已有一些了解|^情境[：:]|你有機會依照自己的習慣回應/);
    assert.ok(q.sourceIds.length);
  }
});

test('new parameters use versioned six-field short and nine-field full sessions',()=>{
  for(const mode of [10,20]) {
    const session=start(mode);
    assert.equal(session.version,'2.1.0');
    assert.deepEqual(Object.keys(session).sort(),['answers','bankVersion','mode','questionIds','seed','version']);
    assert.deepEqual(plain(Short.restore(plain(session))),plain(session));
  }
  const full=start(48); assert.equal(full.formOrigin,'direct-v1'); assert.equal(full.version,Full.VERSION);
  assert.deepEqual(Object.keys(full).sort(),['answers','bankVersion','clarificationAnswers','clarificationIds','formOrigin','mode','questionIds','seed','version']);
  assert.deepEqual(plain(Full.restore(plain(full))),plain(full));
  for(const invalid of [null,{}, {wording:'other'},{wording:'direct-v1',extra:true}]) {
    assert.throws(()=>Short.create(10,12,invalid)); assert.throws(()=>Full.create(12,invalid)); assert.throws(()=>Bank.createForm(12,invalid));
  }
});

test('all five values remain legal and omitted or invalid answers are not neutral',()=>{
  for(const mode of [10,20,48]) {
    for(const value of [-2,-1,0,1,2]) {
      const e=engine(mode),session=start(mode),q=e.questions(session)[0],changed=answer(mode,session,0,value);
      assert.equal(e.score(changed).answered,1);
      assert.equal(e.score(changed).scores[q.axis].sum,value*q.direction);
      assert.equal(e.score(session).answered,0);
    }
    for(const value of [null,undefined,'0',3,-3,NaN])assert.throws(()=>answer(mode,start(mode),0,value));
  }
});

test('direct forms preserve balance, real source IDs, first-clause uniqueness and deterministic reloads',()=>{
  for(const seed of [0,1,82027,0xffffffff]) {
    const main=Bank.createForm(seed,opts);
    assert.equal(main.length,48);
    assert.equal(new Set(main.map(q=>Copy.render(q).openingKey)).size,48);
    for(const axis of axisIds)for(const direction of [-1,1])assert.equal(main.filter(q=>q.axis===axis&&q.direction===direction).length,4);
    assert.deepEqual(plain(main),plain(Bank.createForm(seed,opts)));
    for(const mode of [10,20,48]) {
      let s=start(mode,seed); const e=engine(mode);
      for(let i=0;i<7;i++)s=answer(mode,s,i,[2,0,-1,1,-2][i%5]);
      unique(mode,s);assert.deepEqual(plain(e.restore(plain(s))),plain(s));
    }
  }
});

test('all-neutral new forms finish at 16, 26 or 54 without assigning any personality',()=>{
  for(const mode of [10,20,48]) {
    const session=finish(mode,()=>0), score=engine(mode).score(session),items=unique(mode,session);
    assert.equal(items.length,mode+6);assert.equal(score.answered,mode+6);assert.equal(score.finished,true);
    assert.equal(score.complete,false);assert.equal(score.resultKey,null);assert.equal(score.hexagramId,null);
    assert.equal(score.candidateHexagramIds.length,64);assert.equal(score.allNeutral,true);
    assert.deepEqual(plain(score.unresolvedTies).sort(),plain(axisIds).sort());
  }
});

test('direct classified and one-open-axis results retain the original signed scoring and candidate rules',()=>{
  for(const mode of [10,20,48]) {
    const classified=finish(mode,q=>2*q.direction),score=engine(mode).score(classified);unique(mode,classified);
    assert.equal(score.finished,true);assert.equal(score.complete,true);assert.equal(score.type,'ESTJ');assert.equal(score.candidateHexagramIds.length,1);
    const partial=finish(mode,q=>q.axis==='energy'?0:2*q.direction),openScore=engine(mode).score(partial);unique(mode,partial);
    assert.equal(openScore.finished,true);assert.equal(openScore.complete,false);assert.equal(openScore.candidateHexagramIds.length,2);
    assert.deepEqual(plain(openScore.unresolvedTies),['energy']);
  }
});

test('editing direct answers retains the direct version and applies each engine’s existing invalidation rules',()=>{
  for(const mode of [10,20]) {
    const complete=finish(mode,()=>0),changed=answer(mode,complete,0,2);
    assert.equal(changed.version,'2.1.0');assert.equal(changed.answers.length,1);unique(mode,changed);
    assert.deepEqual(plain(Short.restore(plain(changed))),plain(changed));
  }
  const complete=finish(48,()=>0), first=Full.questions(complete)[0],changed=Full.answer(complete,first.id,2);
  assert.equal(changed.formOrigin,'direct-v1');assert.deepEqual(plain(changed.questionIds),plain(complete.questionIds));
  assert.equal(Object.keys(changed.answers).length,48);assert.deepEqual(plain(changed.clarificationAnswers),{});unique(48,changed);
});

test('direct paths reject missing copy or repeated sentence clauses instead of silently using old wording',()=>{
  w.GuaQuestionCopy=undefined;
  assert.throws(()=>start(10));assert.throws(()=>start(20));assert.throws(()=>start(48));assert.throws(()=>Bank.createForm(4,opts));
  w.GuaQuestionCopy={has:id=>id!==D.bank.seeds[0].id,render:Copy.render};
  assert.throws(()=>start(10));assert.throws(()=>start(48));
  w.GuaQuestionCopy={has:Copy.has,render:item=>({text:'同一個開場，'+Copy.render(item).text,openingKey:'同一個開場'})};
  assert.throws(()=>Bank.createForm(4,opts));assert.throws(()=>start(48));
  const short=start(10);assert.throws(()=>Short.answer(short,0,2),/不重複/);
});

test('legacy default APIs and saved forms still work without the new copy module',()=>{
  const before={main:Bank.createForm(12345).map(q=>q.id),short:Short.create(20,12345),full:Full.create(12345)};
  w.GuaQuestionCopy=undefined;
  assert.deepEqual(plain(Bank.createForm(12345).map(q=>q.id)),plain(before.main));
  assert.deepEqual(plain(Short.restore(plain(before.short))),plain(before.short));
  assert.deepEqual(plain(Full.restore(plain(before.full))),plain(before.full));
  assert.equal(before.short.version,'2.0.0');assert.equal(before.full.formOrigin,'seed');
  assert.ok(Short.questions(before.short)[0].text.startsWith('情境：'));
});
