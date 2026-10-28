'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dist=path.join(__dirname,'../dist');
function helpers(){const window={};const box={window,URL};vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(dist,'i18n.js'),'utf8'),box,{filename:'i18n.js'});return window.GuaI18n;}

test('regional and case variants map to the eleven supported display locales',()=>{
 const api=helpers();
 for(const [input,expected]of [['EN-us','en'],['es-419','es'],['FR-ca','fr'],['de-AT','de'],['ja-JP','ja'],['ko-KR','ko'],['hi-IN','hi'],['th-TH','th'],['id-ID','id'],['in-ID','id'],['  en_GB  ','en'],['zh-TW','zh-Hant'],['ZH-hK','zh-Hant'],['zh-MO','zh-Hant'],['zh-CN','zh-Hans'],['zh-SG','zh-Hans'],['zh','zh-Hans']])assert.equal(api.matchLocale(input),expected,input);
 assert.equal(api.VERSION,'i18n-v2-auto1');
});

test('Chinese explicit supported scripts take priority over conflicting region hints',()=>{
 const api=helpers();
 for(const [input,expected]of [['zh-Hans-TW','zh-Hans'],['zh-Hans-HK','zh-Hans'],['zh-Hans-MO','zh-Hans'],['zh-Hant-CN','zh-Hant'],['zh-Hant-SG','zh-Hant'],['ZH_hAnT_cn','zh-Hant']])assert.equal(api.matchLocale(input),expected,input);
});

test('Unicode and private-use extension content does not become a Chinese script or region',()=>{
 const api=helpers();
 for(const [input,expected]of [['zh-u-rg-twzzzz','zh-Hans'],['zh-x-hant','zh-Hans'],['zh-CN-x-hant','zh-Hans'],['zh-HK-x-hans','zh-Hant'],['zh-Hans-TW-u-ca-chinese','zh-Hans'],['en-US-u-ca-gregory','en'],['es-419-x-home','es']])assert.equal(api.matchLocale(input),expected,input);
});

test('invalid primary values are not mistaken for supported locales',()=>{
 const api=helpers();
 for(const value of [null,undefined,0,false,{},[],new String('en'),'',' ','xx-ZZ','pt-BR','ar','../en','en?lang=ja','en<script>','zh--TW','-ja'])assert.equal(api.matchLocale(value),null,String(value));
});

test('only the real URL query language parameter overrides stored and browser preferences',()=>{
 const api=helpers();
 assert.equal(api.selectInitialLocale({url:'https://example.test/?lang=zh-Hant-CN#quiz/20',saved:'de',languages:['ja-JP']}),'zh-Hant');
 assert.equal(api.selectInitialLocale({url:'?lang=%20ja-JP%20#quiz/48',saved:'de',languages:['fr']}),'ja');
 assert.equal(api.selectInitialLocale({url:'https://example.test/?lang=#quiz/10',saved:'de',languages:['ja']}),'en');
 assert.equal(api.selectInitialLocale({url:'https://example.test/?lang=not-supported#quiz/10',saved:'de',languages:['ja']}),'en');
 assert.equal(api.selectInitialLocale({url:'https://example.test/#quiz/10?lang=fr',saved:'de',languages:['ja']}),'de');
 assert.equal(api.selectInitialLocale({url:new URL('https://example.test/?other=1&lang=in-ID#result/48'),saved:'de'}),'id');
});

test('stored selections and ordered browser preferences retain their priority without mutation',()=>{
 const api=helpers();
 const languages=Object.freeze(['pt-BR','xx-ZZ','ja-JP','de-DE']);
 const options=Object.freeze({url:'https://example.test/?other=1#quiz/48',saved:'zh-Hans-TW',languages,language:'fr-CA'});
 assert.equal(api.selectInitialLocale(options),'zh-Hans');
 assert.equal(api.selectInitialLocale({url:'/',saved:'unsupported',languages,language:'fr-CA'}),'ja');
 assert.equal(api.selectInitialLocale({url:'/',languages:['pt-BR'],language:'fr-CA'}),'fr');
 assert.equal(api.selectInitialLocale({url:'/',languages:[],language:'unsupported'}),'en');
 assert.equal(api.selectInitialLocale({}),'en');
 assert.equal(api.selectInitialLocale(null),'en');
 assert.deepEqual(languages,['pt-BR','xx-ZZ','ja-JP','de-DE']);
});

test('the Indonesian calm pole and the home dimension summary use Tenang',()=>{
 const pack=JSON.parse(fs.readFileSync(path.join(dist,'locales/id.json'),'utf8'));
 assert.equal(pack.messages['沉著'],'Tenang');
 assert.match(pack.messages['沉著／敏銳 × 自主／協作'],/^Tenang\b/);
 assert.doesNotMatch(pack.messages['沉著／敏銳 × 自主／協作'],/Pemarah/);
});
