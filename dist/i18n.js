/* Display-only localization. Canonical questions, seed rules and answers stay unchanged. */
(function (global) {
  'use strict';
  const VERSION = 'i18n-v2-auto1';
  const CONTENT_VERSION = 'plain-questions-v2';
  const LOCALES = Object.freeze(['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko', 'hi', 'th', 'id', 'de', 'fr', 'es']);
  const EXTRA_LOCALES = new Set(['ko', 'hi', 'th', 'id', 'de', 'fr', 'es']);
  const LATIN_LOCALES = new Set(['en', 'id', 'de', 'fr', 'es']);
  const KEY = 'gj-language-v1';
  const packs = Object.create(null), tries = Object.create(null);
  const sources = new WeakMap(), attributeSources = new WeakMap();
  const doc = global.document;
  let current = 'zh-Hant', request = 0, observer, busy = false;
  const protectedQuotes = new Set(Object.values((global.GuaData || {}).reports || {}).map(r => r.quote));
  const imageNames = {天:['Heaven','天'],地:['Earth','地'],雷:['Thunder','雷'],水:['Water','水'],山:['Mountain','山'],風:['Wind','風'],火:['Fire','火'],澤:['Lake','沢']};
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  function valid(code) { return LOCALES.includes(code); }
  function matchLocale(value) {
    if (typeof value !== 'string') return null;
    const tag = value.trim().replace(/_/g,'-').toLowerCase();
    if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/.test(tag)) return null;
    const parts = tag.split('-');
    const language = parts[0] === 'in' ? 'id' : parts[0];
    if (language === 'zh') {
      // Only the primary tag's script/region matters, not Unicode/private extensions.
      const subtags = [];
      for (const part of parts.slice(1)) { if (part.length === 1) break; subtags.push(part); }
      if (subtags.includes('hant')) return 'zh-Hant';
      if (subtags.includes('hans')) return 'zh-Hans';
      const region = subtags.find(part => /^[a-z]{2}$|^\d{3}$/.test(part));
      return ['tw','hk','mo'].includes(region) ? 'zh-Hant' : 'zh-Hans';
    }
    return valid(language) ? language : null;
  }
  function selectInitialLocale(options = {}) {
    if (!options || typeof options !== 'object') return 'en';
    try {
      const url = new URL(options.url || '', 'https://guajian.invalid/');
      if (url.searchParams.has('lang')) return matchLocale(url.searchParams.get('lang')) || 'en';
    } catch (_) {}
    const saved = matchLocale(options.saved);
    if (saved) return saved;
    if (Array.isArray(options.languages)) {
      for (const language of options.languages) {
        const supported = matchLocale(language);
        if (supported) return supported;
      }
    }
    return matchLocale(options.language) || 'en';
  }
  function register(code, pack) {
    if (!valid(code) || !pack || pack.locale !== code || !pack.messages || typeof pack.messages !== 'object' || Array.isArray(pack.messages)) throw new Error('Invalid language pack');
    const messages = Object.create(null), trie = Object.create(null);
    Object.entries(pack.messages).forEach(([source,target]) => {
      if (!source || typeof target !== 'string' || !target.trim() || /[<>]/.test(target)) throw new Error('Invalid translation');
      messages[source] = target;
      // Single Han characters are proper cultural names; do not replace them inside prose.
      if (source.length < 2 || source === target || protectedQuotes.has(source)) return;
      let node = trie;
      for (const char of source) node = node[char] || (node[char] = Object.create(null));
      node.$ = target;
    });
    const templates = Object.create(null);
    Object.entries(pack.templates || {}).forEach(([key,value]) => {
      if (!key || typeof value !== 'string' || !value.trim() || /[<>]/.test(value)) throw new Error('Invalid language template');
      templates[key] = value;
    });
    packs[code] = Object.freeze({messages:Object.freeze(messages), characters:pack.characters || {}, templates:Object.freeze(templates)});
    tries[code] = trie;
  }
  function phrase(text, code) {
    const p = packs[code];
    if (!p) return text;
    if (own(p.messages,text)) return p.messages[text];
    let output = '', i = 0;
    while (i < text.length) {
      let node = tries[code], j = i, end = i, value = null;
      while (j < text.length && node[text[j]]) {
        node = node[text[j++]];
        if (own(node,'$')) { value = node.$; end = j; }
      }
      if (value !== null) { output += value; i = end; }
      else { const char = text[i++]; output += code === 'zh-Hans' ? (p.characters[char] || char) : char; }
    }
    return output;
  }
  function format(code, key, ...values) {
    const template = packs[code]?.templates[key];
    if (!template) return null;
    return template.replace(/\{(\d+)\}/g, (_,index) => String(values[Number(index)-1] ?? ''));
  }
  function nature(value, code) {
    const key = {天:'Heaven',地:'Earth',雷:'Thunder',水:'Water',山:'Mountain',風:'Wind',火:'Fire',澤:'Lake'}[value];
    return key ? format(code,'nature'+key) || value : value;
  }
  // New languages use complete localized sentence templates; numerical and named values are display-only.
  function expandedDynamic(text, code) {
    const tr = value => phrase(value,code), f = (key,...values) => format(code,key,...values);
    let m;
    const outsideLabel = '八象名稱與卦環分開。';
    if (text.startsWith(outsideLabel)) return tr(outsideLabel) + ' ' + (expandedDynamic(text.slice(outsideLabel.length),code) || tr(text.slice(outsideLabel.length)));
    if ((m=text.match(/^(.+?) · ([天地雷水山風火澤])$/))) return `${tr(m[1])} · ${nature(m[2],code)}`;
    if ((m=text.match(/^唯讀 (\d+)／(\d+) 題$/))) return f('readOnly',m[1],m[2]);
    if ((m=text.match(/^主要問題 (\d+)\/(\d+)・補充情境\s*$/))) return f('mainFollow',m[1],m[2])+' ';
    if ((m=text.match(/^開始新版 (10|20|48) 題五點探索(.*)$/))) return f('newVersion',m[1],tr(m[2]));
    if ((m=text.match(/^這會移除 (10|20|48) 題(?:快速探索|標準探索|資深探索) 的答案與進度(，並重新抽題)?。其他版本的進度與舊版封存會保留。$/))) return f(m[2]?'redrawRecord':'removeRecord',m[1]);
    if ((m=text.match(/^已回答 (\d+)／(\d+) 道主要問題。這份紀錄保留當時的主要問題回答，以及二選一補充情境所決定的分類，僅供閱讀。$/))) return f('archiveMain',m[1],m[2]);
    if ((m=text.match(/^已回答 (\d+)／(\d+) 題。這份紀錄保留原本的二選一答案，封存後僅供閱讀。$/))) return f('archiveBinary',m[1],m[2]);
    if ((m=text.match(/^外圈依文王卦序環列六十四卦，朱紅標出(.+?)。中央為第(\d+)卦，上(.+?)（(.+?)）、下(.+?)（(.+?)），爻線自下而上讀。$/))) return f('heroRing',tr(m[1]),m[2],tr(m[3]),nature(m[4],code),tr(m[5]),nature(m[6],code));
    if ((m=text.match(/^第 (\d+) 卦 · 上(.+?)下(.+)$/))) return f('guaUpperLower',m[1],tr(m[2]),tr(m[3]));
    if ((m=text.match(/^(10|20|48) 題・(.+)$/))) return f('questionMode',m[1],tr(m[2]));
    if ((m=text.match(/^(\d+)[–—-](\d+) 題$/))) return f('questionRange',m[1],m[2]);
    if ((m=text.match(/^(10|20|48) 題(快速|標準|資深)$/))) return f('questionMode',m[1],f({快速:'quick',標準:'standard',資深:'inDepth'}[m[2]]));
    if ((m=text.match(/^(10|20|48) 題探索・(主要問題|補充情境)第 (\d+) 題(.*)$/))) return f('questionTitle',m[1],f(m[2]==='主要問題'?'mainQuestion':'followUp'),m[3],tr(m[4]));
    if ((m=text.match(/^([天地雷水山風火澤])在上，([天地雷水山風火澤])在下。$/))) return f('natureAboveBelow',nature(m[1],code),nature(m[2],code));
    if ((m=text.match(/^閱讀(.+?)：(.+)$/))) return f('readArticle',tr(m[1]),tr(m[2]));
    if ((m=text.match(/^六十四卦環，中央為第(\d+)卦(.+?)，上(.+?)下(.+)$/))) return f('ringCenter',m[1],tr(m[2]),tr(m[3]),tr(m[4]));
    if ((m=text.match(/^文王六十四卦環；中央為第 (\d+) 卦(.+?)，上(.+?)下(.+?)。六爻由下至上為(.+)。$/))) return f('ringLines',m[1],tr(m[2]),tr(m[3]),tr(m[4]),m[5].split('、').map(v=>f(v==='陰'?'yin':'yang')).join(', '));
    if ((m=text.match(/^八卦與自然意象；(.+?)，上卦為(.+?)，下卦為(.+?)。$/))) return f('naturalImages',tr(m[1]),tr(m[2]),tr(m[3]));
    if ((m=text.match(/^(.+?)，([天地雷水山風火澤])，本卦(上卦|下卦)$/))) return f('trigramNature',tr(m[1]),nature(m[2],code),f(m[3]==='上卦'?'upper':'lower'));
    if ((m=text.match(/^(10|20|48) 題(資深探索|標準探索|快速探索)(.*)$/))) return f('questionMode',m[1],f({'10':'quickExploration','20':'standardExploration','48':'inDepthExploration'}[m[1]]))+tr(m[3]);
    if ((m=text.match(/^主要問題已答 (\d+)／(\d+) 題・必要時另加 0–6 題補充情境，合計 (\d+)–(\d+) 題(.*)$/))) return f('mainProgress',m[1],m[2],m[3],m[4],tr(m[5]));
    if ((m=text.match(/^主要問題已答 (\d+)／(\d+) 題・補充情境已答 (\d+)／(\d+) 題・本次共 (\d+) 題(.*)$/))) return f('followProgress',m[1],m[2],m[3],m[4],m[5],tr(m[6]));
    if ((m=text.match(/^(已完成 |這次完成 )(\d+) 題主要問題、(\d+) 題補充情境，共 (\d+) 題。(.*)$/))) return f('finished',m[2],m[3],m[4],tr(m[5]));
    if ((m=text.match(/^本次觀察：(\d+) 題$/))) return f('observation',m[1]);
    if ((m=text.match(/^這次較靠近「(.+)」$/))) return f('thisTime',tr(m[1]));
    if ((m=text.match(/^當時的主要問題沒有偏向；原封存分類保留「(.+)」。$/))) return f('archivedCategory',tr(m[1]));
    if ((m=text.match(/^「(.+)」目前還沒有明顯靠近哪一邊，先讓這些面向保持開放。(.*)$/))) return f('openAspects',m[1].split('、').map(tr).join(', '),tr(m[2]));
    if ((m=text.match(/^共 (\d+) 篇，依文王卦序排列，沒有先後名次。點開一篇，看看它帶你想起什麼。$/))) return f('candidateArticles',m[1]);
    if ((m=text.match(/^開始 (10|20|48) 題探索(.*)$/))) return f('start',m[1],tr(m[2]));
    if ((m=text.match(/^(重新開始|清除) (10|20|48) 題探索？$/))) return f(m[1]==='清除'?'clearQuestion':'restartQuestion',m[2]);
    if ((m=text.match(/^(10|20|48) 題探索的本機紀錄已清除。$/))) return f('recordCleared',m[1]);
    if ((m=text.match(/^(\d+) \/ 64 種原型$/))) return f('archetypeCount',m[1]);
    if ((m=text.match(/^(\d+)條核心題句$/))) return f('coreCount',m[1]);
    if ((m=text.match(/^第\s*(\d+)\s*卦(.*)$/))) return f('hexagram',m[1],tr(m[2]));
    if ((m=text.match(/^(.+)。左側是(.+)，右側是(.+)。(.+)$/))) return f('axisDescription',tr(m[1]),tr(m[2]),tr(m[3]),tr(m[4]));
    return null;
  }
  // Existing English and Japanese templates remain unchanged.
  function dynamic(text, code) {
    if (EXTRA_LOCALES.has(code)) return expandedDynamic(text,code);
    if (code !== 'en' && code !== 'ja') return null;
    const en = code === 'en', tr = s => phrase(s,code);
    let m;
    const outsideLabel = '八象名稱與卦環分開。';
    if (text.startsWith(outsideLabel)) return tr(outsideLabel) + (dynamic(text.slice(outsideLabel.length),code) || tr(text.slice(outsideLabel.length)));
    if ((m = text.match(/^(.+?) · ([天地雷水山風火澤])$/))) return `${m[1]} · ${imageNames[m[2]][en ? 0 : 1]}`;
    if ((m = text.match(/^唯讀 (\d+)／(\d+) 題$/))) return en ? `Read-only · ${m[1]}/${m[2]} questions` : `閲覧のみ・${m[1]}／${m[2]}問`;
    if ((m = text.match(/^主要問題 (\d+)\/(\d+)・補充情境\s*$/))) return en ? `Main ${m[1]}/${m[2]} · Follow-up ` : `基本 ${m[1]}／${m[2]}問・補足 `;
    if ((m = text.match(/^開始新版 (10|20|48) 題五點探索(.*)$/))) return en ? `Start the new ${m[1]}-question, five-point exploration${m[2]}` : `新版の${m[1]}問・5段階回答で始める${m[2]}`;
    if ((m = text.match(/^這會移除 (10|20|48) 題(?:快速探索|標準探索|資深探索) 的答案與進度(，並重新抽題)?。其他版本的進度與舊版封存會保留。$/))) return en ? `This will remove the answers and progress for the ${m[1]}-question exploration${m[2] ? ' and draw a new set of questions' : ''}. Progress in other versions and archived records will remain.` : `${m[1]}問の回答と進み具合を消去${m[2] ? 'し、新しい問題を選び直し' : 'し'}ます。ほかのバージョンの進み具合と旧版の保存記録は残ります。`;
    if ((m = text.match(/^已回答 (\d+)／(\d+) 道主要問題。這份紀錄保留當時的主要問題回答，以及二選一補充情境所決定的分類，僅供閱讀。$/))) return en ? `${m[1]}/${m[2]} main questions answered. This read-only archive retains the original answers and the classification chosen through the former two-option follow-ups.` : `基本の質問${m[1]}／${m[2]}問に回答済みです。当時の回答と、二択の補足質問で決まった分類を、閲覧用の記録として残しています。`;
    if ((m = text.match(/^已回答 (\d+)／(\d+) 題。這份紀錄保留原本的二選一答案，封存後僅供閱讀。$/))) return en ? `${m[1]}/${m[2]} questions answered. This read-only archive retains the original two-option answers.` : `${m[1]}／${m[2]}問に回答済みです。当時の二択の回答をそのまま残した、閲覧のみの記録です。`;
    if ((m = text.match(/^外圈依文王卦序環列六十四卦，朱紅標出(.+?)。中央為第(\d+)卦，上(.+?)（(.+?)）、下(.+?)（(.+?)），爻線自下而上讀。$/))) return en ? `The outer ring follows King Wen's order of 64 hexagrams; ${tr(m[1])} is highlighted in red. The center shows hexagram ${m[2]}: ${m[3]} (${imageNames[m[4]]?.[0] || m[4]}) above ${m[5]} (${imageNames[m[6]]?.[0] || m[6]}). Read the lines from bottom to top.` : `外周に文王卦序の六十四卦を並べ、「${m[1]}」を朱色で示しています。中央は第${m[2]}卦で、上卦は${m[3]}（${imageNames[m[4]]?.[1] || m[4]}）、下卦は${m[5]}（${imageNames[m[6]]?.[1] || m[6]}）。爻は下から上へ読みます。`;
    if ((m = text.match(/^第 (\d+) 卦 · 上(.+?)下(.+)$/))) return en ? `Hexagram ${m[1]} · upper ${m[2]}, lower ${m[3]}` : `第${m[1]}卦・上卦${m[2]}／下卦${m[3]}`;
    if ((m = text.match(/^(10|20|48) 題・(.+)$/))) return en ? `${m[1]} questions · ${tr(m[2])}` : `${m[1]}問・${tr(m[2])}`;
    if ((m = text.match(/^(\d+)[–—-](\d+) 題$/))) return en ? `${m[1]}–${m[2]} questions` : `${m[1]}〜${m[2]}問`;
    if ((m = text.match(/^(10|20|48) 題(快速|標準|資深)$/))) return en ? `${m[1]} questions · ${{快速:'Quick',標準:'Standard',資深:'In-depth'}[m[2]]}` : `${m[1]}問・${{快速:'クイック',標準:'スタンダード',資深:'じっくり'}[m[2]]}`;
    if ((m = text.match(/^(10|20|48) 題探索・(主要問題|補充情境)第 (\d+) 題(.*)$/))) return en ? `${m[1]} questions · ${m[2] === '主要問題' ? 'Main question' : 'Follow-up'} ${m[3]}${tr(m[4])}` : `${m[1]}問の探索・${m[2] === '主要問題' ? '基本の質問' : '補足の質問'}${m[3]}問目${tr(m[4])}`;
    if ((m = text.match(/^([天地雷水山風火澤])在上，([天地雷水山風火澤])在下。$/))) return en ? `${imageNames[m[1]][0]} above, ${imageNames[m[2]][0]} below.` : `${imageNames[m[1]][1]}が上、${imageNames[m[2]][1]}が下。`;
    if ((m = text.match(/^閱讀(.+?)：(.+)$/))) return en ? `Read ${m[1]}: ${tr(m[2])}` : `${m[1]}を読む：${tr(m[2])}`;
    if ((m = text.match(/^六十四卦環，中央為第(\d+)卦(.+?)，上(.+?)下(.+)$/))) return en ? `64-hexagram ring. Center: hexagram ${m[1]}, ${m[2]}. Upper trigram ${m[3]}, lower trigram ${m[4]}.` : `六十四卦の輪。中央は第${m[1]}卦「${m[2]}」、上卦は${m[3]}、下卦は${m[4]}。`;
    if ((m = text.match(/^文王六十四卦環；中央為第 (\d+) 卦(.+?)，上(.+?)下(.+?)。六爻由下至上為(.+)。$/))) return en ? `King Wen's 64-hexagram ring. Center: hexagram ${m[1]}, ${m[2]}. Upper ${m[3]}, lower ${m[4]}. Lines from bottom to top: ${m[5].replace(/陰/g,'yin').replace(/陽/g,'yang').replace(/、/g,', ')}.` : `文王卦序の六十四卦の輪。中央は第${m[1]}卦「${m[2]}」、上卦は${m[3]}、下卦は${m[4]}。下からの爻は${m[5]}。`;
    if ((m = text.match(/^八卦與自然意象；(.+?)，上卦為(.+?)，下卦為(.+?)。$/))) return en ? `Trigrams and natural images. ${m[1]}: upper ${m[2]}, lower ${m[3]}.` : `八卦と自然のイメージ。「${m[1]}」の上卦は${m[2]}、下卦は${m[3]}。`;
    if ((m = text.match(/^(.+?)，([天地雷水山風火澤])，本卦(上卦|下卦)$/))) return en ? `${m[1]}, ${imageNames[m[2]][0]}, ${m[3] === '上卦' ? 'upper' : 'lower'} trigram of this hexagram` : `${m[1]}、${imageNames[m[2]][1]}、この卦の${m[3]}`;
    if ((m = text.match(/^(10|20|48) 題(資深探索|標準探索|快速探索)(.*)$/))) {
      const label = en ? {'10':'Quick exploration','20':'Standard exploration','48':'In-depth exploration'}[m[1]] : {'10':'クイック探索','20':'スタンダード探索','48':'じっくり探索'}[m[1]];
      return (en ? `${m[1]} questions · ${label}` : `${m[1]}問・${label}`) + tr(m[3]);
    }
    if ((m = text.match(/^主要問題已答 (\d+)／(\d+) 題・必要時另加 0–6 題補充情境，合計 (\d+)–(\d+) 題(.*)$/))) return en ? `Main questions: ${m[1]}/${m[2]}. Up to 6 follow-ups if needed; ${m[3]}–${m[4]} in total.${tr(m[5])}` : `基本の質問 ${m[1]}／${m[2]}問。必要に応じて補足の質問を0〜6問追加し、合計${m[3]}〜${m[4]}問です。${tr(m[5])}`;
    if ((m = text.match(/^主要問題已答 (\d+)／(\d+) 題・補充情境已答 (\d+)／(\d+) 題・本次共 (\d+) 題(.*)$/))) return en ? `Main: ${m[1]}/${m[2]}; follow-ups: ${m[3]}/${m[4]}; ${m[5]} questions in total.${tr(m[6])}` : `基本の質問 ${m[1]}／${m[2]}問・補足の質問 ${m[3]}／${m[4]}問・合計${m[5]}問。${tr(m[6])}`;
    if ((m = text.match(/^(已完成 |這次完成 )(\d+) 題主要問題、(\d+) 題補充情境，共 (\d+) 題。(.*)$/))) return (en ? `You answered ${m[2]} main questions and ${m[3]} follow-ups, ${m[4]} in total. ` : `基本の質問${m[2]}問と補足の質問${m[3]}問、合計${m[4]}問に回答しました。`) + tr(m[5]);
    if ((m = text.match(/^本次觀察：(\d+) 題$/))) return en ? `Based on ${m[1]} question${m[1] === '1' ? '' : 's'} this time` : `今回の手がかり：${m[1]}問`;
    if ((m = text.match(/^這次較靠近「(.+)」$/))) return en ? `This time: ${tr(m[1])}` : `今回は「${tr(m[1])}」寄り`;
    if ((m = text.match(/^當時的主要問題沒有偏向；原封存分類保留「(.+)」。$/))) return en ? `The original main questions were balanced; the archived category “${tr(m[1])}” is retained.` : `当時の基本の質問では差が出なかったため、保存時の「${tr(m[1])}」という分類をそのまま表示しています。`;
    if ((m = text.match(/^「(.+)」目前還沒有明顯靠近哪一邊，先讓這些面向保持開放。(.*)$/))) return (en ? `No clear preference has emerged for ${tr(m[1]).replace(/、/g,', ')}. These aspects remain open. ` : `「${tr(m[1])}」にはまだはっきりした傾向がないため、今は決めずにおきます。`) + tr(m[2]);
    if ((m = text.match(/^共 (\d+) 篇，依文王卦序排列，沒有先後名次。點開一篇，看看它帶你想起什麼。$/))) return en ? `${m[1]} compatible articles, listed in the traditional King Wen order, without ranking. Open one and see what it brings to mind.` : `相容れる${m[1]}篇を文王卦序で並べています。順位ではありません。気になる文章から読んでみてください。`;
    if ((m = text.match(/^開始 (10|20|48) 題探索(.*)$/))) return en ? `Start ${m[1]} questions${m[2]}` : `${m[1]}問の探索を始める${m[2]}`;
    if ((m = text.match(/^(重新開始|清除) (10|20|48) 題探索？$/))) return en ? `${m[1] === '清除' ? 'Clear' : 'Restart'} the ${m[2]}-question exploration?` : `${m[2]}問の探索を${m[1] === '清除' ? '消去' : 'やり直し'}ますか？`;
    if ((m = text.match(/^(10|20|48) 題探索的本機紀錄已清除。$/))) return en ? `The ${m[1]}-question record has been cleared from this browser.` : `${m[1]}問の記録をこのブラウザーから消去しました。`;
    if ((m = text.match(/^(\d+) \/ 64 種原型$/))) return en ? `${m[1]} / 64 archetypes` : `${m[1]}／64の原型`;
    if ((m = text.match(/^(\d+)條核心題句$/))) return en ? `${m[1]} core statements` : `${m[1]}の基本質問文`;
    if ((m = text.match(/^第\s*(\d+)\s*卦(.*)$/))) return (en ? `Hexagram ${m[1]}` : `第${m[1]}卦`) + tr(m[2]);
    if ((m = text.match(/^(.+)。左側是(.+)，右側是(.+)。(.+)$/))) return en ? `${tr(m[1])}. Left: ${tr(m[2])}; right: ${tr(m[3])}. ${tr(m[4])}` : `${tr(m[1])}。左は${tr(m[2])}、右は${tr(m[3])}。${tr(m[4])}`;
    return null;
  }
  function translate(value, code = current) {
    const text = String(value == null ? '' : value);
    if (!valid(code) || code === 'zh-Hant' || !text.trim() || protectedQuotes.has(text.trim())) return text;
    const leading = (text.match(/^\s*/) || [''])[0], trailing = (text.match(/\s*$/) || [''])[0], core = text.trim();
    const pack = packs[code];
    if (!pack) return text;
    if (EXTRA_LOCALES.has(code) && own(imageNames,core)) return leading + nature(core,code) + trailing;
    if ((code === 'en' || code === 'ja') && own(imageNames,core)) return leading + imageNames[core][code === 'en' ? 0 : 1] + trailing;
    let result = own(pack.messages,core) ? pack.messages[core] : dynamic(core,code);
    if (result === null) result = phrase(core,code);
    if (code === 'en') result = result.replace(/(\d+) 題/g,'$1 questions');
    if (code === 'ja') result = result.replace(/(\d+) 題/g,'$1問');
    return leading + result + trailing;
  }
  function allowed(element) {
    return element && !element.closest('script,style,noscript,[translate="no"],.brand,.footer-brand,.brand-mark,.report-quote');
  }
  function updateText(node) {
    if (!allowed(node.parentElement)) return;
    let record = sources.get(node);
    if (!record || node.nodeValue !== record.output) record = {source:node.nodeValue};
    let output = translate(record.source);
    // A hidden responsive line break still separates English words.
    if (LATIN_LOCALES.has(current) && node.nextSibling && node.nextSibling.nodeName === 'BR' && output && !/\s$/.test(output)) output += ' ';
    record.output = output; sources.set(node,record);
    if (node.nodeValue !== output) node.nodeValue = output;
    if (protectedQuotes.has(record.source.trim())) node.parentElement.setAttribute('lang','zh-Hant');
  }
  const attrs = ['aria-label','title','placeholder','alt'];
  function updateAttributes(element) {
    if (!allowed(element)) return;
    let records = attributeSources.get(element) || {};
    attrs.forEach(name => {
      if (!element.hasAttribute(name)) return;
      const value = element.getAttribute(name);
      let record = records[name];
      if (!record || value !== record.output) record = {source:value};
      record.output = translate(record.source); records[name] = record;
      if (value !== record.output) element.setAttribute(name,record.output);
    });
    attributeSources.set(element,records);
  }
  function apply(root = doc && doc.body) {
    if (!doc || !root || busy) return;
    busy = true;
    try {
      if (root.nodeType === 3) updateText(root);
      else {
        if (root.nodeType === 1) updateAttributes(root);
        const walker = doc.createTreeWalker(root, global.NodeFilter.SHOW_ELEMENT | global.NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeType === 3) updateText(node); else updateAttributes(node);
        }
      }
      const title = doc.querySelector('title');
      if (title && title.firstChild) {
        let record = sources.get(title.firstChild);
        if (!record || title.firstChild.nodeValue !== record.output) record = {source:title.firstChild.nodeValue};
        record.output = translate(record.source); sources.set(title.firstChild,record);
        if (title.firstChild.nodeValue !== record.output) title.firstChild.nodeValue = record.output;
      }
      const meta = doc.querySelector('meta[name="description"]');
      if (meta) {
        if (!meta.dataset.source) meta.dataset.source = meta.content;
        meta.content = translate(meta.dataset.source);
      }
    } finally { busy = false; }
  }
  async function load(code) {
    if (code === 'zh-Hant' || packs[code]) return;
    const response = await global.fetch('./locales/' + code + '.json?v=' + CONTENT_VERSION, {credentials:'same-origin'});
    if (!response.ok) throw new Error('Language pack unavailable');
    register(code, await response.json());
  }
  function setStatus(source) {
    const status = doc && doc.getElementById('language-status');
    if (status) status.textContent = translate(source);
  }
  async function setLocale(code) {
    if (!valid(code)) return false;
    const token = ++request;
    setStatus('正在切換語言…');
    if (doc) doc.documentElement.setAttribute('data-language-loading','');
    try { await load(code); } catch (_) {
      if (token === request) {
        const select = doc && doc.getElementById('language-select');
        if (select) select.value = current;
        setStatus('語言載入失敗，請再試一次。');
        if (doc) doc.documentElement.removeAttribute('data-language-loading');
      }
      return false;
    }
    if (token !== request) return false;
    current = code;
    if (doc) {
      doc.documentElement.lang = code;
      doc.documentElement.dataset.locale = code;
      const select = doc.getElementById('language-select'); if (select) select.value = code;
      if (select) select.setAttribute('aria-label',EXTRA_LOCALES.has(code) ? format(code,'languageLabel') : {en:'Language',ja:'言語','zh-Hans':'语言','zh-Hant':'語言'}[code]);
      const brand = doc.querySelector('.brand');
      if (brand) brand.setAttribute('aria-label',EXTRA_LOCALES.has(code) ? format(code,'homeLabel') : {en:'Gua Jian Self, home',ja:'卦見自己、ホームへ','zh-Hans':'卦见自己，回到首页','zh-Hant':'卦見自己，回首頁'}[code]);
      try { global.localStorage.setItem(KEY,code); } catch (_) {}
      try { const url = new URL(global.location.href); url.searchParams.set('lang',code); global.history.replaceState(global.history.state,'',url.href); } catch (_) {}
      apply(); setStatus('');
      doc.documentElement.removeAttribute('data-language-loading');
      global.dispatchEvent(new CustomEvent('gua:languagechange', {detail:{locale:code}}));
    }
    return true;
  }
  let preferred = 'en';
  if (doc) {
    const preferences = {};
    try { preferences.url = global.location.href; } catch (_) {}
    try { preferences.saved = global.localStorage.getItem(KEY); } catch (_) {}
    try { preferences.languages = global.navigator.languages; } catch (_) {}
    try { preferences.language = global.navigator.language; } catch (_) {}
    preferred = selectInitialLocale(preferences);
  }
  const ready = doc ? setLocale(preferred).then(() => {
    const select = doc.getElementById('language-select');
    if (select) select.addEventListener('change', () => setLocale(select.value));
    observer = new MutationObserver(records => {
      const roots = new Set();
      records.forEach(record => {
        if (record.type === 'characterData') roots.add(record.target);
        else if (record.type === 'attributes') roots.add(record.target);
        else record.addedNodes.forEach(node => roots.add(node));
      });
      roots.forEach(root => { if (root.isConnected) apply(root); });
    });
    observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});
    doc.documentElement.removeAttribute('data-language-loading');
  }) : Promise.resolve();
  global.GuaI18n = Object.freeze({VERSION,LOCALES,KEY,locale:() => current,matchLocale,selectInitialLocale,register,translate,apply,setLocale,ready});
})(typeof window !== 'undefined' ? window : globalThis);
