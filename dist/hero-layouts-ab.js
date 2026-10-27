/* Original responsive hero layouts A/B. All hexagram content is supplied by GuaHero. */
(function () {
  'use strict';
  const api = window.GuaHero;
  if (!api || typeof api.register !== 'function') throw new Error('Load hero.js before hero-layouts-ab.js');
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const point = (cx,cy,r,degrees) => ({x:cx+Math.cos(degrees*Math.PI/180)*r,y:cy+Math.sin(degrees*Math.PI/180)*r});
  const round = value => value.toFixed(2);
  const trigramOrder = ['乾','兌','離','震','坤','艮','坎','巽'];

  function validate(context) {
    if (!context || !Number.isInteger(context.id) || context.id < 1 || context.id > 64 || context.hexagram.number !== context.id) throw new Error('Invalid selected hero hexagram');
    if (!Array.isArray(context.hexagram.lines) || context.hexagram.lines.length !== 6 || !context.hexagram.lines.every(value => value === 0 || value === 1)) throw new Error('Hero requires six canonical lines');
    if (!Array.isArray(context.hexagrams) || context.hexagrams.length !== 64 || !context.top || !context.bottom) throw new Error('Hero requires the full hexagram and trigram context');
    return context;
  }
  function orderedTrigrams(context) {
    return trigramOrder.map(name => {
      const trigram=context.trigrams.find(item => item.chineseName === name);
      if (!trigram) throw new Error('Missing canonical trigram ' + name);
      return trigram;
    });
  }
  function ring(context,cx,cy,r,prefix) {
    return context.hexagrams.slice().sort((one,two) => one.number-two.number).map((hexagram,index) => {
      const angle=index*360/64-90,p=point(cx,cy,r,angle);
      const rows=hexagram.lines.slice().reverse().map((line,row) => line
        ? `<rect x="-8" y="${round(row*2.8-7)}" width="16" height="1.15"/>`
        : `<rect x="-8" y="${round(row*2.8-7)}" width="6.4" height="1.15"/><rect x="1.6" y="${round(row*2.8-7)}" width="6.4" height="1.15"/>`).join('');
      const selected=hexagram.number===context.id;
      return `<g class="${prefix}-hexagram" data-hexagram="${hexagram.number}" data-lines-bottom-up="${hexagram.lines.join('')}" data-selected="${selected}" transform="translate(${round(p.x)} ${round(p.y)}) rotate(${round(angle+90)})" fill="${selected?'#a44232':'#657364'}">${rows}</g>`;
    }).join('');
  }
  function central(context,cx,cy,width,gap,stroke,prefix) {
    const left=cx-width/2,top=cy-(gap*5+stroke)/2,half=width*.4;
    const lines=context.hexagram.lines;
    return `<g class="${prefix}-central" data-hexagram="${context.id}" data-lines-bottom-up="${lines.join('')}" data-lines-top-down="${lines.slice().reverse().join('')}" fill="#283b32" transform="translate(${round(left)} ${round(top)})">${lines.slice().reverse().map((line,index)=>line
      ? `<rect x="0" y="${index*gap}" width="${width}" height="${stroke}" rx=".5"/>`
      : `<rect x="0" y="${index*gap}" width="${half}" height="${stroke}" rx=".5"/><rect x="${width-half}" y="${index*gap}" width="${half}" height="${stroke}" rx=".5"/>`).join('')}</g>`;
  }
  function description(context) {
    return escape(`外圈依文王卦序環列六十四卦，朱紅標出${context.name}。中央為第${context.id}卦，上${context.top.chineseName}（${context.top.chineseImage}）、下${context.bottom.chineseName}（${context.bottom.chineseImage}），爻線自下而上讀。`);
  }
  function quote(context,prefix) {
    return context.quote ? `<p class="${prefix}-quote"><span class="${prefix}-quote-label">原典短引</span>${escape(context.quote)}</p>` : '';
  }

  api.register('A', context => {
    const ctx=validate(context),trigrams=orderedTrigrams(ctx),name=escape(ctx.name),key='concept-a-'+ctx.id;
    const art=`<svg class="concept-a-visual" viewBox="0 0 600 600" role="img" aria-labelledby="${key}-title ${key}-description"><title id="${key}-title">六十四卦環與${name}</title><desc id="${key}-description">${description(ctx)}</desc><g fill="none" stroke="#b9c0ad" stroke-width=".8"><circle cx="300" cy="300" r="274"/><circle cx="300" cy="300" r="215"/><circle cx="300" cy="300" r="151"/><circle cx="300" cy="300" r="142" stroke-dasharray="1.5 7"/></g><circle cx="300" cy="300" r="121" fill="#e8eadb"/>${ring(ctx,300,300,244,'concept-a')}${central(ctx,300,300,112,21,8,'concept-a')}<g fill="#a44232"><circle cx="300" cy="26" r="3"/><circle cx="574" cy="300" r="2"/><circle cx="300" cy="574" r="2"/><circle cx="26" cy="300" r="2"/></g><g stroke="#c7ccbd" stroke-width=".8"><path d="M300 8v10M300 582v10M8 300h10M582 300h10"/></g></svg>`;
    return `<figure class="concept-a" data-hero-layout="A" data-hero-hexagram="${ctx.id}"><div class="concept-a-top"><div><span class="concept-a-overline">SIXTY-FOUR WAYS TO SEE</span><span class="concept-a-top-title">一卦，一面自己。</span></div><span class="concept-a-seal" aria-hidden="true">易</span></div><div class="concept-a-orbit-zone">${art}<div aria-label="八象">${trigrams.map((item,index)=>`<span class="concept-a-inner-label concept-a-inner-label-${index}">${escape(item.chineseName)}<span>${escape(item.chineseImage)}</span></span>`).join('')}</div></div><div class="concept-a-legend" aria-label="八象">${trigrams.map(item=>`<span class="concept-a-trigram">${escape(item.chineseName)}<span>${escape(item.chineseImage)}</span></span>`).join('')}</div><figcaption class="concept-a-caption"><span class="concept-a-index" aria-hidden="true">${String(ctx.id).padStart(2,'0')}</span><div><h3>${name}</h3>${quote(ctx,'concept-a')}<p class="concept-a-note">借一卦意象，換個角度看自己。</p></div></figcaption></figure>`;
  });

  api.register('B', context => {
    const ctx=validate(context),trigrams=orderedTrigrams(ctx),name=escape(ctx.name),key='concept-b-'+ctx.id;
    const connectors=trigrams.map((_,index)=>{
      const angle=index*45-90,inner=point(380,380,258,angle),outer=point(380,380,274,angle);
      return `<g stroke="#a9b39e" stroke-width="1" fill="none"><path d="M${round(inner.x)} ${round(inner.y)}L${round(outer.x)} ${round(outer.y)}"/><circle cx="${round(outer.x)}" cy="${round(outer.y)}" r="2" fill="#a44232" stroke="none"/></g>`;
    }).join('');
    const art=`<svg class="concept-b-orbit" viewBox="0 0 760 760" role="img" aria-labelledby="${key}-title ${key}-description"><title id="${key}-title">環外八象與${name}</title><desc id="${key}-description">八象名稱與卦環分開。${description(ctx)}</desc><defs><radialGradient id="${key}-paper"><stop offset="0" stop-color="#e7ead8"/><stop offset="1" stop-color="#f2f0e4" stop-opacity=".25"/></radialGradient></defs><circle cx="380" cy="380" r="252" fill="url(#${key}-paper)"/><g fill="none" stroke="#b4bda8" stroke-width=".9"><circle cx="380" cy="380" r="253"/><circle cx="380" cy="380" r="215"/><circle cx="380" cy="380" r="150" stroke-dasharray="2 8"/></g>${ring(ctx,380,380,235,'concept-b')}${connectors}<circle cx="380" cy="380" r="128" fill="#f6f1e7" stroke="#c1c9b6" stroke-width=".8"/>${central(ctx,380,380,118,22,8,'concept-b')}<circle cx="380" cy="127" r="3" fill="#a44232"/></svg>`;
    return `<figure class="concept-b" data-hero-layout="B" data-hero-hexagram="${ctx.id}"><div class="concept-b-top"><span class="concept-b-kicker">讓古老的意象，走進今天的生活。</span><span class="concept-b-seal" aria-hidden="true">易</span></div><div class="concept-b-visual">${art}<div aria-label="八象">${trigrams.map((item,index)=>`<span class="concept-b-label concept-b-label-${index}">${escape(item.chineseName)}<span>${escape(item.chineseImage)}</span></span>`).join('')}</div></div><figcaption class="concept-b-caption"><div class="concept-b-number">${String(ctx.id).padStart(2,'0')}<span>HEXAGRAM</span></div><div><h3>${name}</h3>${quote(ctx,'concept-b')}<p class="concept-b-note">六十四卦，六十四個看見自己的入口。</p></div></figcaption></figure>`;
  });
})();
