(function () {
  'use strict';
  const D = window.GuaData;
  const Core = window.GuaCore;
  const Short = window.GuaShort;
  const Full = window.GuaFull;
  const Legacy = window.GuaShortLegacy;
  const Sessions = window.GuaSessions;
  const ResultCopy = window.GuaResultCopy;
  const QuestionCopy = window.GuaQuestionCopy;
  const main = document.getElementById('main');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => Number.isInteger(Number(value)) ? Number(value) : 0;
  let storageAvailable = true;
  let storageMessage = '';
  let toastTimer;
  let currentReportId = null;
  let currentReportMode = null;
  let currentReportLegacy = false;
  let routeToken = 0;
  let baseStorage;
  try { baseStorage = window.localStorage; } catch (_) { baseStorage = null; }
  function stripRetiredTestLink() {
    const url = new URL(location.href);
    const retiredKeys = ['qa','qaRun','qaCase','qaMode','qaSeed'];
    if (!retiredKeys.some(key => url.searchParams.has(key)) && !/^#qa(?:[/?]|$)/.test(url.hash)) return;
    retiredKeys.forEach(key => url.searchParams.delete(key));
    url.hash = '#home';
    history.replaceState(null, '', url.href);
  }
  stripRetiredTestLink();
  const storage = baseStorage;
  const loaded = Sessions.load(storage);
  let envelope = loaded.envelope;
  let state = envelope.sessions[envelope.activeMode];
  storageAvailable = loaded.storageAvailable;
  storageMessage = loaded.message;
  const modeLabel = mode => mode === 48 ? '48 題資深探索' : mode === 20 ? '20 題標準探索' : '10 題快速探索';
  const quizRoute = () => '#quiz/' + state.mode;
  const resultRoute = () => '#result/' + state.mode;
  function adopt(result) {
    envelope = result.envelope; state = envelope.sessions[envelope.activeMode];
    storageAvailable = result.storageAvailable;
    storageMessage = result.message || '';
  }
  function useMode(mode) {
    envelope.sessions[state.mode] = state;
    envelope = Sessions.select(envelope, mode); state = envelope.sessions[mode];
    persist();
  }
  function sessionModel() { return state.mode === 48 ? state.full : state.short; }
  function sessionQuestions() { return state.mode === 48 ? Full.questions(state.full) : Short.questions(state.short); }
  function questionAnswer(item, index) {
    if (state.mode !== 48) return index < state.short.answers.length ? state.short.answers[index] : null;
    const answers = item.isClarification ? state.full.clarificationAnswers : state.full.answers;
    return own(answers, item.id) ? answers[item.id] : null;
  }
  function scoredState() {
    const model = sessionModel();
    return model ? (state.mode === 48 ? Full.score(model) : Short.score(model)) : { finished:false, complete:false, answered:0, total:state.mode };
  }
  function answeredCount() { return state.started ? scoredState().answered : 0; }
  function persist() {
    envelope.sessions[state.mode] = state;
    adopt(Sessions.save(storage, envelope));
    updateSaveStatus();
  }
  function updateSaveStatus() {
    const el = document.getElementById('save-status');
    if (el) el.textContent = storageAvailable ? '進度僅儲存在此瀏覽器・可以隨時離開再回來' : storageMessage;
  }
  function toast(message) {
    const el = document.getElementById('toast'); clearTimeout(toastTimer);
    el.textContent = message; el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 5200);
  }
  function getHex(id) { return D.iching.hexagrams.find(h => h.number === Number(id)); }
  function getTri(id) { return D.iching.trigrams.find(t => t.number === Number(id)); }
  function guaName(id) { const h = getHex(id); return h.topTrigram === h.bottomTrigram ? h.chineseName + '為' + getTri(h.topTrigram).chineseImage : getTri(h.topTrigram).chineseImage + getTri(h.bottomTrigram).chineseImage + h.chineseName; }
  function hexSvg(id, decorative = true) {
    const h = getHex(id); if (!h) return '';
    const lines = h.lines.slice().reverse();
    const rows = lines.map((v, i) => v ? `<rect x="5" y="${8 + i * 17}" width="86" height="7"/>` : `<rect x="5" y="${8 + i * 17}" width="35" height="7"/><rect x="56" y="${8 + i * 17}" width="35" height="7"/>`).join('');
    return `<svg viewBox="0 0 96 109" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(guaName(id))}卦象"`} fill="currentColor">${rows}</svg>`;
  }
  function compass() {
    let ring = '';
    D.iching.hexagrams.forEach((h, i) => {
      const angle = i * 360 / 64 - 90, rad = angle * Math.PI / 180;
      const x = 290 + Math.cos(rad) * 235, y = 290 + Math.sin(rad) * 235;
      let lines = '';
      h.lines.slice().reverse().forEach((v, j) => { lines += v ? `<rect x="-8" y="${j * 2.8 - 7}" width="16" height="1.1"/>` : `<rect x="-8" y="${j * 2.8 - 7}" width="6.4" height="1.1"/><rect x="1.6" y="${j * 2.8 - 7}" width="6.4" height="1.1"/>`; });
      ring += `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle + 90})" fill="${i % 8 === 0 ? '#a44232' : '#6d7768'}">${lines}</g>`;
    });
    const names = ['乾 天', '兌 澤', '離 火', '震 雷', '坤 地', '艮 山', '坎 水', '巽 風'];
    const labels = names.map((name, i) => { const a = (i * 45 - 90) * Math.PI / 180; return `<text x="${290 + Math.cos(a) * 185}" y="${295 + Math.sin(a) * 185}" text-anchor="middle" fill="#697167" font-size="13" letter-spacing="5">${name}</text>`; }).join('');
    return `<svg viewBox="0 0 580 580" role="img" aria-label="六十四卦環形圖，中央為山天大畜卦"><g fill="none" stroke="#b9bfac" stroke-width=".7"><circle cx="290" cy="290" r="260"/><circle cx="290" cy="290" r="218"/><circle cx="290" cy="290" r="158"/><circle cx="290" cy="290" r="149" stroke-dasharray="2 6"/><path d="M290 18v30M290 532v30M18 290h30M532 290h30"/></g>${ring}<g font-family="serif">${labels}</g><circle cx="290" cy="290" r="128" fill="#eeeede" fill-opacity=".65"/><g fill="#283830" transform="translate(242 212)">${getHex(26).lines.slice().reverse().map((v, i) => v ? `<rect y="${i * 23}" width="96" height="8"/>` : `<rect y="${i * 23}" width="38" height="8"/><rect x="58" y="${i * 23}" width="38" height="8"/>`).join('')}</g><text x="290" y="392" font-family="serif" font-size="15" letter-spacing="7" text-anchor="middle" fill="#283830">山天大畜</text><rect x="400" y="150" width="31" height="35" rx="1" fill="#a44232" transform="rotate(5 415 167)"/><text x="416" y="174" text-anchor="middle" font-family="serif" font-size="19" fill="#faf6ed">易</text><circle cx="290" cy="30" r="3" fill="#a44232"/></svg>`;
  }
  function card(id) {
    const r = D.reports[id], h = getHex(id); if (!r || !h) return '';
    const art = D.artwork && D.artwork[id];
    const parts = r.typeKey.split('-');
    const branches = `${parts[1] === 'calm' ? '沉著' : '敏銳'}・${parts[2] === 'autonomous' ? '自主' : '協作'}`;
    return `<a class="gua-card${art ? ' with-art' : ''}" href="#atlas/${id}" aria-label="閱讀${esc(h.chineseName)}：${esc(r.title)}${r.subtitle ? '，' + esc(r.subtitle) : ''}"><span class="card-index">NO. ${String(id).padStart(2, '0')} / ${esc(h.chineseName)}</span>${art ? `<span class="artwork-frame"><img src="${esc(art.src)}" alt="${esc(r.title)}：${esc(art.conceptZh)}" width="${art.width}" height="${art.height}" loading="lazy" decoding="async"><span class="artwork-badge" aria-hidden="true">${hexSvg(id)}</span></span>` : hexSvg(id)}<h3>${esc(r.title)}</h3>${r.subtitle ? `<p class="card-reader-subtitle">${esc(r.subtitle)}</p>` : ''}<p class="card-subtitle">${esc(guaName(id))}</p><div class="card-bottom"><span>${esc(parts[0])} · ${branches}</span><span class="card-arrow" aria-hidden="true">↗</span></div></a>`;
  }
  function reportVisual(id) {
    const art = D.artwork && D.artwork[id], h = getHex(id);
    if (!art) return `<div class="report-gua">${hexSvg(id, false)}<span class="gua-fullname">${esc(guaName(id))}</span><small>第 ${id} 卦・${esc(h.pinyinName)}</small></div>`;
    return `<figure class="report-artwork"><img src="${esc(art.src)}" alt="${esc(art.title)}：${esc(art.conceptZh)}" width="${art.width}" height="${art.height}" decoding="async" fetchpriority="high"><figcaption class="portrait-caption">${hexSvg(id)}<span><strong>${esc(guaName(id))}</strong><small>第 ${id} 卦・原創設計 × AI 插畫</small></span></figcaption></figure>`;
  }
  function resetView() { currentReportId = null; currentReportMode = null; currentReportLegacy = false; }
  function page(content, title) {
    resetView(); main.innerHTML = content;
    document.title = `${title}｜卦見自己`;
  }
  function renderHome() {
    page(`<div class="container"><section class="hero"><div class="hero-copy"><span class="eyebrow">THE BOOK OF CHANGES, A MIRROR OF YOU</span><h1>在變化裡，<br>看見自己的<em>模樣。</em></h1><p class="hero-description">以人格偏好為引，以六十四卦為鏡。<br>從一道道生活小問題出發，認識你的行動節奏、<br>內在感受，以及與世界相處的方式。</p><div class="hero-actions"><a class="button button-primary" href="#explore">開始我的探索 <span aria-hidden="true">↗</span></a><a class="text-link" href="#atlas">先翻翻六十四卦 <span aria-hidden="true">→</span></a></div><p class="hero-meta"><span>10／20 題，依你的步調選擇</span><i class="tiny-dot"></i><span>6 個生活面向</span><i class="tiny-dot"></i><span>答案只留本機</span></p>${resumeList('home-resumes')}</div><div class="hero-art">${compass()}<span class="art-margin-note">觀乎人文，以化成天下。</span><span class="art-caption">六十四種意象・六十四面鏡子</span></div></section><div class="hero-foot"><p>一卦一面，皆是自己。</p><span class="foot-symbol" aria-hidden="true">䷊</span><p class="foot-right">古老的智慧，當代的提問。<br>把每一種傾向，讀成理解自己的起點。</p></div><section class="section-space"><div class="section-head"><div><span class="section-label">一場向內的旅程</span><h2>熟悉的人格，多一層看見。</h2></div><p>保留四種人格偏好的熟悉感，加入情緒與協調方式，再從卦義找到新的觀察角度。</p></div><div class="journey-grid"><article class="journey-item"><span class="journey-number">01</span><h3>覺察你的偏好</h3><p>精神如何恢復、資訊如何接收、決定如何形成、生活如何安排。從日常選擇，慢慢看見傾向。</p><span class="math">四組偏好 → 16 種組合</span></article><article class="journey-item"><span class="journey-number">02</span><h3>聽見內在的回應</h3><p>變化帶來的感受是平緩或鮮明？形成方案前，你較喜歡獨立整理或共同討論？兩端都有自己的力量。</p><span class="math">沉著／敏銳 × 自主／協作</span></article><article class="journey-item"><span class="journey-number">03</span><h3>遇見一面卦象之鏡</h3><p>每一型依卦義原創配對，細讀文化背景、優勢與成長課題。透過具體建議，帶一點新理解回到生活。</p><span class="math">16 × 2 × 2 = 64 型原型</span></article></div></section><section class="section-space featured-section"><div class="section-head"><div><span class="section-label">先遇見一種可能</span><h2>每一卦，都有自己的風景。</h2></div><a class="text-link" href="#atlas">走進六十四卦圖鑑 <span aria-hidden="true">↗</span></a></div><div class="card-grid">${[1, 61, 15, 64].map(card).join('')}</div></section><section class="closing-banner"><div><h2>答案，在你的生活裡。</h2><p>給自己一段安靜的時間。從最近三個月的真實感受開始。</p></div><a class="button" href="#explore">展開這次探索 <span aria-hidden="true">↗</span></a></section></div>`, '在變化裡，看見自己的模樣');
  }
  function archiveLabel(mode) { return mode === 48 ? '48 題・舊版資深封存' : mode + ' 題・舊版二選一封存'; }
  function modeProgress(mode) {
    const saved = envelope.sessions[mode];
    const scored = saved.started ? (mode === 48 ? Full.score(saved.full) : Short.score(saved.short)) : null;
    const count = scored ? scored.answered : 0;
    const text = !saved.started ? '尚未開始' : saved.phase === 'done' ? (!scored.complete ? '已完成・有些面向保持開放' : '已完成・可查看結果') : `主要問題 ${scored.mainAnswered}／${mode}${scored.mainAnswered === mode ? `・補充情境 ${scored.clarificationAnswered}／${scored.clarificationTotal}` : '・必要時另加補充情境'}`;
    return { saved, count, text };
  }
  function resumeList(className = '') {
    const modes = [10, 20, 48].filter(mode => envelope.sessions[mode].started);
    const archives = [10, 20, 48].filter(mode => envelope.archives && envelope.archives[mode] && envelope.archives[mode].started);
    if (!modes.length && !archives.length) return '';
    return `<div class="saved-modes ${className}" aria-label="各版本的本機進度">${modes.map(mode => `<a href="#${envelope.sessions[mode].phase === 'done' ? 'result' : 'quiz'}/${mode}"><span>${modeLabel(mode)}</span><span>${modeProgress(mode).text} <span aria-hidden="true">→</span></span></a>`).join('')}${archives.map(mode => `<a href="#archive/${mode}"><span>${archiveLabel(mode)}</span><span>唯讀 ${mode === 48 ? Object.keys(envelope.archives[mode].answers).length : envelope.archives[mode].short.answers.length}／${mode} 題 <span aria-hidden="true">→</span></span></a>`).join('')}</div>`;
  }
  function modeComparison() {
    return `<section class="mode-comparison"><h2>依照今天的時間，選一個適合你的長度。</h2><div class="comparison-scroll"><table><caption>每種長度，會遇見多少生活情境</caption><thead><tr><th scope="col">版本</th><th scope="col">含補充情境總題數</th><th scope="col">六個面向的主要問題</th><th scope="col">安排方式</th></tr></thead><tbody><tr><th scope="row">10 題快速</th><td>10–16 題</td><td>3／3／1／1／1／1</td><td>依回答安排</td></tr><tr><th scope="row">20 題標準</th><td>20–26 題</td><td>5／3／3／3／3／3</td><td>依回答安排</td></tr><tr><th scope="row">48 題資深</th><td>48–54 題</td><td>8／8／8／8／8／8</td><td>開始時固定全卷</td></tr></tbody></table></div><p>短版依回答安排後續問題，各面向的題數可能不同。三種長度都可以選「介於兩者」；某個面向還沒看出方向時，最多再問一道補充情境，之後仍可保持開放。你可以閱讀原創 64 型文章與插畫，答案只留在這個瀏覽器。新版採用288條直接行為句，十萬筆歷史情境組合保留來源。題目尚未逐題完成心理測量驗證。</p></section>`;
  }
  function introDisclaimer() {
    return '<p class="intro-disclaimer">受人格偏好與易經文化啟發的原創探索，非官方 MBTI® 評估。<br>分類與配卦屬本產品創作；結果可作自我反思的起點。<a href="#method">了解方法 →</a></p>';
  }
  function renderExplore() {
    const selected = envelope.preferredMode === 20 ? 20 : 10;
    page(`<div class="container page-heading centered"><span class="section-label">從你的步調出發</span><h1>留一點時間，<br class="mobile-heading-break">聽聽自己。</h1><p>想著最近三個月的大多數情況，選擇較接近你的回答。<br>不用急著選出一個固定的自己，有些面向暫時保持開放也沒關係。</p></div><section class="intro-box mode-intro"><fieldset class="mode-options"><legend>這次，想走多遠？</legend>${[10,20].map(mode => `<label class="mode-option"><input type="radio" name="explore-mode" value="${mode}" ${selected === mode ? 'checked' : ''}><span><strong>${mode} 題・${mode === 10 ? '快速探索' : '標準探索'}</strong><span>${mode === 10 ? '從六個生活面向輕輕開始，適合第一次認識自己。' : '多一些生活情境，為六個生活面向留下更多觀察。'}</span><small>${modeProgress(mode).text}</small></span></label>`).join('')}</fieldset><p class="mode-explanation">每題從「非常不像我」到「非常像我」選一個程度，也可以選「介於兩者」。新版直接問生活中的行為，不再重複鋪陳背景。已有舊進度時，請按「重新抽題探索」啟用新版。問題會隨你的回答往下安排；某個面向還沒看出方向時，會再多問一道補充情境。因此 10 題版共答 10–16 題，20 題版共答 20–26 題。有些面向最後仍可能保持開放，結果會留幾篇相容文章讓你慢慢讀。短版的線索有限，先當作認識自己的起點就好。</p><div id="selected-mode-status" class="mode-selected-status" role="status"></div>${storageMessage ? `<div class="notice${storageAvailable ? '' : ' warning'}">${esc(storageMessage)}</div>` : ''}<div class="intro-actions"><button class="button button-primary" id="start-selected-mode" data-action="start-mode" data-mode="${selected}"></button><button class="button button-quiet" id="restart-selected-mode" data-action="restart" data-mode="${selected}" hidden>重新抽題探索</button></div><p class="senior-link">想觀察更多生活情境？<a href="#senior">前往 48 題資深探索 →</a></p>${modeComparison()}${introDisclaimer()}${resumeList()}</section>`, '選擇探索長度');
    const update = () => {
      const mode = Number(document.querySelector('input[name="explore-mode"]:checked').value);
      const progress = modeProgress(mode);
      document.getElementById('selected-mode-status').textContent = `${modeLabel(mode)}・${progress.text}。各版本分開保存，切換不會覆蓋其他進度。`;
      const start = document.getElementById('start-selected-mode'); start.dataset.mode = String(mode);
      start.textContent = progress.saved.phase === 'done' ? '查看這次結果 ↗' : progress.saved.started ? '繼續這次探索 →' : `開始 ${mode} 題探索 ↗`;
      const restart = document.getElementById('restart-selected-mode'); restart.dataset.mode = String(mode); restart.hidden = !progress.saved.started;
    };
    document.querySelectorAll('input[name="explore-mode"]').forEach(input => input.addEventListener('change', () => { envelope.preferredMode = Number(input.value); persist(); update(); }));
    update();
  }
  function renderSenior() {
    const progress = modeProgress(48);
    page(`<div class="container page-heading centered"><span class="section-label">SENIOR EXPLORATION</span><h1>多一點層次，細讀你的模樣。</h1><p>48 題資深探索，以五個程度保留生活裡的細微差異。<br>給自己一段安靜的時間，從六個生活面向慢慢看見傾向。</p></div><section class="intro-box senior-intro"><span class="mode-badge">48 題・資深探索</span><div class="notice trial-notice"><strong>目前免費試用</strong><br>未來可能收費，目前可直接完成全部探索與解讀。</div><ul class="intro-list"><li><span class="intro-icon">一</span><span><strong>48 道生活情境題・五點回答</strong><br>六個生活面向各有 8 題，從不同角度慢慢問。還沒看出方向的面向，最多再加一道補充情境，共答 48–54 題；之後仍可能暫時保持開放。</span></li><li><span class="intro-icon">二</span><span><strong>保留原題，隨時回來</strong><br>這次的進度會留在此瀏覽器。舊版完成的結果可以繼續閱讀；舊版未完成的 48 題探索，也能保留主要問題與答案接著走，補充情境會依新版規則重新安排。</span></li><li><span class="intro-icon">三</span><span><strong>完整的原型文章與插畫</strong><br>閱讀你的 64 型原型、卦象故事，以及可以帶回生活的小練習。</span></li></ul>${progress.saved.started ? `<div class="resume-banner"><span>${progress.text}</span><a href="#${progress.saved.phase === 'done' ? 'result' : 'quiz'}/48" class="text-link">${progress.saved.phase === 'done' ? '查看結果' : '繼續探索'} →</a></div>` : ''}${storageMessage ? `<div class="notice${storageAvailable ? '' : ' warning'}">${esc(storageMessage)}</div>` : ''}<div class="intro-actions"><button class="button button-primary" data-action="start-mode" data-mode="48">${progress.saved.phase === 'done' ? '查看我的結果' : progress.saved.started ? '繼續我的資深探索' : '開始 48 題資深探索'} ↗</button>${progress.saved.started ? '<button class="button button-quiet" data-action="restart" data-mode="48">重新抽題探索</button>' : ''}</div><p class="senior-link"><a href="#explore">回到 10／20 題一般探索 →</a></p>${modeComparison()}${introDisclaimer()}${resumeList()}</section>`, '48 題資深探索');
  }
  function renderIntro() { return state.mode === 48 ? renderSenior() : renderExplore(); }
  function prepareForm() {
    if (!window.GuaBank || !D.bank || D.bank.count < 5000) throw new Error('題庫尚未完整載入，請重新整理後再試。');
    const seed = new Uint32Array(1);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(seed);
    else seed[0] = Date.now() ^ Math.floor(Math.random() * 0xffffffff);
    const mode = state.mode;
    state = Sessions.blank(mode);
    if (mode === 48) state.full = Full.create(seed[0], {wording:'direct-v1'});
    else state.short = Short.create(mode, seed[0], {wording:'direct-v1'});
    state.started = true; state.phase = 'quiz'; persist();
  }
  function navigate(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function startMode(mode) {
    useMode(mode);
    if (!state.started) prepareForm();
    navigate(state.phase === 'done' ? resultRoute() : quizRoute());
  }
  function showAnswerError() { const e = document.getElementById('answer-error'); if (e) e.hidden = false; }
  function renderQuiz() {
    if (!state.started) { navigate(state.mode === 48 ? '#senior' : '#explore'); return; }
    if (state.phase === 'done') { navigate(resultRoute()); return; }
    if (state.phase !== 'quiz') { state.phase = 'quiz'; persist(); }
    return renderFivePointQuiz();
  }
  function responseHint() {
    if (!state.started) return '';
    const items = sessionQuestions(), values = items.map(questionAnswer).filter(value => value !== null);
    let longest = 0, run = 0, previous = null;
    values.forEach(value => { run = value === previous ? run + 1 : 1; previous = value; longest = Math.max(longest, run); });
    return longest >= 8 ? '<p class="response-hint">你有一段連續使用相同選項。這仍是有效回答；可以再回想各題情境，確認每一題都貼近最近的自己。</p>' : '';
  }
  function renderFivePointQuiz() {
    const items = sessionQuestions();
    state.questionIndex = Math.max(0, Math.min(state.questionIndex, items.length - 1));
    const position = state.questionIndex, item = items[position], scored = scoredState(), count = scored.answered;
    const selected = questionAnswer(item, position), clarification = item.isClarification === true;
    const direct = state.mode === 48 ? state.full.formOrigin === 'direct-v1' : state.short.version === '2.1.0';
    const questionText = direct ? QuestionCopy.render(item).text : item.text;
    const oldPromptNotice = direct ? '' : '<div class="notice">這次進度保留舊版題文。想使用不帶重複背景的新版行為題，請重新開始這個版本。<button class="button button-quiet" data-action="restart" data-mode="' + state.mode + '">使用新版題目重新開始</button></div>';
    const revisingEarlier = state.mode !== 48 && position < state.short.answers.length - 1;
    const counter = clarification ? `主要問題 ${state.mode}/${state.mode}・補充情境 <strong>${position - state.mode + 1}</strong>/${scored.clarificationTotal}` : `<strong>${String(position + 1).padStart(2,'0')}</strong>/${state.mode}`;
    const progressText = `主要問題已答 ${scored.mainAnswered}／${state.mode} 題${scored.mainAnswered === state.mode ? `・補充情境已答 ${scored.clarificationAnswered}／${scored.clarificationTotal} 題・本次共 ${scored.total} 題` : `・必要時另加 0–6 題補充情境，合計 ${state.mode}–${state.mode + 6} 題`}`;
    const choices = [{ value:-2, text:'非常不像我' }, { value:-1, text:'比較不像我' }, { value:0, text:'介於兩者' }, { value:1, text:'比較像我' }, { value:2, text:'非常像我' }];
    const nextText = scored.finished && position === items.length - 1 ? '查看這次結果 ↗' : position === state.mode - 1 && scored.mainAnswered < state.mode ? '完成主要問題 →' : '下一題 →';
    const chapters = state.mode === 48 ? `<div class="chapter-steps">${['日常裡的你','學習與做事','變化與選擇','關係與未來'].map((title,index) => `<span class="chapter-step ${!clarification && item.chapter === index + 1 ? 'active' : ''}"><span class="step-num">0${index + 1}</span>${title}</span>`).join('')}</div>` : '';
    page(`<section class="quiz-shell short-quiz"><div class="quiz-top"><a href="${state.mode === 48 ? '#senior' : '#explore'}">← 暫停，回到探索入口</a><span class="mode-badge">${modeLabel(state.mode)}・五點回答</span><span class="question-counter">${counter}</span></div><div class="progress-track" role="progressbar" aria-label="${scored.mainAnswered === state.mode ? '本次主要問題與補充情境總作答進度' : '主要問題作答進度，必要時另加補充情境'}" aria-valuemin="0" aria-valuemax="${scored.total}" aria-valuenow="${count}"><span style="width:${count / scored.total * 100}%"></span></div><p class="short-progress" aria-live="polite">${progressText}${selected !== null ? '・正在回看已答題目' : ''}</p>${oldPromptNotice}${chapters}<div class="quiz-paper"><p class="quiz-hint">回想最近三個月，選擇最接近你的程度。</p>${clarification ? '<p class="branch-notice">前面的回答還沒讓這個面向明顯靠近哪一邊，我們再看一個生活情境。每個面向最多多問一次，之後仍可以保持開放。</p>' : ''}${revisingEarlier ? '<p class="branch-notice" id="branch-notice">修改本題會重新安排後續問題；只回看或維持原答案，會保留目前進度。</p>' : state.mode === 48 && selected !== null ? '<p class="branch-notice">主要問題固定不變。修改主要問題答案後，會重新確認哪些面向需要補充情境，原本的補充情境答案會清除；只回看或維持原答案則保留進度。</p>' : ''}<fieldset class="short-options" ${revisingEarlier ? 'aria-describedby="branch-notice"' : ''}><legend tabindex="-1">${esc(questionText)}</legend><div class="short-choice-grid">${choices.map((choice,i) => `<label class="short-option"><input id="short-answer-${i + 1}" type="radio" name="short-answer" value="${choice.value}" ${selected === choice.value ? 'checked' : ''}><span><span class="option-key" aria-hidden="true">${i + 1}</span><span>${choice.text}</span></span></label>`).join('')}</div></fieldset><p id="answer-error" class="answer-error" role="alert" hidden>請先選擇一個答案，再繼續。</p>${responseHint()}</div><div class="quiz-navigation"><button class="button button-quiet" id="previous-question" ${position === 0 ? 'disabled' : ''}>← 上一題</button><span class="quiz-shortcut">1–5 選擇・Enter 下一題</span><button class="button button-primary" id="next-question">${nextText}</button></div><p class="quiz-status" id="save-status"></p><p class="quiz-help-link">這是偏好的探索，每一端都有它的價值。<br>選「介於兩者」也算完整回答，照著最近的自己選就好。</p></section>`, `${state.mode} 題探索・${clarification ? '補充情境' : '主要問題'}第 ${clarification ? position - state.mode + 1 : position + 1} 題`);
    document.querySelectorAll('input[name="short-answer"]').forEach(input => input.addEventListener('change', () => {
      if (state.mode === 48) state.full = Full.answer(state.full, item.id, Number(input.value));
      else state.short = Short.answer(state.short, state.questionIndex, Number(input.value));
      state.phase = 'quiz'; persist(); renderFivePointQuiz();
      const focused = document.getElementById(input.id); if (focused) focused.focus({preventScroll:true});
    }));
    document.getElementById('previous-question').onclick = () => {
      if (state.questionIndex > 0) { state.questionIndex--; persist(); renderFivePointQuiz(); document.querySelector('.short-options legend').focus({preventScroll:true}); }
    };
    document.getElementById('next-question').onclick = nextFivePointQuestion;
    updateSaveStatus();
  }
  function nextFivePointQuestion() {
    const items = sessionQuestions(), item = items[state.questionIndex];
    if (questionAnswer(item, state.questionIndex) === null) {
      showAnswerError(); document.getElementById('short-answer-1').focus(); return;
    }
    const scored = scoredState();
    if (scored.finished && state.questionIndex === items.length - 1) return finishExploration();
    if (state.questionIndex >= items.length - 1) {
      const missing = items.findIndex((question,index) => questionAnswer(question,index) === null);
      if (missing < 0) return finishExploration();
      state.questionIndex = missing;
    } else state.questionIndex++;
    persist(); renderFivePointQuiz();
    const heading = document.querySelector('.short-options legend'); heading.focus({preventScroll:true}); heading.scrollIntoView({block:'nearest'});
  }
  function finishExploration() {
    if (!scoredState().finished) return renderFivePointQuiz();
    state.phase = 'done'; persist(); navigate(resultRoute());
  }
  function renderAtlas() {
    const types = Array.from(new Set(Object.keys(D.mapping).map(k => k.split('-')[0])));
    page(`<div class="container"><section class="page-heading"><span class="section-label">64 ARCHETYPES</span><h1>六十四面鏡子，各有風景。</h1><p>翻閱原型，認識卦義與不同的生活姿態。這裡是文化圖鑑；完成探索後，會再為你整理這次回答裡的生活線索。</p></section><div class="atlas-tools"><label class="skip-link" for="atlas-search">搜尋卦名、稱號或人格類型</label><input id="atlas-search" class="search-input" type="search" placeholder="搜尋卦名、稱號或人格類型" autocomplete="off"><label class="skip-link" for="atlas-type">人格類型篩選</label><select id="atlas-type" class="filter-select"><option value="">所有人格類型</option>${types.map(t => `<option>${t}</option>`).join('')}</select><label class="skip-link" for="atlas-emotion">情緒分支篩選</label><select id="atlas-emotion" class="filter-select"><option value="">所有情緒分支</option><option value="calm">沉著</option><option value="sensitive">敏銳</option></select><span class="atlas-count" id="atlas-count"></span></div><div id="atlas-grid" class="card-grid atlas-grid" aria-live="polite"></div></div>`, '六十四卦圖鑑');
    function filter() {
      const search = document.getElementById('atlas-search').value.trim().toLowerCase(), type = document.getElementById('atlas-type').value, emotion = document.getElementById('atlas-emotion').value;
      const ids = D.iching.hexagrams.filter(h => { const r = D.reports[h.number]; if (!r) return false; const parts = r.typeKey.split('-'); return (!type || parts[0] === type) && (!emotion || parts[1] === emotion) && (!search || `${h.chineseName} ${guaName(h.number)} ${r.title} ${r.subtitle || ''} ${parts[0]}`.toLowerCase().includes(search)); }).map(h => h.number);
      document.getElementById('atlas-count').textContent = `${ids.length} / 64 種原型`;
      document.getElementById('atlas-grid').innerHTML = ids.length ? ids.map(card).join('') : '<p class="empty-state">這個條件尚未找到原型，試試其他卦名或清除篩選。</p>';
    }
    document.getElementById('atlas-search').addEventListener('input', filter); document.getElementById('atlas-type').addEventListener('change', filter); document.getElementById('atlas-emotion').addEventListener('change', filter); filter();
  }
  function scorePanel(scored) {
    return `<section class="score-section" data-copy-version="${ResultCopy.VERSION}"><h2>${scored.legacy ? '回看當時的六個傾向' : '從這次回答，認識自己的六個面向'}</h2><p>${scored.legacy ? '沿用封存時的回答與分類，換成日常語言陪你回看。' : '圓點幫你看見這次回答較靠近哪一邊。每個面向都只有這次作答的線索，可以帶回生活慢慢對照。'}</p><div class="score-grid">${ResultCopy.axes(scored, D.axes).map(copy => `<div class="axis-row ${copy.nearMidpoint ? 'axis-near' : ''}${copy.open ? ' axis-unresolved' : ''}"><div class="axis-heading"><strong>${esc(copy.label)}</strong><span>${esc(copy.heading)}</span></div><div class="axis-labels"><span class="${copy.side === 'positive' ? 'selected' : ''}">${esc(copy.positive)}</span><span class="${copy.side === 'negative' ? 'selected' : ''}">${esc(copy.negative)}</span></div><div class="axis-track" role="img" aria-label="${esc(copy.accessibleLabel)}"><span class="axis-marker" style="left:${copy.position}%"></span></div><p class="axis-direction">${esc(copy.direction)}</p>${copy.qualifiers.map(note => `<p class="axis-note">${esc(note)}</p>`).join('')}<p class="axis-count">本次觀察：${copy.count} 題</p></div>`).join('')}</div><p class="score-method-link"><a href="#method">想知道怎麼整理這些回答？閱讀計分與方法 →</a></p></section>`;
  }
  function renderPersonal() {
    const scored = scoredState();
    const finished = scored.finished;
    if (!state.started || !finished) { page(`<div class="error-state"><span class="eyebrow">${modeLabel(state.mode)}・探索還在途中</span><h1>完成作答，展開這次觀察。</h1><p>這個連結不含作答資料，請在原本的瀏覽器續答。</p><a class="button button-primary" href="${state.started ? quizRoute() : state.mode === 48 ? '#senior' : '#explore'}">${state.started ? '回到這次探索' : '前往探索入口'} →</a></div>`, '探索還在途中'); return; }
    if (!scored.complete) return renderUncertain(scored);
    renderReport(scored.hexagramId, scored);
  }
  function renderUncertain(scored) {
    const ids = scored.candidateHexagramIds.slice().sort((a, b) => a - b);
    const unresolved = ResultCopy.axes(scored, D.axes).filter(copy => copy.open).map(copy => copy.label).join('、');
    page(`<article class="report-shell uncertain-report" data-copy-version="${ResultCopy.VERSION}"><div class="report-breadcrumb"><a href="#home">← 回到首頁</a><span>這次探索已完成</span></div><header class="uncertain-heading"><span class="mode-badge">${modeLabel(scored.mode)}・五點回答</span><h1>${scored.allNeutral ? '此刻，讓答案保留開放。' : '有些面向，還可以慢慢觀察。'}</h1><p>${scored.allNeutral ? '你在主要問題與補充情境裡，都選了「介於兩者」。這次先不替你選定人格類型或一個卦象；六個面向都保持開放，你仍然可以自在翻閱每一篇。' : `「${esc(unresolved)}」目前還沒有明顯靠近哪一邊，先讓這些面向保持開放。你已經完成這次作答，下方也會保留其他面向帶出的線索。`}</p><p>已完成 ${scored.mainAnswered} 題主要問題、${scored.clarificationAnswered} 題補充情境，共 ${scored.answered} 題。每個面向最多再加一道補充情境。</p></header><div class="report-actions"><button class="button button-quiet" data-action="review-answers" data-mode="${scored.mode}">回看我的答案</button><button class="button button-quiet" data-action="restart" data-mode="${scored.mode}">重新抽題探索</button>${scored.mode !== 48 ? '<a class="button button-quiet" href="#senior">多看看生活情境：48 題資深探索 →</a>' : ''}</div>${scored.mode !== 48 ? '<p class="result-next-note">多答一些題目，能多留一些生活線索；有些面向仍可能暫時保持開放。</p>' : ''}${responseHint()}${scorePanel(scored)}<section class="candidate-section"><div class="section-head"><div><span class="section-label">慢慢翻，看看哪段讓你有感</span><h2>${scored.allNeutral ? '六十四面鏡子，任你翻閱。' : '這些文章，都和目前的線索相容'}</h2></div><p>共 ${ids.length} 篇，依文王卦序排列，沒有先後名次。點開一篇，看看它帶你想起什麼。</p></div><div class="card-grid candidate-grid">${ids.map(card).join('')}</div></section></article>`, '這次探索・保持開放');
  }
  function legacyFullEvidence(archived) {
    const previousQuestions = D.questions;
    try {
      const items = window.GuaBank.activate(window.GuaBank.restoreForm(archived.questionIds));
      const scored = Core.score(archived.answers,archived.ties);
      scored.mode = 48; scored.legacy = true; scored.legacyFull = true;
      D.axes.forEach(axis => { const score = scored.scores[axis.id]; score.total = 8; score.maxAbs = 16; score.answered = items.filter(item => item.axis === axis.id && own(archived.answers,item.id)).length; });
      return { items:items.slice(), scored:scored };
    } finally { D.questions = previousQuestions; }
  }
  function renderArchive(mode, answersOnly = false) {
    const archived = envelope.archives && envelope.archives[mode];
    if (!archived || !archived.started) return renderNotFound();
    if (mode === 48) {
      const evidence = legacyFullEvidence(archived), scored = evidence.scored;
      if (scored.complete && !answersOnly) return renderReport(scored.hexagramId,scored);
      const items = evidence.items.filter(item => own(archived.answers,item.id));
      const choiceLabel = value => ({'-2':'非常不像我','-1':'比較不像我','0':'介於兩者','1':'比較像我','2':'非常像我'})[value];
      page(`<article class="report-shell archive-report"><div class="report-breadcrumb"><a href="#senior">← 回到資深探索入口</a><span>${archiveLabel(48)}</span></div><header class="uncertain-heading"><span class="mode-badge">舊版資深封存・唯讀</span><h1>回看當時的回答。</h1><p>已回答 ${items.length}／48 道主要問題。這份紀錄保留當時的主要問題回答，以及二選一補充情境所決定的分類，僅供閱讀。</p><p>舊版回答和分類都照原樣保留；新版探索另外保存，不會改寫這份紀錄。</p></header><div class="report-actions">${scored.complete ? '<a class="button button-quiet" href="#archive/48">閱讀封存結果 →</a>' : '<button class="button button-primary" data-action="start-mode" data-mode="48">前往新版 48 題五點探索 →</button>'}</div>${scorePanel(scored)}<ol class="archive-answers">${items.map(item => `<li><span class="section-label">${esc(item.id)} / ${esc(D.axes.find(axis => axis.id === item.axis).label)}</span><h2>${esc(item.text)}</h2><p>${choiceLabel(archived.answers[item.id])}</p></li>`).join('')}</ol>${Object.keys(archived.ties).length ? `<section><h2>當時的二選一補充情境</h2><ul>${D.axes.filter(axis => own(archived.ties,axis.id)).map(axis => `<li>${esc(axis.label)}：${esc(archived.ties[axis.id] === 1 ? D.tieQuestions[axis.id].positive : D.tieQuestions[axis.id].negative)}</li>`).join('')}</ul></section>` : ''}</article>`,archiveLabel(48));
      return;
    }
    if (!archived.short || !Legacy) return renderNotFound();
    const scored = Object.assign({}, Legacy.score(archived.short), { legacy: true });
    if (scored.complete && !answersOnly) return renderReport(scored.hexagramId, scored);
    const items = Legacy.questions(archived.short).slice(0, archived.short.answers.length);
    page(`<article class="report-shell archive-report"><div class="report-breadcrumb"><a href="#explore">← 回到探索入口</a><span>${archiveLabel(mode)}</span></div><header class="uncertain-heading"><span class="mode-badge">舊版二選一封存・唯讀</span><h1>${scored.complete ? '回看當時的回答。' : '保留走過的這一段。'}</h1><p>已回答 ${archived.short.answers.length}／${mode} 題。這份紀錄保留原本的二選一答案，封存後僅供閱讀。</p><p>當時使用「比較符合我」和「比較不符合我」兩個選項。這些回答照原樣保留，沒有換成新版答案。</p></header><div class="report-actions">${scored.complete ? `<a class="button button-quiet" href="#archive/${mode}">閱讀封存結果 →</a>` : `<button class="button button-primary" data-action="start-mode" data-mode="${mode}">開始新版 ${mode} 題五點探索 →</button>`}</div><ol class="archive-answers">${items.length ? items.map((item,index) => `<li><span class="section-label">${String(index + 1).padStart(2,'0')} / ${esc(D.axes.find(axis => axis.id === item.axis).label)}</span><h2>${esc(item.text)}</h2><p>${archived.short.answers[index] === 1 ? '比較符合我' : '比較不符合我'}</p></li>`).join('') : '<li><p>這份紀錄尚未作答。</p></li>'}</ol></article>`, archiveLabel(mode));
  }
  function renderReport(id, scored) {
    const r = D.reports[id], h = getHex(id); if (!r || !h) return renderNotFound();
    const parts = r.typeKey.split('-'), emotion = parts[1] === 'calm' ? '沉著' : '敏銳', coordination = parts[2] === 'autonomous' ? '自主' : '協作';
    const top = getTri(h.topTrigram), bottom = getTri(h.bottomTrigram);
    const personal = Boolean(scored), legacy = Boolean(personal && scored.legacy);
    const reportMode = personal ? scored.mode : null;
    const context = legacy
      ? `<div class="notice">${scored.legacyFull ? '這是舊版資深探索的封存結果，保留當時的回答、補充情境所決定的分類與原型。' : '這是舊版二選一探索的封存結果，保留當時的回答、分類與原型。'}這份紀錄僅供閱讀，沒有重新判定。</div>`
      : personal ? `<div class="notice">這次完成 ${scored.mainAnswered} 題主要問題、${scored.clarificationAnswered} 題補充情境，共 ${scored.answered} 題。下方整理這些回答帶出的生活線索，題目較少或兩邊接近的面向，可以再多觀察。${reportMode !== 48 ? '想多看一些生活情境，也可以試試 <a href="#senior">48 題資深探索</a>；多答一些之後，仍可能有面向暫時保持開放。' : ''}</div>`
      : '<div class="notice">你正在翻閱文化原型圖鑑。這些描述是文章設定；可以看看哪些地方讓你想起自己的生活。</div>';
    const cultural = `<details class="report-culture"><summary>想再讀一點：卦象故事與這幅畫</summary><div class="culture-content"><section><span class="report-section-label">從古老意象開始</span><h2>這個卦在說什麼？</h2><blockquote class="report-quote">${esc(r.quote)}</blockquote><p>${esc(r.plainMeaning)}</p><a class="report-source" href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">閱讀《周易》本卦原文 ↗</a></section><section><span class="report-section-label">本產品的原創詮釋</span><h2>為什麼把它放在這裡？</h2><p>${esc(r.pairing)}</p><p class="editorial-note">這是以卦象為起點的當代比喻，原典並沒有提出這套人格分類。</p>${D.artwork && D.artwork[id] ? `<div class="artwork-reading"><h3>畫面裡的線索</h3><p>${esc(D.artwork[id].conceptZh)}</p><small>角色與場景是這份探索的視覺比喻，以 AI 生成插畫呈現。</small></div>` : ''}</section><div class="aside-box"><h2>卦象小箋</h2><dl class="aside-dl"><div><dt>文王卦序</dt><dd>第 ${id} 卦・${esc(h.chineseName)}</dd></div><div><dt>上卦 / 外在意象</dt><dd>${esc(top.chineseName)} ☯ ${esc(top.chineseImage)}</dd></div><div><dt>下卦 / 內在意象</dt><dd>${esc(bottom.chineseName)} ☯ ${esc(bottom.chineseImage)}</dd></div></dl></div></div></details>`;
    page(`<article class="report-shell" data-copy-version="${ResultCopy.VERSION}"><div class="report-breadcrumb"><a href="${personal ? '#home' : '#atlas'}">← ${personal ? '回到首頁' : '返回原型圖鑑'}</a><span>${personal ? '這次探索的文化原型' : '原型圖鑑・閱讀示例'} / NO. ${String(id).padStart(2, '0')}</span></div>
      <header class="report-hero"><div><span class="eyebrow">${personal ? 'A MIRROR OF YOUR PRESENT SELF' : 'AN ARCHETYPE TO EXPLORE'}</span><span class="mode-badge report-mode">${legacy ? archiveLabel(reportMode) : personal ? modeLabel(reportMode) + '・五點回答' : '原型圖鑑・閱讀示例'}</span><p class="report-type">${esc(parts[0])} · ${emotion} × ${coordination}</p><h1>${esc(r.title)}</h1>${r.subtitle ? `<p class="report-subtitle">${esc(r.subtitle)}</p>` : ''}<p class="summary">${esc(r.summary)}</p></div>${reportVisual(id)}</header>
      ${legacy && scored.allNeutral ? '<div class="notice warning">當時主要問題都選了「介於兩者」。這個封存原型沿用當時補充情境所決定的分類，可以當作一篇閱讀與反思的文章。</div>' : ''}${context}
      <div class="report-actions"><button class="button button-primary" data-action="download-card">下載分享卡 <span aria-hidden="true">↓</span></button><button class="button button-quiet" data-action="copy-link">複製原型連結 <span aria-hidden="true">↗</span></button>${legacy ? `<a class="button button-quiet" href="#archive/${reportMode}/answers">回看封存答案</a>` : personal ? `<button class="button button-quiet" data-action="review-answers" data-mode="${reportMode}">回看我的答案</button><button class="button button-quiet" data-action="restart" data-mode="${reportMode}">重新抽題探索</button>` : '<a class="button button-quiet" href="#explore">開始我的探索 →</a>'}</div>
      ${personal && !legacy ? responseHint() : ''}<div class="report-grid"><div class="report-body"><section class="report-two-column"><div><span class="report-section-label">你可以信任的力量</span><h2>順手的地方，怎麼幫到你</h2><p>${esc(r.strength)}</p></div><div><span class="report-section-label">也替自己多留意一點</span><h2>用力時，可能付出的代價</h2><p>${esc(r.blindspot)}</p></div></section><section><span class="report-section-label">今天就能試的小事</span><h2>挑一件，帶回生活裡</h2><ol class="advice-list">${r.advice.map((text, i) => `<li><span aria-hidden="true">0${i + 1}</span><p>${esc(text)}</p></li>`).join('')}</ol></section><section class="reflection"><span class="report-section-label">留一個問題陪自己</span><p>${esc(r.reflection)}</p></section></div><aside class="report-aside"><div class="aside-box"><h2>讀的時候，想起一件小事</h2><p>看看最近哪一次聊天、決定或忙碌的一天，讓你覺得這段話很像自己。讀到不貼近的地方，也可以先放著。</p><p style="margin-top:12px">這份原型提供一個觀察角度。它不決定你的能力、品德，或接下來的人生。</p><a class="text-link" style="font-size:11px;margin-top:12px" href="#method">了解分類與配卦方法 →</a></div></aside></div>
      ${personal ? scorePanel(scored) : ''}<div class="report-body">${cultural}</div><div class="notice">分享卡與原型連結只帶上類型、卦象和文章摘要。逐題答案留在這個瀏覽器裡。</div></article>`, `${r.title}・${h.chineseName}`);
    currentReportId = Number(id); currentReportMode = reportMode; currentReportLegacy = legacy;
  }
  function renderMethod() {
    page(`<div class="narrow"><section class="page-heading"><span class="section-label">OUR APPROACH</span><h1>以偏好為引，以卦義為鏡。</h1><p>這份探索把六個生活向度組合為 64 型，再按卦義逐一人工配對。每一步都有可查閱的規則。</p></section><div class="prose"><div class="method-equation"><div><strong>16</strong>四組人格偏好</div><span>×</span><div><strong>2</strong>情緒感受</div><span>×</span><div><strong>2</strong>協調方式</div><span>＝</span><div><strong>64</strong>文化原型</div></div><h2>六個向度，觀察六種生活傾向。</h2><div class="axis-definitions">${D.axes.map((axis, i) => `<section class="definition"><small>0${i + 1}${i >= 4 ? ' / 本產品原創向度' : ''}</small><h3>${esc(axis.label)}</h3><p class="endpoints">${esc(axis.positive.label)} ↔ ${esc(axis.negative.label)}</p><p>${esc(axis.definition)}</p></section>`).join('')}</div><h2>從題庫組卷，保持每一場的平衡。</h2><p>公開原題會保留原文與來源。本產品另行撰寫繁中母題，再以受控生活情境產生衍生題。題庫容量、語意母題數與公開原題數分開計算，情境變體不代表新增的心理構念。</p><p>一般入口提供 10 題快速與 20 題標準五點探索：每軸先回答一題，再依回答安排成對的追加題。10 題主題有四軸僅一道題；20 題主題每軸至少三題。完成主題後，主題原分為 0 的向度各加一道來自題庫的五點釐清題，合計最多 16／26 題。同一份探索避免重複語意家族與近義群。回改較早的答案時，後續問題與答案會重新安排；只回看或維持原答案則保留進度。</p><p>48 題資深版則在開始時固定全卷：六個向度各 8 題，正反向各 4 題。同一份探索避免重複語意家族與近義群，每題都可追溯母題、公開來源與分類理由；續答保留原來的題目。</p><p><a href="#bank">查看題庫與來源分流工作台 →</a></p><h2>保留連續分數，再呈現一種原型。</h2><p>10／20 題版與 48 題主問卷使用相同五點選項：「非常不像我」−2、「比較不像我」−1、「介於兩者」0、「比較像我」＋1、「非常像我」＋2。依題目方向換算，主題原分加上釐清分得到最終分；各軸以實際總題數 n 呈現 −2n 至＋2n 的範圍。0 是有效答案，與漏答不同。</p><p>三種長度每軸最多釐清一次；最終分仍為 0 就保留未定，不預設任何一端。作答完成與能否形成唯一分類分開判定：有未定向度時，呈現與已知傾向相容的原型，依文王卦序排列，沒有排名。全部選中立時，六軸均未定。絕對正規化分數不超過 1／8 時標示兩端接近；單題向度會提醒觀察有限，正負有效回答並存時標示混合傾向，0 不算任一端。</p><p>舊版 10／20 題二選一紀錄保留原本 −1／＋1 分數；舊版已完成 48 題結果保留原本五點主題原分及二選一釐清分類，均以唯讀封存呈現。舊版未完成 48 題可保留固定主題與有效主題答案，接續新版；原二選一釐清只留在封存，新版進度獨立保存。</p><p>48 題資深版主題每軸 8 題，開始時固定全卷；主題原分為 0 的向度各加一道來自相同題庫的五點釐清，合計 48–54 題。釐清分計入最終分，每軸實際總題數為 8 或 9 題，因此範圍為 ±16 或 ±18。釐清後仍為 0 就保留未定。</p><details class="method-details"><summary>展開三種長度的計分與釐清規則</summary><ul><li>正分端依序為 E、S、T、J、沉著、自主；負分端為 I、N、F、P、敏銳、協作。</li><li>反向題以作答值乘 −1；漏答保留空白，與中立選項的 0 分不同。</li><li>主題原分與釐清分分開保留，兩者相加才是最終分。主題原分為 0 時每軸最多加一題；最終仍為 0 時不指定任何一端。</li><li>最終分除以該軸最大絕對分數 2n，絕對值不超過 1／8 時顯示兩端接近。這是產品的呈現規則。</li><li>同一套題與相同答案會產生相同結果；重新抽題後結果可能隨情境與作答改變。</li></ul></details><h2>人格與卦象，由故事連接。</h2><p>每個 64 型分支對應一個不同的文王卦序，配對兼顧偏好、卦義與成長課題；六個向度不會直接拼成六爻。報告把原典、白話文化背景與本產品的現代比喻分開呈現。</p><p>「困」「否」「剝」描寫的限制與變化，同樣可以成為守志、辨識耗損與保護根基的提醒。每個原型都保有尊嚴與選擇。</p><h2>這份探索的定位</h2><p>官方 MBTI® 是以四組偏好與 16 型為基礎的評估系統。本產品的題目、兩個新增向度及 64 型配卦都是原創設計，沒有承接官方測驗或原始題庫的效度宣稱。</p><p>結果用於文化閱讀與自我反思。若你想進一步理解某個偏好，可以觀察不同情境中的自己，再回來比較哪些文字仍然貼近生活。</p><div class="intro-actions"><a class="button button-primary" href="#explore">帶著理解，開始探索 ↗</a><a class="button button-quiet" href="#sources">資料與授權</a></div></div></div>`, '探索方法');
  }
  function renderAbout() {
    page(`<div class="narrow"><section class="page-heading"><span class="section-label">ABOUT GUA JIAN SELF</span><h1>人格有傾向，人生有變化。</h1><p>「卦見自己」是一份把當代生活提問與易經文化放在一起的原創探索。透過一面面不同的鏡子，練習更細緻地看待自己。</p></section><div class="prose"><h2>讓古老意象，回到日常。</h2><p>六十四卦描繪開創、等待、相遇、合作與轉變。這些文字可以引出有用的提問：何時推進？如何照顧界線？面對不同的人，怎樣讓自己的傾向成為支持？</p><p>我們把四組人格偏好，加上情緒感受與協調方式，編成 64 種文化原型。每篇解讀都保留古文短引與來源，另以清楚標示的現代比喻，連接到生活中的優勢、代價與練習。</p><h2>你的答案，留在你的手裡。</h2><ul class="privacy-list"><li><strong>不用帳號，也不需要個人資料</strong><p>測驗不詢問姓名、電子郵件或生日，不設廣告與使用分析追蹤。</p></li><li><strong>只在此瀏覽器保存</strong><p>題目清單、逐題答案、必要補題及進度使用本機儲存。換裝置、使用私人瀏覽或清除資料後，原紀錄可能無法接續。</p></li><li><strong>你可以隨時清除</strong><p>頁尾的「清除本機紀錄」只移除本產品的作答資料，不會清除其他網站的資料。</p></li><li><strong>分享由你決定</strong><p>下載的分享卡與複製的原型連結只有類型、卦象與文章摘要；逐題答案與分數不會出現在連結裡。</p></li></ul><h2>關於免費探索與模組使用</h2><p>個人在官方網站探索仍免費；本版原始碼可見，適用的新原創材料之商用重用須先另行取得付費書面授權，舊 MIT 與第三方權利保留。<a href="#sources">閱讀使用條件與商用說明 →</a></p><p>網站採用可追溯題庫與開源卦象資料，題庫來源、版本與授權均可查閱。第一版提供事先撰寫並核對來源的固定文章，不載入 AI 模型，也不呼叫模型推論服務。</p><p>網站託管服務本身可能使用維持登入與私人存取所需的機制；本產品不把作答資料傳送到該服務。</p><div class="intro-actions"><a class="button button-primary" href="#explore">開始我的探索 ↗</a><a class="button button-quiet" href="#sources">閱讀來源與授權</a></div></div></div>`, '關於這份探索');
  }
  function renderSources() {
    page(`<div class="narrow"><section class="page-heading"><span class="section-label">SOURCES & LICENSES</span><h1>每一份引用，都有來處。</h1><p>原典、公開題庫與程式元件各有自己的用途。這裡記錄實際採用的來源，也區分研究備選與正式功能。</p></section><div class="prose"><section class="source-item"><h3>本專案的條件式公開與商用授權</h3><p>個人到本官方網站免費自測、閱讀現有文化報告與非商業分享個人結果，仍然免費。本版原始碼可見，依法有權授權的新原創受保護材料，非商業使用免費；若將適用模組或內容導入商業網站、廣告導流、付費報告、課程、客戶服務或企業業務，須先取得另行付費書面授權。本版整體不是 OSI 開源。</p><p>已按 MIT 公開的舊版本及相同內容保留原許可，不因本次改授權而追溯收費；SurveyJS、卦象上游與公共領域原題各依原條件。抽象卦義、一般方法及未複製受保護表達的獨立實作，不屬本案獨占。商用價格尚未公布，洽詢不代表授權已成立。</p><div class="license-links"><a href="./licenses/PROJECT-LICENSE.txt" target="_blank" rel="noopener noreferrer">本版授權全文</a><a href="./licenses/COMMERCIAL-LICENSE.md" target="_blank" rel="noopener noreferrer">商用範圍與洽詢</a><a href="./licenses/LICENSING-TRANSITION.md" target="_blank" rel="noopener noreferrer">舊 MIT 權利與轉換</a><a href="./licenses/LICENSE-MIT-LEGACY.txt" target="_blank" rel="noopener noreferrer">保留的舊 MIT 原文</a><a href="https://github.com/MySkyCastle-droid/gua-jian-self-64/issues" target="_blank" rel="noopener noreferrer">商用授權洽詢 ↗</a></div></section><section class="source-item"><h3>《周易》古文與卦義</h3><p>古文短引逐卦對照維基文庫《周易》。文化背景、人格配對與建議由本產品原創撰寫；引用原典不代表原典提出本產品的人格分類。</p><div class="license-links"><a target="_blank" rel="noopener noreferrer" href="https://zh.wikisource.org/zh-hant/周易">原典索引 ↗</a></div></section><section class="source-item"><h3>SurveyJS Form Library 3.2.2</h3><p>MIT 授權。早期 48 題版曾使用 survey-core、survey-js-ui 與繁中語系，資產與授權仍隨網站保留。新版三種長度共用本站原生五點作答介面。</p><div class="license-links"><a href="./licenses/SurveyJS-MIT.txt" target="_blank">本機授權全文</a><a href="https://github.com/surveyjs/survey-library/tree/v3.2.2" target="_blank" rel="noopener noreferrer">原始專案 ↗</a></div></section><section class="source-item"><h3>strobus/i-ching</h3><p>MIT 授權。採用卦名、文王卦序、上下卦與爻線靜態資料，保留來源及授權。文王卦序透過資料表查詢，與二進位數值分開處理。</p><div class="license-links"><a href="./licenses/i-ching-MIT.txt" target="_blank">本機授權全文</a><a href="https://github.com/strobus/i-ching" target="_blank" rel="noopener noreferrer">原始專案 ↗</a></div></section><section class="source-item"><h3>IPIP 公開人格原題</h3><p>International Personality Item Pool 官方表示題目與量表屬 public domain，可修改與翻譯。本產品保留原始來源、父題關係與衍生方法；原量表構念及效度不直接轉移為本產品的六維分類。</p><p>原始來源共 3,370 個評量項目：IPIP 3,320 題、TIPI 10 組詞語題、Mini-Markers 40 個形容詞題；衍生母題另行計數。</p><div class="license-links"><a href="https://ipip.ori.org/" target="_blank" rel="noopener noreferrer">IPIP 官方 ↗</a><a href="https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/" target="_blank" rel="noopener noreferrer">TIPI 作者許可 ↗</a><a href="https://pages.uoregon.edu/gsaucier/gsau4a.html" target="_blank" rel="noopener noreferrer">Mini-Markers 公開領域聲明 ↗</a><a href="./licenses/THIRD_PARTY_NOTICES.md" target="_blank">第三方完整聲明</a><a href="#bank">題庫數量與分流明細 →</a></div></section><section class="source-item"><h3>MBTI® 系統與權限說明</h3><p>用於辨明官方 16 型系統與本產品原創分類的差異。網站不重印官方測驗題目，也不提供官方 MBTI® 評估。MBTI® 是 Myers &amp; Briggs Foundation 的註冊商標。本產品與該機構無隸屬、贊助或認可關係。</p><div class="license-links"><a href="https://www.myersbriggs.org/unique-features-of-myers-briggs/three-unique-instruments/" target="_blank" rel="noopener noreferrer">官方工具介紹 ↗</a><a href="https://www.myersbriggs.org/using-type-as-a-professional/mbti-permission-trademarks/" target="_blank" rel="noopener noreferrer">權限與商標說明 ↗</a></div></section><section class="source-item"><h3>64 型人格原創插畫</h3><p>每一型各自設計角色、場景與卦義比喻，再以內建 imagegen 逐張生成。公開資料用來查核古代意象與公共領域自然器物概念，沒有將外部圖片作為生成輸入或拼貼素材。卦線由本站 SVG 精確繪製，與 AI 插畫分開。</p><p>AI 生成不構成排他著作權或零相似性保證；原圖、提示、來源與檢查紀錄分開保存。</p><div class="license-links"><a href="./data/artwork-sources.json" target="_blank">逐型插畫與參考來源</a><a href="./licenses/Artwork-Notes.txt" target="_blank">圖像使用與生成說明</a></div></section><section class="source-item"><h3>Hugging Face 研究備選</h3><p>Qwen3-0.6B（Apache-2.0）保留為未來解說模型候選，首版不下載或執行。PersonalityCafe 等文字與自報人格資料集未用於本產品計分，也未拿受測者資料列充當題庫題數。</p><div class="license-links"><a href="https://huggingface.co/Qwen/Qwen3-0.6B" target="_blank" rel="noopener noreferrer">Qwen 官方模型卡 ↗</a></div></section><p class="editorial-note">題庫、計分、配卦與文章採版本管理；分類屬文化探索，未宣稱科學準確率、人口稀有率或常模百分比。</p></div></div>`, '資料與使用授權');
  }
  function renderBank() {
    if (!window.GuaQuestionCopy || !D.bank) return renderNotFound();
    const bank=D.bank, stats=window.GuaBank.stats();
    page(`<div class="container"><section class="page-heading"><span class="section-label">QUESTION LIBRARY</span><h1>直接問生活中的選擇。</h1><p>新版每題只描述一件事，不再先加一段重複的背景說明。你看到的288條核心行為句，都由本產品重新撰寫。</p></section><div class="bank-stats"><div><strong>${stats.sourceCount.toLocaleString()}</strong><span>公開原始評量項目</span></div><div><strong>288</strong><span>新版核心行為句</span></div><div><strong>${stats.count.toLocaleString()}</strong><span>保留的歷史情境組合</span></div><div><strong class="bank-mode-count">10／20／48</strong><span>同卷主句與開場片語不重複</span></div></div><p class="bank-count-note">十萬筆是288個母題搭配場景與條件形成的歷史變體，不是十萬個不同題意。新版抽題仍保留原ID、來源與方向；畫面使用下列直接行為句，舊進度保持原題文。</p><div class="atlas-tools"><label for="bank-axis" class="skip-link">生活面向篩選</label><select id="bank-axis" class="filter-select"><option value="">全部生活面向</option>${D.axes.map(a=>`<option value="${a.id}">${esc(a.label)}</option>`).join('')}</select><label for="bank-type" class="skip-link">人格分型篩選</label><select id="bank-type" class="filter-select"><option value="">全部64型</option>${Object.keys(D.mapping).map(key=>`<option value="${key}">${key.split('-')[0]}・${key.includes('-calm-')?'沉著':'敏銳'}${key.endsWith('autonomous')?'自主':'協作'}</option>`).join('')}</select><button class="button button-quiet" id="bank-sample">再看一組題目 ↻</button><span id="bank-count" class="atlas-count"></span></div><div id="bank-items" class="bank-items"></div><div class="bank-pagination"><button class="button button-quiet" id="bank-prev">← 上一頁</button><span id="bank-page"></span><button class="button button-quiet" id="bank-next">下一頁 →</button></div><section class="prose"><h2>換寫法，也保留查得到的來源。</h2><p>題目依原有母題的生活行為重新寫成單句，保留向度與正反方向；同一份新探索排除相同母題、近義群和相同開場分句，補充情境也遵守同樣規則。這是可核對的文字限制，不宣稱每句都屬於不同的語法類型。</p><p>競品只作閱讀結構參考，沒有移植其題目或效度。題庫尚未完成真人常模與心理測量驗證。<a href="#sources">閱讀來源與授權 →</a></p></section></div>`, '直接行為題庫');
    let pageIndex=0;
    function pool(){return window.GuaQuestionCopy.catalog({axis:document.getElementById('bank-axis').value,typeKey:document.getElementById('bank-type').value});}
    function update(){const all=pool();pageIndex=Math.max(0,Math.min(pageIndex,Math.ceil(all.length/12)-1));const items=all.slice(pageIndex*12,pageIndex*12+12);document.getElementById('bank-count').textContent=`${all.length}條核心題句`;document.getElementById('bank-page').textContent=`${pageIndex+1} / ${Math.max(1,Math.ceil(all.length/12))}`;document.getElementById('bank-prev').disabled=pageIndex===0;document.getElementById('bank-next').disabled=(pageIndex+1)*12>=all.length;document.getElementById('bank-items').innerHTML=items.map(item=>`<article class="bank-item"><span class="eyebrow">${esc(item.id)} / ${esc(D.axes.find(a=>a.id===item.axis).label)}</span><h2>${esc(item.text)}</h2><details><summary>查看來源與原母題</summary><p>原母題：${esc(item.seedText)}</p><p>${esc(item.adaptationNote)}</p><p>公開父題：${item.sourceIds.map(id=>{const source=bank.sources.find(s=>s.id===id);return source?`${esc(id)} — ${esc(source.text)}`:esc(id);}).join('；')}</p><p>同意此題較支持${esc(item.direction===1?D.axes.find(a=>a.id===item.axis).positive.label:D.axes.find(a=>a.id===item.axis).negative.label)}端；反向回答支持另一端。一題不會單獨決定人格。</p></details></article>`).join('');}
    document.getElementById('bank-axis').onchange=document.getElementById('bank-type').onchange=()=>{pageIndex=0;update();};document.getElementById('bank-prev').onclick=()=>{pageIndex--;update();};document.getElementById('bank-next').onclick=()=>{pageIndex++;update();};document.getElementById('bank-sample').onclick=()=>{pageIndex=Math.floor(Math.random()*Math.max(1,Math.ceil(pool().length/12)));update();};update();
  }
  function renderNotFound() { page('<div class="error-state"><span class="eyebrow">這一頁還沒有展開</span><h1>回到圖鑑，遇見另一面鏡子。</h1><p>這個連結沒有對應的原型。</p><a class="button button-primary" href="#atlas">走進原型圖鑑 →</a></div>', '找不到這一頁'); }
  function route() {
    stripRetiredTestLink();
    routeToken++; const token = routeToken; const hash = location.hash || '#home';
    try {
      if (hash === '#home' || hash === '#') renderHome();
      else if (hash === '#explore') renderExplore();
      else if (hash === '#senior') renderSenior();
      else if (hash === '#quiz' || hash === '#result') {
        const destination = state.started ? `${hash}/${state.mode}` : '#explore';
        location.replace(destination); return;
      }
      else if (/^#(quiz|result)\/(10|20|48)$/.test(hash)) {
        const parts = hash.split('/'); useMode(Number(parts[1]));
        if (parts[0] === '#quiz') renderQuiz(); else renderPersonal();
      }
      else if (/^#archive\/(10|20|48)(\/answers)?$/.test(hash)) renderArchive(Number(hash.split('/')[1]), hash.endsWith('/answers'));
      else if (hash === '#atlas') renderAtlas();
      else if (/^#atlas\/(\d+)$/.test(hash)) renderReport(Number(hash.split('/')[1]));
      else if (hash === '#method') renderMethod();
      else if (hash === '#about') renderAbout();
      else if (hash === '#sources') renderSources();
      else if (hash === '#bank') renderBank();
      else renderNotFound();
    } catch (error) { console.error('Guajian page error:', error); page(`<div class="error-state"><span class="eyebrow">頁面暫時無法展開</span><h1>請重新整理，再接續探索。</h1><p>本機紀錄會保留；也可以回到首頁重試。</p><a class="button button-primary" href="#home">回到首頁 →</a></div>`, '頁面載入遇到問題'); }
    const navigationHash = /^#(?:quiz|result|archive)\/48(?:\/answers)?$/.test(hash) ? '#senior' : /^#(?:quiz|result|archive)\/(10|20)(?:\/answers)?$/.test(hash) ? '#explore' : hash;
    document.querySelectorAll('.site-header nav a, .header-cta').forEach(a => { if (a.getAttribute('href') === navigationHash) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    requestAnimationFrame(() => { if (token === routeToken) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); } });
  }
  async function confirmReset(restart, all = false, mode = state.mode) {
    const dlg = document.getElementById('confirm-dialog');
    if (dlg.open) return;
    document.getElementById('confirm-title').textContent = all ? '清除所有版本的本機紀錄？' : restart ? `重新開始 ${mode} 題探索？` : `清除 ${mode} 題探索？`;
    document.getElementById('confirm-description').textContent = all ? '這會移除此瀏覽器所有新版 10、20、48 題的題目、答案與進度，以及舊版封存和所有舊版備份。清除後無法復原。' : `這會移除 ${modeLabel(mode)} 的答案與進度${restart ? '，並重新抽題' : ''}。其他版本的進度與舊版封存會保留。`;
    dlg.querySelector('button[value="confirm"]').textContent = all ? '清除全部紀錄' : restart ? '重新開始' : '清除這版紀錄';
    dlg.returnValue = '';
    const agreed = await new Promise(resolve => { dlg.addEventListener('close', () => resolve(dlg.returnValue === 'confirm'), { once: true }); dlg.showModal(); });
    if (!agreed) return;
    if (!all) useMode(mode);
    adopt(Sessions.clear(storage, envelope, all ? undefined : mode));
    if (restart) {
      try { prepareForm(); navigate(quizRoute()); } catch (error) { toast(error.message); }
    } else {
      navigate('#home'); toast(storageAvailable ? (all ? '此瀏覽器所有新版作答紀錄、舊版封存與舊版備份已清除。' : `${mode} 題探索的本機紀錄已清除。`) : storageMessage);
    }
  }
  async function copyReportLink() {
    if (!currentReportId) return;
    const shareUrl = new URL(location.href);
    ['qa','qaRun','qaCase','qaMode','qaSeed'].forEach(key => shareUrl.searchParams.delete(key));
    shareUrl.hash = '#atlas/' + currentReportId;
    const url = shareUrl.href;
    if (location.protocol !== 'file:' && navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(url); toast('已複製原型圖鑑連結，不含答案或分數。'); return; } catch (_) {}
    }
    let dlg = document.getElementById('copy-dialog');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'copy-dialog'; dlg.innerHTML = '<form method="dialog"><h2>複製原型連結</h2><p>請選取下方連結自行複製。連結不含答案或分數。</p><input class="copy-input" readonly aria-label="原型圖鑑連結"><div class="dialog-actions"><button class="button button-primary" value="close">完成</button></div></form>'; document.body.appendChild(dlg); }
    const input = dlg.querySelector('input'); input.value = url; dlg.showModal(); input.focus(); input.select();
  }
  function wrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    let line = ''; const lines = [];
    for (const ch of text) { const attempt = line + ch; if (ctx.measureText(attempt).width > maxWidth && line) { lines.push(line); line = ch; } else line = attempt; }
    if (line) lines.push(line);
    const visible = maxLines ? lines.slice(0, maxLines) : lines;
    if (maxLines && lines.length > maxLines) { let last = visible[visible.length - 1]; while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1); visible[visible.length - 1] = last + '…'; }
    visible.forEach((value, i) => ctx.fillText(value, x, y + i * lineHeight));
    return y + visible.length * lineHeight;
  }
  async function downloadCard() {
    if (!currentReportId) return;
    const id = currentReportId, mode = currentReportMode, legacy = currentReportLegacy, r = D.reports[id], h = getHex(id), parts = r.typeKey.split('-');
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1200;
    const ctx = canvas.getContext('2d'); if (!ctx) return toast('此瀏覽器暫不支援分享卡，仍可複製原型連結。');
    let illustration = null;
    const artwork = D.artwork && D.artwork[id];
    if (artwork && location.protocol !== 'file:') {
      try {
        illustration = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = artwork.src; });
      } catch (_) { illustration = null; }
    }
    ctx.fillStyle = '#f5f1e8'; ctx.fillRect(0, 0, 900, 1200); ctx.strokeStyle = '#d0d4c3'; ctx.lineWidth = 1; ctx.strokeRect(37, 37, 826, 1126);
    ctx.textAlign = 'left'; ctx.fillStyle = '#283830'; ctx.font = '30px "PMingLiU",serif'; ctx.fillText('卦見自己', 80, 109);
    ctx.font = '16px "Microsoft JhengHei",sans-serif'; ctx.fillStyle = '#697167'; ctx.fillText(legacy ? archiveLabel(mode) : mode ? modeLabel(mode) + '・五點回答' : '原型圖鑑・閱讀示例', 80, 140);
    ctx.fillStyle = '#a44232'; ctx.fillRect(758, 73, 60, 62); ctx.fillStyle = '#fff7e9'; ctx.font = '38px "PMingLiU",serif'; ctx.fillText('易', 769, 119);
    if (illustration) {
      ctx.drawImage(illustration,190,156,520,520);
      ctx.fillStyle='#283830'; h.lines.slice().reverse().forEach((v,i)=>{ const y=343+i*18; if(v)ctx.fillRect(745,y,62,6); else {ctx.fillRect(745,y,25,6);ctx.fillRect(782,y,25,6);} });
    } else {
      ctx.strokeStyle = '#bbc3ac'; ctx.beginPath(); ctx.arc(450, 360, 165, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(450, 360, 155, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#283830'; h.lines.slice().reverse().forEach((v, i) => { const y = 263 + i * 34; if (v) ctx.fillRect(379, y, 142, 12); else { ctx.fillRect(379, y, 56, 12); ctx.fillRect(465, y, 56, 12); } });
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#a44232'; ctx.font = '20px "Microsoft JhengHei",sans-serif'; ctx.fillText(`${parts[0]} · ${parts[1] === 'calm' ? '沉著' : '敏銳'} × ${parts[2] === 'autonomous' ? '自主' : '協作'}`, 450, illustration ? 729 : 590);
    ctx.fillStyle = '#283830'; let titleSize = 61; ctx.font = `${titleSize}px "PMingLiU",serif`; while (ctx.measureText(r.title).width > 710 && titleSize > 38) { titleSize -= 2; ctx.font = `${titleSize}px "PMingLiU",serif`; } ctx.fillText(r.title, 450, illustration ? 809 : 682);
    const subtitle = r.subtitle || '';
    if (subtitle) { let subtitleSize = 27; ctx.fillStyle = '#4d594f'; ctx.font = `${subtitleSize}px "Microsoft JhengHei",sans-serif`; while (ctx.measureText(subtitle).width > 710 && subtitleSize > 16) { subtitleSize--; ctx.font = `${subtitleSize}px "Microsoft JhengHei",sans-serif`; } ctx.fillText(subtitle, 450, illustration ? 851 : 730); }
    ctx.fillStyle = '#697167'; ctx.font = '24px "PMingLiU",serif'; ctx.fillText(`${guaName(id)} · 第${id}卦`, 450, illustration ? 893 : 778);
    ctx.textAlign = 'left'; ctx.font = `${illustration ? 21 : 23}px "Microsoft JhengHei",sans-serif`; ctx.fillStyle = '#4d594f'; wrappedText(ctx, r.summary, 105, illustration ? 940 : 839, 690, illustration ? 32 : 40, illustration ? 3 : 4);
    ctx.strokeStyle = '#d0d4c3'; ctx.beginPath(); ctx.moveTo(105, 1044); ctx.lineTo(795, 1044); ctx.stroke(); ctx.textAlign = 'center'; ctx.font = '17px "Microsoft JhengHei",sans-serif'; ctx.fillStyle = '#697167'; ctx.fillText('人格有傾向，人生有變化。', 450, 1090); ctx.font = '13px "Microsoft JhengHei",sans-serif'; ctx.fillText('原創文化探索・此卡不含作答答案與分數', 450, 1125);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return toast('分享卡未能產生，請稍後再試。');
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `卦見自己-${legacy ? mode + '題舊版封存' : mode ? mode + '題' : '圖鑑示例'}-${parts[0]}-${h.chineseName}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); toast('分享卡已產生，請查看瀏覽器的下載項目。');
  }
  document.addEventListener('click', event => {
    if (event.target.closest('.skip-link[href="#main"]')) { event.preventDefault(); main.focus({ preventScroll: true }); main.scrollIntoView({ block: 'start' }); return; }
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    const mode = [10,20,48].includes(Number(button.dataset.mode)) ? Number(button.dataset.mode) : state.mode;
    if (action === 'start-mode' || action === 'begin' || action === 'resume') { try { startMode(mode); } catch (error) { toast(error.message); } }
    else if (action === 'restart') confirmReset(true, false, mode);
    else if (action === 'clear-mode') confirmReset(false, false, mode);
    else if (action === 'clear-data') confirmReset(false, true);
    else if (action === 'review-answers') {
      if (currentReportLegacy) { navigate('#archive/' + currentReportMode + '/answers'); return; }
      if (currentReportMode) useMode(currentReportMode);
      else if (state.mode !== mode) useMode(mode);
      state.phase = 'quiz'; state.questionIndex = 0; persist(); navigate(quizRoute());
    }
    else if (action === 'download-card') downloadCard();
    else if (action === 'copy-link') copyReportLink();
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]') || !/^#quiz\/(10|20|48)$/.test(location.hash)) return;
    if (event.target.matches('input[type="text"],textarea,select,[contenteditable="true"]')) return;
    if (state.phase === 'quiz' && /^[1-5]$/.test(event.key)) {
      event.preventDefault(); const input = document.getElementById('short-answer-' + event.key);
      if (input) { input.checked = true; input.dispatchEvent(new Event('change', {bubbles:true})); }

    } else if (event.key === 'Enter' && !event.target.closest('button,a')) {
      const next = document.getElementById('next-question'); if (next) { event.preventDefault(); next.click(); }
    }
  });
  window.addEventListener('hashchange', route);
  if (!D || !D.iching || !Core || !Short || !Full || !Legacy || !Sessions || !ResultCopy || !QuestionCopy || !D.reports) { main.innerHTML = '<div class="error-state"><h1>資料尚未完整載入</h1><p>請重新整理，或確認網站檔案已完整解壓縮。</p></div>'; return; }
  route();
})();
