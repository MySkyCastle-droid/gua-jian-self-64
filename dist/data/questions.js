(function (global) {
  'use strict';
  var data = global.GuaData = global.GuaData || {};
  data.versions = Object.assign({}, data.versions, { questions: '1.0.0' });
  data.axes = [
    { id: 'energy', label: '社交取向', positive: { key: 'E', label: '外向', description: '較常從外界互動恢復精神' }, negative: { key: 'I', label: '內向', description: '較常從獨處恢復精神' }, definition: '觀察你通常如何恢復精神；與口才、社交能力或受歡迎程度無關。' },
    { id: 'information', label: '資訊取向', positive: { key: 'S', label: '實感', description: '較先關注具體資訊與經驗' }, negative: { key: 'N', label: '直覺', description: '較先關注整體關聯與可能性' }, definition: '觀察你接收資訊時最先注意的線索；兩端都能運用事實與想像。' },
    { id: 'decision', label: '決策取向', positive: { key: 'T', label: '思考', description: '較先衡量一致的原則與理由' }, negative: { key: 'F', label: '情感', description: '較先衡量人的價值與處境' }, definition: '觀察你做決定時通常從哪一面切入；與是否理性、善良或有同理心無關。' },
    { id: 'organization', label: '組織取向', positive: { key: 'J', label: '安排', description: '較偏預先安排與確定方向' }, negative: { key: 'P', label: '彈性', description: '較偏保留選擇與調整空間' }, definition: '觀察你安排生活的常見節奏；與責任感或執行能力無關。' },
    { id: 'emotion', label: '情緒反應', positive: { key: 'calm', label: '沉著', description: '面對變化時，情緒感受通常較平緩' }, negative: { key: 'sensitive', label: '敏銳', description: '面對變化時，情緒感受通常較鮮明' }, definition: '本產品原創向度：描述情緒感受的強度，不衡量情緒管理、心理健康或能力高低。' },
    { id: 'coordination', label: '協調方式', positive: { key: 'autonomous', label: '自主', description: '較偏先自行形成方案，再與他人同步' }, negative: { key: 'cooperative', label: '協作', description: '較偏先共同討論，再形成方案' }, definition: '本產品原創向度：觀察方案形成的順序，並非外向或內向，也不衡量合作能力。' }
  ];

  var chapters = [
    { title: '日常裡的你', items: [
      ['energy', 1, '經過忙碌的一天後，與熟悉的人聊聊天常能讓我恢復精神。'],
      ['information', -1, '接觸一件新事物時，我會先想它與其他事情可能有什麼關聯。'],
      ['decision', 1, '面對日常選擇，我通常先比較各選項的理由是否一致。'],
      ['organization', -1, '安排空閒的一天時，我喜歡留到當下再決定要做什麼。'],
      ['emotion', 1, '生活中的小計畫臨時改動時，我的情緒感受通常相當平緩。'],
      ['coordination', -1, '和朋友規劃活動時，我偏好先一起聊想法，再形成方案。'],
      ['energy', -1, '與人相處一段時間後，獨自待一會兒通常更能讓我恢復精神。'],
      ['information', 1, '選擇日常用品時，我通常先看實際規格和具體使用經驗。'],
      ['decision', -1, '一項日常決定會影響別人時，我通常先考慮他們的處境與在意的事。'],
      ['organization', 1, '在新的一週開始前，我喜歡先把主要行程安排好。'],
      ['emotion', -1, '收到出乎意料的好消息時，我內心的喜悅感受往往很鮮明。'],
      ['coordination', 1, '和別人商量安排前，我偏好先自己想出一個初步方案。']
    ] },
    { title: '學習與做事', items: [
      ['information', 1, '學習新方法時，我會先找具體的步驟和實際例子。'],
      ['energy', -1, '做完需要大量互動的事情後，安靜獨處通常讓我比較有精神。'],
      ['organization', 1, '開始一項工作或學習任務時，我喜歡先確定順序與時間安排。'],
      ['decision', -1, '需要分配任務時，我通常先考量每個人的需要與個別情況。'],
      ['coordination', 1, '收到共同任務時，我偏好先自行整理做法，再拿出來討論。'],
      ['emotion', -1, '學習或工作有了意外的新進展時，我內心的起伏通常相當鮮明。'],
      ['information', -1, '學習新概念時，我常先想像它還能延伸出哪些可能。'],
      ['energy', 1, '一段時間專注做事後，和別人交流通常能讓我重新有活力。'],
      ['organization', -1, '進行一項任務時，我喜歡隨著新發現調整原本的做法。'],
      ['decision', 1, '需要分配任務時，我通常先建立一套對大家一致的判準。'],
      ['coordination', -1, '處理共同任務時，我偏好先與伙伴交換想法，再決定自己的做法。'],
      ['emotion', 1, '做事進度出現意料之外的變化時，我內心的感受通常較為平緩。']
    ] },
    { title: '變化與選擇', items: [
      ['decision', 1, '兩種主張發生衝突時，我通常先檢查它們各自的推理與依據。'],
      ['organization', -1, '面對尚未確定的機會，我喜歡先保留幾個選項，邊走邊看。'],
      ['information', -1, '遇到陌生情境時，我會先猜想背後的模式和未來的發展。'],
      ['coordination', -1, '需要應對一個新問題時，我偏好先與相關的人討論，再形成自己的方案。'],
      ['emotion', 1, '遇到意外的小挫折時，我感受到的情緒波動通常較輕。'],
      ['energy', 1, '進入新的生活階段時，與人互動通常能幫我補充精神。'],
      ['decision', -1, '兩種主張發生衝突時，我通常先了解當事人的價值與感受。'],
      ['organization', 1, '面對有期限的選擇，我喜歡及早定下方向，讓後續有個依循。'],
      ['information', 1, '遇到陌生情境時，我會先確認眼前有哪些可觀察的事實。'],
      ['coordination', 1, '需要應對一個新問題時，我偏好先獨立構思方案，再與相關的人對照。'],
      ['emotion', -1, '遇到意外的小挫折時，我內心的失落或煩悶感受通常很鮮明。'],
      ['energy', -1, '進入新的生活階段時，保留一段獨處時間通常更能幫我恢復精神。']
    ] },
    { title: '關係與未來', items: [
      ['organization', 1, '規劃一趟旅程時，我喜歡先確定主要路線與重要安排。'],
      ['decision', -1, '討論未來方向時，我通常先想這個選擇是否符合自己與重要他人的價值。'],
      ['energy', -1, '熱鬧聚會結束後，獨處通常比繼續聊天更能補充我的精神。'],
      ['emotion', -1, '重要關係中的互動出現變化時，我內心的情緒感受往往很鮮明。'],
      ['coordination', 1, '要和伙伴決定共同方向時，我偏好先自己想清楚提案，再一起修整。'],
      ['information', 1, '思考未來計畫時，我通常先盤點已有的資源、經驗與現實條件。'],
      ['organization', -1, '規劃一趟旅程時，我喜歡只定大方向，把不少細節留給當下。'],
      ['decision', 1, '討論未來方向時，我通常先比較選項的利弊與判斷原則。'],
      ['energy', 1, '有一段空閒時間時，和喜歡的人相處通常能讓我更有精神。'],
      ['emotion', 1, '重要關係中的互動出現變化時，我內心的情緒感受通常較為平緩。'],
      ['coordination', -1, '要和伙伴決定共同方向時，我偏好先共同探索，再逐步形成提案。'],
      ['information', -1, '思考未來計畫時，我通常先想像還有哪些尚未嘗試的可能。']
    ] }
  ];
  data.questions = [];
  chapters.forEach(function (chapter, chapterIndex) {
    chapter.items.forEach(function (item) {
      data.questions.push({ id: 'q' + String(data.questions.length + 1).padStart(2, '0'), axis: item[0], direction: item[1], text: item[2], chapter: chapterIndex + 1, chapterTitle: chapter.title });
    });
  });
  data.tieQuestions = {
    energy: { text: '假設你有一小段不受打擾的休息時間，哪一種方式通常更能補充精神？', positive: '與喜歡的人聊聊或一起活動', negative: '獨自待著，做自己想做的事' },
    information: { text: '初次了解一個新計畫時，你比較想先得到哪一種資訊？', positive: '具體做法、實例與目前的事實', negative: '整體構想、關聯與未來的可能' },
    decision: { text: '一個決定同時有充分理由與人情考量時，你習慣先從哪裡開始想？', positive: '一致的原則、理由與利弊', negative: '人的價值、需要與個別處境' },
    organization: { text: '面對一段可自由安排的時間，你通常偏好哪種節奏？', positive: '先安排主要事項，再依計畫展開', negative: '先留些空間，再隨情況調整' },
    emotion: { text: '回想最近三個月，出現意料之外的變化時，你內心的情緒感受更接近哪一端？', positive: '感受通常較平緩、起伏較輕', negative: '感受通常較鮮明、起伏較強' },
    coordination: { text: '現在要與伙伴共同做一件新事情，你比較偏好如何開始？', positive: '先自行整理一個初步方案，再同步討論', negative: '先共同討論想法，再形成初步方案' }
  };
})(window);
