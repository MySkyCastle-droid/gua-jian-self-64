'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const layouts=['A','B','C','D','E'];
const window={GuaData:{}};
const sandbox={window};
vm.createContext(sandbox);
for(const file of ['data/hexagrams.js','data/reports-a.js','data/reports-b.js','hero.js','hero-layouts-ab.js','hero-layouts-cd.js','hero-layout-e.js']){
  vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),sandbox,{filename:file});
}
const hero=window.GuaHero,data=window.GuaData;
const records=[];
const expectedNames=new Map(data.iching.hexagrams.map(hexagram=>{
  const upper=data.iching.trigrams.find(trigram=>trigram.number===hexagram.topTrigram);
  const lower=data.iching.trigrams.find(trigram=>trigram.number===hexagram.bottomTrigram);
  return [hexagram.number,upper.number===lower.number?hexagram.chineseName+'為'+upper.chineseImage:upper.chineseImage+lower.chineseImage+hexagram.chineseName];
}));

// Parse only markup emitted by these renderers. This is a structural SVG/HTML check,
// not a browser layout engine or a replacement for visual/mobile acceptance.
const entities={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':'\u00a0'};
const decode=text=>text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g,entity=>entities[entity]);
function parse(markup){
  const tree={tag:'#root',attrs:{},children:[],parent:null};
  const stack=[tree],voids=new Set(['br','hr','img','input','meta','link','area','base','col','embed','param','source','track','wbr']);
  const tokens=markup.match(/<!--[\s\S]*?-->|<\/[A-Za-z][^>]*>|<[A-Za-z][^>]*>|[^<]+/g)||[];
  assert.equal(tokens.join(''),markup,'unexpected unparsed markup');
  for(const token of tokens){
    if(token.startsWith('<!--'))continue;
    if(token.startsWith('</')){
      const name=token.match(/^<\/([\w:-]+)/)[1].toLowerCase();
      assert.equal(stack[stack.length-1].tag,name,'unbalanced emitted markup');
      stack.pop();continue;
    }
    if(token.startsWith('<')){
      const name=token.match(/^<([\w:-]+)/)[1].toLowerCase(),attrs={};
      const attrText=token.slice(name.length+1);
      for(const match of attrText.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[match[1]]=decode(match[2]??match[3]??match[4]);
      const node={tag:name,attrs,children:[],parent:stack[stack.length-1]};
      node.parent.children.push(node);
      if(!token.endsWith('/>')&&!voids.has(name))stack.push(node);
    }else stack[stack.length-1].children.push({tag:'#text',text:decode(token),children:[],parent:stack[stack.length-1]});
  }
  assert.equal(stack.length,1,'all emitted elements close');
  return tree;
}
function all(node,predicate){
  const result=[];
  for(const child of node.children){if(predicate(child))result.push(child);result.push(...all(child,predicate));}
  return result;
}
const hasClass=(node,name)=>(node.attrs?.class||'').split(/\s+/).includes(name);
const text=node=>node.tag==='#text'?node.text:node.children.map(text).join('');
const normal=value=>value.replace(/\s+/g,'').replace(/\u00a0/g,'');
function choice(layout,id){return {seed:0,layout,hexagramId:id};}

function actualLines(group,expectedCount){
  const rects=group.children.filter(node=>node.tag==='rect');
  const byY=new Map();
  for(const rect of rects){
    const y=Number(rect.attrs.y||0);
    assert.ok(Number.isFinite(y)&&Number(rect.attrs.width)>0&&Number(rect.attrs.height)>0,'visible rectangles have finite positive geometry');
    if(!byY.has(y))byY.set(y,[]);
    byY.get(y).push(rect);
  }
  const rows=[...byY.entries()].sort((one,two)=>one[0]-two[0]);
  assert.equal(rows.length,expectedCount,'actual SVG has the correct row count');
  let fullWidth=null;
  const topDown=rows.map(([,segments])=>{
    assert.ok(segments.length===1||segments.length===2,'each row is one yang segment or two yin segments');
    const geometry=segments.map(rect=>({left:Number(rect.attrs.x||0),width:Number(rect.attrs.width)})).sort((one,two)=>one.left-two.left);
    const span=geometry.at(-1).left+geometry.at(-1).width-geometry[0].left;
    if(fullWidth===null)fullWidth=span;
    assert.ok(Math.abs(span-fullWidth)<.00001,'all rows span the same full glyph width');
    if(geometry.length===2){
      assert.ok(geometry[0].left+geometry[0].width<geometry[1].left,'yin line contains a real center gap');
      assert.ok(Math.abs(geometry[0].width-geometry[1].width)<.00001,'yin segments have equal width');
    }
    return geometry.length===1?1:0;
  });
  return topDown.reverse();
}
function central(tree,layout){
  const prefix='concept-'+layout.toLowerCase();
  const found=all(tree,node=>node.tag==='g'&&(hasClass(node,prefix+'-central')||hasClass(node,prefix+'-main-glyph')||node.attrs['data-central-id']!==undefined));
  assert.equal(found.length,1,'exactly one main six-line symbol');
  return found[0];
}
function ring(tree,layout){
  const prefix='concept-'+layout.toLowerCase();
  const found=all(tree,node=>node.tag==='g'&&(layout==='A'||layout==='B'?hasClass(node,prefix+'-hexagram'):layout==='E'?node.attrs['data-ring-id']!==undefined:(node.attrs.transform||'').includes('rotate(')&&node.children.some(child=>child.tag==='rect')));
  assert.equal(found.length,64,'all 64 ring glyphs are rendered');
  return found;
}

test('all 320 real layout/hexagram renders show correct identity and independently drawn six-line symbols',()=>{
  for(const layout of layouts)for(const hexagram of data.iching.hexagrams){
    const html=hero.render(choice(layout,hexagram.number),data),tree=parse(html);
    const figures=all(tree,node=>node.tag==='figure');
    assert.equal(figures.length,1);
    assert.equal(figures[0].attrs['data-hero-layout'],layout);
    assert.equal(Number(figures[0].attrs['data-hero-hexagram']??figures[0].attrs['data-hexagram']),hexagram.number);
    assert.ok(normal(text(tree)).includes(normal(expectedNames.get(hexagram.number))),'complete selected hexagram name is visible');
    const main=central(tree,layout);
    assert.equal(Number(main.attrs['data-hexagram']??main.attrs['data-central-id']),hexagram.number);
    const actual=actualLines(main,6);
    assert.equal(actual.join(''),hexagram.lines.join(''),`${layout}/${hexagram.number}: central rects independently match canonical bottom-up lines`);
    const row=ring(tree,layout),seen=new Set();
    for(const [index,glyph] of row.entries()){
      const canonical=data.iching.hexagrams[index],bits=actualLines(glyph,6).join('');
      assert.equal(bits,canonical.lines.join(''),`${layout}/${hexagram.number}: ring glyph ${index+1} has correct actual lines`);
      seen.add(bits);
      if(glyph.attrs['data-hexagram']!==undefined)assert.equal(Number(glyph.attrs['data-hexagram']),canonical.number);
      if(glyph.attrs['data-ring-id']!==undefined)assert.equal(Number(glyph.attrs['data-ring-id']),canonical.number);
    }
    assert.equal(seen.size,64,'the ring contains 64 unique canonical hexagrams');
    const red=row.filter(node=>(node.attrs.fill||'').toLowerCase()==='#a44232');
    assert.equal(red.length,1,'one ring glyph highlights the selected hexagram');
    assert.equal(actualLines(red[0],6).join(''),hexagram.lines.join(''),'highlighted ring glyph matches selected hexagram');
    const upper=data.iching.trigrams.find(t=>t.number===hexagram.topTrigram),lower=data.iching.trigrams.find(t=>t.number===hexagram.bottomTrigram);
    const descriptions=all(tree,node=>node.tag==='desc'||node.tag==='title'||node.attrs?.['aria-label']).map(node=>text(node)+' '+(node.attrs?.['aria-label']||'')).join('');
    assert.ok(normal(descriptions).includes('上'+upper.chineseName)&&normal(descriptions).includes('下'+lower.chineseName),'upper/lower trigram descriptions match canonical data');
    assert.ok(normal(text(tree)).includes(normal(data.reports[hexagram.number].quote)),'existing original quotation is visible');
    if(hexagram.number!==26){
      assert.ok(!normal(text(tree)).includes('山天大畜'),'no stale fixed main title');
      assert.ok(!normal(descriptions).includes('中央為第26卦'),'no stale fixed central accessibility label');
    }
    assert.equal(all(tree,node=>node.tag==='style').length,0,'styles remain outside production markup');
    const captions=all(tree,node=>node.tag==='figcaption');
    assert.equal(captions.length,1);
    let ancestor=captions[0].parent;
    while(ancestor){assert.notEqual(ancestor.tag,'svg','caption uses HTML outside the SVG');ancestor=ancestor.parent;}
    records.push({layout,id:hexagram.number,name:expectedNames.get(hexagram.number),centralActualLines:actual.join(''),ringGlyphs:row.length,ringUnique:seen.size,selectedCorrect:true,quoteCorrect:true,captionOutsideSvg:true});
  }
});

test('all five renderers preserve long quotations and escape dynamic title/quote HTML',()=>{
  const title='<img src=x onerror="alert(1)"> & 文化';
  const quote='先把眼前的生活看清楚，再決定接下來怎麼走。'.repeat(80)+'<script>bad()</script> & "原句"';
  const altered=JSON.parse(JSON.stringify(data));
  altered.iching.hexagrams[0].chineseName=title;
  altered.reports[1].quote=quote;
  for(const layout of layouts){
    const html=hero.render(choice(layout,1),altered),tree=parse(html),visible=text(tree);
    assert.equal(all(tree,node=>['script','img','style','iframe'].includes(node.tag)).length,0,'injected strings do not become elements');
    assert.ok(visible.includes(title+'為天'),'title text survives HTML escaping');
    assert.ok(visible.includes(quote),'long original quotation is preserved without truncation');
    assert.ok(html.includes('&lt;img')&&html.includes('&lt;script&gt;'),'dynamic title/quote are escaped in the emitted source');
  }
});

test('all five renderers tolerate an empty quotation without undefined text',()=>{
  const altered=JSON.parse(JSON.stringify(data));
  altered.reports[64].quote='';
  for(const layout of layouts){
    const html=hero.render(choice(layout,64),altered);
    assert.ok(html.includes(expectedNames.get(64)));
    assert.ok(!html.includes('undefined')&&!html.includes('[object Object]'));
  }
});

test('renderer verification evidence covers 320 completed structural cases',()=>{
  assert.equal(records.length,320);
  const output=process.env.GJ_HERO_VERIFY_OUTPUT;
  if(output){
    const file=path.resolve(output);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,JSON.stringify({passed:true,scope:'Standard Node/VM structural markup and independently reconstructed SVG rectangle checks. Does not measure rendered text geometry, color contrast, or mobile appearance.',layouts,cases:records.length,centralLineChecks:records.length*6,ringGlyphChecks:records.length*64,ringLineChecks:records.length*64*6,longQuoteAndEscapingCases:5,emptyQuoteCases:5,records},null,2)+'\n');
  }
});
