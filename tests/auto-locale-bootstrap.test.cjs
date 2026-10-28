'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist'),source=fs.readFileSync(path.join(dist,'i18n.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
async function boot(options={}) {
  let href=options.url||'https://example.test/?qa=i18n-v2#quiz/20';
  const store=new Map([['gj-language-v1',options.saved],['gj-progress-v5','{"mode":20,"position":4,"answers":[-2,0,1,2]}'],['gj-home-visual-v1','{"version":1,"seed":12345}']]);
  const before=JSON.stringify([...store].filter(([k])=>k!=='gj-language-v1')),writes=[],replacements=[],events=[],listeners={};
  const element=()=>({nodeType:1,isConnected:true,dataset:{},attributes:{},closest:()=>null,hasAttribute:()=>false,setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}});
  const root=element(),body=element(),brand=element(),select=element(),status=element();
  select.value='zh-Hant';select.addEventListener=(name,fn)=>{listeners[name]=fn;};
  const document={documentElement:root,body,getElementById:id=>id==='language-select'?select:id==='language-status'?status:null,querySelector:selector=>selector==='.brand'?brand:null,createTreeWalker:()=>({nextNode:()=>null})};
  const history={state:{position:4,keep:'history metadata'},replaceState(state,unused,url){this.state=state;href=url;replacements.push({state,url});}};
  const storage={getItem:k=>store.get(k)||null,setItem(k,v){if(options.writeThrows)throw new Error('Storage denied');writes.push(k);store.set(k,v);}};
  let fetchCount=0;
  const window={document,history,NodeFilter:{SHOW_ELEMENT:1,SHOW_TEXT:4},location:{get href(){return href;}},fetch:async url=>{fetchCount++;const code=url.match(/locales\/([^/.]+)\.json/)[1];return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dist,'locales',code+'.json'),'utf8'))};},dispatchEvent:event=>events.push(event)};
  if(options.storageThrows)Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage denied');}});else window.localStorage=storage;
  if(options.navigatorThrows)Object.defineProperty(window,'navigator',{get(){throw new Error('Navigator denied');}});
  else if(!options.noNavigator){window.navigator={language:options.language};Object.defineProperty(window.navigator,'languages',{get(){if(options.languagesThrows)throw new Error('Languages denied');return options.languages;}});}
  const context={window,URL,CustomEvent:class{constructor(type,config){this.type=type;this.detail=config.detail;}},MutationObserver:class{observe(){}}};
  vm.createContext(context);vm.runInContext(source,context,{filename:'i18n.js'});await window.GuaI18n.ready;
  return {api:window.GuaI18n,root,select,store,writes,replacements,events,history,url:()=>href,fetchCount:()=>fetchCount,async manual(code){select.value=code;await listeners.change();},assertProgress(){assert.equal(JSON.stringify([...store].filter(([k])=>k!=='gj-language-v1')),before);assert.ok(writes.every(k=>k==='gj-language-v1'));assert.deepEqual(history.state,{position:4,keep:'history metadata'});}};
}
test('fresh startup matches all eleven browser language families and canonicalizes only lang',async()=>{
  for(const [language,expected]of [['zh-TW','zh-Hant'],['zh-CN','zh-Hans'],['en-US','en'],['ja-JP','ja'],['ko-KR','ko'],['hi-IN','hi'],['th-TH','th'],['id-ID','id'],['de-DE','de'],['fr-CA','fr'],['es-419','es']]){
    const b=await boot({languages:[language]});assert.equal(b.api.locale(),expected,language);assert.equal(b.root.lang,expected);assert.equal(b.select.value,expected);const url=new URL(b.url());assert.equal(url.searchParams.get('lang'),expected);assert.equal(url.searchParams.get('qa'),'i18n-v2');assert.equal(url.hash,'#quiz/20');b.assertProgress();
  }
});
test('preference order chooses the first supported browser language then language fallback',async()=>{
  for(const [options,expected]of [[{languages:['pt-BR','ja-JP','de-DE']},'ja'],[{languages:['de-DE','ja-JP']},'de'],[{languages:['pt-BR'],language:'fr-FR'},'fr'],[{languages:['ar','pt-BR'],language:'ru-RU'},'en'],[{noNavigator:true},'en']]){const b=await boot(options);assert.equal(b.api.locale(),expected);b.assertProgress();}
});
test('explicit URL outranks saved preference; unsupported and empty explicit values select English',async()=>{
  for(const [tag,expected]of [['ja-JP','ja'],['ru-RU','en'],['','en'],['<script>','en']]){const b=await boot({url:'https://example.test/?x=1&qa=i18n-v2&lang='+encodeURIComponent(tag)+'#quiz/48',saved:'ko',languages:['zh-TW']});assert.equal(b.api.locale(),expected);const url=new URL(b.url());assert.equal(url.searchParams.get('x'),'1');assert.equal(url.searchParams.get('qa'),'i18n-v2');assert.equal(url.hash,'#quiz/48');b.assertProgress();}
  assert.equal((await boot({url:'https://example.test/?lang#home',saved:'ja',languages:['de']})).api.locale(),'en');
});
test('saved supported language wins over browser; unsupported saved values do not block detection',async()=>{
  assert.equal((await boot({saved:'ja',languages:['de-DE']})).api.locale(),'ja');
  assert.equal((await boot({saved:'ru-RU',languages:['ko-KR']})).api.locale(),'ko');
});
test('storage and navigator permission errors leave URL and available preferences usable',async()=>{
  for(const [options,expected]of [[{storageThrows:true,languages:['fr-CA']},'fr'],[{storageThrows:true,url:'https://example.test/?lang=ko-KR#quiz/10'},'ko'],[{languagesThrows:true,language:'ja-JP'},'ja'],[{navigatorThrows:true},'en'],[{writeThrows:true,languages:['de-DE']},'de']]){const b=await boot(options);assert.equal(b.api.locale(),expected);b.assertProgress();}
});
test('manual dropdown selection overrides detection and preserves history and quiz storage',async()=>{
  const b=await boot({languages:['en-US']});await b.manual('ja');assert.equal(b.api.locale(),'ja');assert.equal(b.select.value,'ja');assert.equal(new URL(b.url()).searchParams.get('lang'),'ja');assert.equal(b.store.get('gj-language-v1'),'ja');assert.equal(b.events.at(-1).detail.locale,'ja');b.assertProgress();
  const restored=await boot({saved:b.store.get('gj-language-v1'),languages:['de-DE']});assert.equal(restored.api.locale(),'ja');restored.assertProgress();
});
test('Chinese script overrides region and extension subtags never impersonate a region',async()=>{
  const b=await boot({languages:['en']});for(const [tag,expected]of [['zh-Hant-CN','zh-Hant'],['zh-Hans-TW','zh-Hans'],['zh-HK','zh-Hant'],['zh-MO','zh-Hant'],['zh-SG','zh-Hans'],['zh-MY','zh-Hans'],['zh','zh-Hans'],['ZH_tw','zh-Hant'],['zh-u-rg-twzzzz','zh-Hans'],['in-ID','id']])assert.equal(b.api.matchLocale(tag),expected,tag);
  for(const tag of [null,3,'','pt-BR','__proto__','<script>','en--US'])assert.equal(b.api.matchLocale(tag),null);
});
test('Indonesian calm endpoint and all 32 calm-type labels retain the intended calm meaning',async()=>{
  const b=await boot({languages:['id-ID']});assert.equal(b.api.translate('沉著'),'Tenang');assert.match(b.api.translate('沉著／敏銳 × 自主／協作'),/^Tenang\s*\//);
  let count=0;for(const type of ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'])for(const coordination of ['自主','協作']){const label=b.api.translate(type+' · 沉著 × '+coordination);assert.match(label,/Tenang/);assert.doesNotMatch(label,/Pemarah/);count++;}assert.equal(count,32);b.assertProgress();
});
