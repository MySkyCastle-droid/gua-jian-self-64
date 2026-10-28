'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist'),codes=['zh-Hant','zh-Hans','en','ja'],plain=x=>JSON.parse(JSON.stringify(x));
function load(localized=false){
 const box={window:{}};vm.createContext(box);vm.runInContext('Math.random=function(){throw new Error("Unseeded random call");}',box);
 for(const file of ['data/questions.js','data/mapping.js','data/bank.js','data/reports-a.js','data/reports-b.js','data/artwork.js','core.js','bank.js','short.js','full.js','data/question-copy.js','question-copy.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),box,{filename:file});
 if(localized){vm.runInContext(fs.readFileSync(path.join(dist,'i18n.js'),'utf8'),box,{filename:'i18n.js'});for(const code of codes.slice(1))box.window.GuaI18n.register(code,JSON.parse(fs.readFileSync(path.join(dist,'locales',code+'.json'),'utf8')));}
 return box.window;
}
const opts={wording:'direct-v1'};
async function finish(w,mode,seed,policy,switchLanguages=false){
 const e=mode===48?w.GuaFull:w.GuaShort;let session=mode===48?e.create(seed,opts):e.create(mode,seed,opts),trace=[];
 for(let index=0;index<mode+6&&!e.score(session).finished;index++){
  const q=e.questions(session)[index];assert.ok(q);
  if(switchLanguages){assert.equal(await w.GuaI18n.setLocale(codes[index%4]),true);const copy=w.GuaQuestionCopy.render(q);assert.ok(w.GuaI18n.translate(copy.text).trim());assert.equal(w.GuaQuestionCopy.render(q).openingKey,copy.openingKey);}
  const value=policy==='neutral'?0:policy==='positive'?q.direction*2:policy==='negative'?-q.direction*2:policy==='mixed'?[-2,-1,0,1,2][index%5]:q.direction*(q.axis==='emotion'||q.axis==='decision'?-1:1)*(index%2+1);
  trace.push({id:q.id,seedId:q.seedId,axis:q.axis,direction:q.direction,value});session=e.answer(session,mode===48?q.id:index,value);
  if(index===Math.floor(mode/2))session=e.restore(plain(session));
 }
 const score=e.score(session);assert.equal(score.finished,true);return{trace:plain(trace),session:plain(session),score:plain(score)};
}
test('independent seeded replay stays identical before/after locale registration and mid-answer language changes',async()=>{
 const baseline=load(),localized=load(true),before=JSON.stringify(localized.GuaData);
 for(const mode of [10,20,48])for(const seed of [0,27,2130268903,4294967295])for(const policy of ['neutral','positive','negative','mixed','axis-pattern']){
  const expected=await finish(baseline,mode,seed,policy),actual=await finish(localized,mode,seed,policy,true);
  assert.deepEqual(actual.trace,expected.trace,mode+'/'+seed+'/'+policy+' IDs/polarity/answers');assert.deepEqual(actual.score,expected.score,mode+'/'+seed+'/'+policy+' all scores and candidates');assert.deepEqual(actual.session,expected.session,mode+'/'+seed+'/'+policy+' serialized continuation');
 }
 assert.equal(JSON.stringify(localized.GuaData),before,'canonical bank, report and wording data never mutate');
});
test('all-neutral 10/20/48 finish at 16/26/54 and keep 64 candidates without a forced category',async()=>{
 for(const mode of [10,20,48]){
  const w=load(true),result=await finish(w,mode,1888320027,'neutral',true),s=result.score;
  assert.equal(result.trace.length,mode+6);assert.equal(s.answered,mode+6);assert.equal(s.finished,true);assert.equal(s.complete,false);assert.equal(s.allNeutral,true);assert.equal(s.resultKey,null);assert.equal(s.mainAnswered,mode);assert.equal(s.clarificationAnswered,6);assert.deepEqual(s.candidateHexagramIds,Array.from({length:64},(_,i)=>i+1));
  for(const axis of Object.values(s.scores)){assert.equal(axis.sum,0);assert.equal(axis.side,null);}
 }
});
test('dynamic display keeps balanced, single-item and clarification-led evidence distinct',()=>{
 const w=load(true),t=(text,code='en')=>w.GuaI18n.translate(text,code),sources=['這個面向暫時保持開放。','這次回答還沒有讓其中一端比較明顯，先不替你選邊。','這個面向只來自一道題，先把它當成一個小線索。','這個方向主要由補充情境的回答帶出，還需要更多生活觀察。','你的回答同時支持兩種做法；可以回想哪些情境讓你做出不同選擇。'];
 for(const code of ['en','ja']){const outputs=sources.map(s=>t(s,code));assert.equal(new Set(outputs).size,sources.length);outputs.forEach((v,i)=>assert.notEqual(v,sources[i]));}
 assert.equal(t('本次觀察：1 題'),'Based on 1 question this time');assert.equal(t('本次觀察：9 題'),'Based on 9 questions this time');
 assert.equal(t('主要問題已答 4／10 題・必要時另加 0–6 題補充情境，合計 10–16 題'),'Main questions: 4/10. Up to 6 follow-ups if needed; 10–16 in total.');
 assert.equal(t('主要問題已答 20／20 題・補充情境已答 3／6 題・本次共 26 題'),'Main: 20/20; follow-ups: 3/6; 26 questions in total.');
 assert.match(t('共 64 篇，依文王卦序排列，沒有先後名次。點開一篇，看看它帶你想起什麼。'),/64 compatible articles.*without ranking/);assert.match(t('介於兩者'),/in between/i);
});
test('288 English prompts retain twelve polarity families and 64 report passages remain differentiated',()=>{
 const w=load(true),groups=new Map();
 for(const q of w.GuaQuestionCopy.catalog()){
  const key=q.axis+'/'+q.direction,list=groups.get(key)||[];list.push(q);groups.set(key,list);const text=w.GuaI18n.translate(q.text,'en');assert.notEqual(text,q.text);assert.doesNotMatch(text,/[\u3400-\u9fff]/);
  const seed=w.GuaData.bank.seeds.find(s=>s.id===q.seedId);assert.equal(q.axis,seed.axis);assert.equal(q.direction,seed.direction);
 }
 assert.equal(groups.size,12);for(const [key,items]of groups){assert.equal(items.length,24,key);assert.equal(new Set(items.map(q=>w.GuaI18n.translate(q.text,'en'))).size,24,key+' unique English formulations');}
 for(const field of ['title','summary','plainMeaning','pairing','strength','blindspot','reflection'])assert.equal(new Set(Object.values(w.GuaData.reports).map(r=>w.GuaI18n.translate(r[field],'en'))).size,64,field+' has 64 distinct passages');
});
