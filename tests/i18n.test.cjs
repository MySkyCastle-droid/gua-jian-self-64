'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dist=path.join(__dirname,'../dist');
const localeCodes=['zh-Hant','zh-Hans','en','ja','ko','hi','th','id','de','fr','es'];
const translatedFields=['title','subtitle','summary','plainMeaning','pairing','strength','blindspot','reflection'];
const plain=value=>JSON.parse(JSON.stringify(value));
function data(){
 const window={};const box={window};vm.createContext(box);
 for(const file of ['data/questions.js','data/reports-a.js','data/reports-b.js','data/hexagrams.js','data/bank.js','data/artwork.js','data/question-copy.js','question-copy.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),box,{filename:file});
 return {window,box,D:window.GuaData};
}
function load(){
 const loaded=data();vm.runInContext(fs.readFileSync(path.join(dist,'i18n.js'),'utf8'),loaded.box,{filename:'i18n.js'});
 const api=loaded.window.GuaI18n;assert.ok(api,'GuaI18n is available without a browser DOM');
 for(const locale of ['zh-Hans','en','ja'])api.register(locale,JSON.parse(fs.readFileSync(path.join(dist,'locales',locale+'.json'),'utf8')));
 return {...loaded,api};
}
function pack(locale){return JSON.parse(fs.readFileSync(path.join(dist,'locales',locale+'.json'),'utf8'));}
function sourceItems(D){
 const items=D.questionCopy.items.map(q=>({label:q.seedId,text:q.text}));
 for(const [id,r]of Object.entries(D.reports)){
  for(const field of translatedFields)items.push({label:'report '+id+'.'+field,text:r[field]});
  r.advice.forEach((text,index)=>items.push({label:'report '+id+'.advice.'+index,text}));
 }
 return items;
}

test('eleven supported locales expose an explicit locale and stable translator API',()=>{
 const {api}=load();assert.equal(api.VERSION,'i18n-v2-auto1');assert.deepEqual(plain(api.LOCALES),localeCodes);
 assert.equal(typeof api.translate,'function');assert.equal(typeof api.apply,'function');assert.equal(typeof api.setLocale,'function');
 assert.equal(api.locale(),'zh-Hant');assert.equal(api.translate('非常不像我','zh-Hant'),'非常不像我');
 assert.equal(api.translate('ENTJ · TWOBU · 2026','en'),'ENTJ · TWOBU · 2026');
});

test('all three translation packs contain all 288 direct questions and every field of all 64 reports',()=>{
 const {D}=data(),items=sourceItems(D);
 assert.equal(D.questionCopy.items.length,288);assert.equal(Object.keys(D.reports).length,64);assert.equal(items.length,992);
 for(const locale of ['zh-Hans','en','ja']){
  const p=pack(locale);assert.equal(p.locale,locale);assert.equal(p.version,'i18n-v1');
  assert.ok(p.messages&&typeof p.messages==='object');
  const missing=items.filter(item=>!Object.hasOwn(p.messages,item.text)||typeof p.messages[item.text]!=='string'||!p.messages[item.text].trim());
  assert.equal(missing.length,0,locale+' contains complete original question and report translations: '+JSON.stringify(Array.from(missing,item=>item.label)));
 }
});

test('exact question and full report strings resolve to their editorial translations without fragment damage',()=>{
 const {api,D}=load(),items=sourceItems(D);
 for(const locale of ['zh-Hans','en','ja']){
  const p=pack(locale);
  for(const item of items)assert.equal(api.translate(item.text,locale),p.messages[item.text],locale+' '+item.label);
 }
});

test('five answer strengths and neutral remain separate, translated display labels',()=>{
 const {api}=load(),labels=['非常不像我','比較不像我','介於兩者','比較像我','非常像我'];
 for(const locale of localeCodes){const values=labels.map(label=>api.translate(label,locale));assert.equal(new Set(values).size,5,locale+' retains five distinct choices');assert.ok(values.every(value=>typeof value==='string'&&value.trim()));}
});

test('Simplified Chinese translations contain no malformed Unicode, unexpected Hangul, or NUL output',()=>{
 const p=pack('zh-Hans');
 for(const [source,value]of Object.entries(p.messages)){
  assert.doesNotMatch(value,/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\ufffd\u0000]/u,'Malformed Simplified Chinese output: '+source.slice(0,40));
 }
 for(const [source,value]of Object.entries(p.characters||{}))assert.doesNotMatch(String(value),/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\ufffd\u0000]/u,'Malformed Simplified Chinese character map: '+source);
});

test('Simplified Chinese uses phrase-aware Mainland wording and preserves the cultural Qian name',()=>{
 const {api}=load();
 const fixtures={'圖鑑':'图鉴','之後':'之后','介於兩者':'介于两者','計畫':'计划','資訊':'信息','乾':'乾','乾卦':'乾卦','乾為天':'乾为天','乾淺水池':'干浅水池'};
 for(const [source,expected]of Object.entries(fixtures))assert.equal(api.translate(source,'zh-Hans'),expected,source);
 assert.equal(api.translate('藝術圖鑑之後','zh-Hans'),'艺术图鉴之后');
 assert.equal(api.translate('資訊圖鑑之後','zh-Hans'),'信息图鉴之后');
 assert.ok(fs.readFileSync(path.join(dist,'licenses/OpenCC-Apache-2.0.txt'),'utf8').includes('Apache License'));
});

test('registering and applying language display leaves canonical data and repeatable question opening keys unchanged',()=>{
 const loaded=data();const before=JSON.stringify(loaded.D),questionsBefore=plain(loaded.window.GuaQuestionCopy.catalog());
 vm.runInContext(fs.readFileSync(path.join(dist,'i18n.js'),'utf8'),loaded.box,{filename:'i18n.js'});
 const api=loaded.window.GuaI18n;
 for(const locale of ['zh-Hans','en','ja']){api.register(locale,pack(locale));for(const item of sourceItems(loaded.D))api.translate(item.text,locale);}
 assert.equal(JSON.stringify(loaded.D),before);
 assert.deepEqual(plain(loaded.window.GuaQuestionCopy.catalog()),questionsBefore);
 assert.equal(loaded.window.GuaQuestionCopy.VERSION,'direct-v1');
});

test('translation packs preserve classical quotations and use plain text rather than executable UI or placeholders',()=>{
 const {D}=data();
 for(const locale of ['zh-Hans','en','ja']){
  const p=pack(locale);
  for(const r of Object.values(D.reports))assert.ok(!Object.hasOwn(p.messages,r.quote)||p.messages[r.quote]===r.quote,locale+' retains the original classical quotation');
  for(const [source,value]of Object.entries(p.messages)){
   assert.equal(typeof value,'string',locale+' '+source.slice(0,30));assert.ok(value.trim(),locale+' has no blank text');
   assert.doesNotMatch(value,/<\s*(?:script|iframe|img|svg|a|button)\b/i);assert.doesNotMatch(value,/\bTODO\b|\[TRANSLATE\]|\[待翻譯\]/i);
  }
 }
});

test('language selection is a named native select with eleven public query-language links and local assets',()=>{
 const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
 assert.match(html,/<select\b[^>]*id=["']language-select["']/i);
 for(const locale of localeCodes)assert.match(html,new RegExp('value=["\']'+locale+'["\']'));
 assert.match(html,/i18n\.js/);assert.match(html,/i18n\.css/);
 assert.doesNotMatch(html,/translate\.google|translate\.bing|unpkg\.com|cdn\.jsdelivr/i);
});
