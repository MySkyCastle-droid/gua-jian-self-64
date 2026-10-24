# 驗收紀錄

原始 48 題版本驗收日期：2026-10-23（Asia/Taipei）。網站為原創文化探索；這份記錄驗證程式與內容一致性，不宣稱心理測量效度。下列既有操作紀錄只對當時的 48 題版本有效。

## 新版五點三模式與 v5 進度更新的驗收範圍

一般版預設 10 題主題，可選 20 題主題，資深版為 48 題主題，三者均使用五點選項：`-2`「非常不像我」、`-1`「比較不像我」、`0`「介於兩者」、`1`「比較像我」、`2`「非常像我」。0 是有效中立答案，未答保留空白；只允許這五個整數。短版後續主題依先前作答與各向度資訊分布調整。48 題主題六軸各 8 題、每軸正反各 4 題，固定種子可重現。三個模式都在主題答完後，為主題原分為 0 的向度各最多追加一道來自題庫的五點釐清題，合計上限為 16／26／54 題。

三模式報告分別呈現主題原分、釐清分與最終分，最終分包含釐清分。各軸依實際主題及釐清總題數 n 計算 `maxAbs = 2 * n`，範圍為 −2n 至＋2n；48 題主題每軸 n = 8，若追加釐清則 n = 9。主題與所需釐清都答完即為 `finished`；只有六軸最終分均非 0 才是 `complete`。仍為 0 的軸保留未定，呈現與已知傾向相容的候選原型，依文王卦序排列，沒有排名、機率或信心估計，不硬配單一 64 型。全部選中立仍能完成探索，六軸均未定，保留全部 64 個候選。

資深版入口維持 `#senior`，目前免費體驗，新版改由 `full.js` 處理 48 題主題與最多 6 道五點釐清。修改主題保留其餘主題答案，清除失效釐清並重算所需題目，正常測驗不改寫全域主問卷。`core.js` 僅保留原規則供舊 48 題封存唯讀報告使用。一般版入口維持 `#explore`。題庫、64 張插畫、來源與授權資料不因本次模式更新改寫，未來收費僅為產品規劃。

進度驗收涵蓋三個模式分開保存、切換與重新載入續答、所選模式獨立重設，以及新的 `guajian-self.session.v5` 儲存鍵。v4 五點短版進度與既有封存原樣保留；v3 有效二選一短版放入唯讀 `archives[10]`／`archives[20]`，保留原題序、−1／＋1 答案與當時結果。`short-legacy.js` 只提供 `restore`、`questions`、`score`。有效舊 48 題紀錄按原規則驗證後完整放入 `archives[48]`；已完成者只保留舊報告，新版 48 題槽空白；未完成者另將原主題 ID、有效五點答案與位置匯入新版，保留未答空洞與後段答案。舊二選一釐清保留在封存，不轉換為五點強度；新版釐清答案為空。封存均不能修改或接續作答，路由為 `#archive/10`、`#archive/20`、`#archive/48` 及各自的 `/answers`。

備份依 v4、v3、v2 順序遷移，原始備份不改寫；較新備份存在但損壞時不回退讀更舊版本，v5 已存在時不重複匯入。局部損壞保留其他模式與有效封存。單一模式重設不刪封存；全部清除包括三模式封存及 v2／v3／v4 備份，並保存空白 v5 標記防止舊紀錄重新匯入。儲存無法讀寫時回報提示，保留可用的記憶體進度。完成但未分類的五點紀錄依 `finished` 保持結果階段。

自動化驗收另涵蓋六向度覆蓋、正反方向、主題與釐清全程語意去重、短版作答驅動選題、種子與歷程重播、返回修改後重算後續題序或所需釐清、0 與缺答區分、非法值、48 題未答空洞、全中立未定結果、損壞存檔隔離及儲存失敗。

完整驗證命令包含七個測試檔：

```text
node --test tests/core.test.cjs tests/content.test.cjs tests/bank.test.cjs tests/artwork.test.cjs tests/short.test.cjs tests/full.test.cjs tests/sessions.test.cjs
```

本次自動化測試為 **91 項通過、0 失敗、0 略過**：既有核心／內容／題庫／插畫 26 項、五點短版與舊版唯讀模組 19 項、新版 48 題引擎 11 項、進度與 QA 儲存 35 項。這些結果驗證工程規則，不是分類準確率證據。300 場矩陣的固定被測來源為帶臨時驗收介面的 23d58a6f94405ba15461836a33a7294fa599c5cd。各場次完成數與差異依實際交付 JSON 為準。公開清理版另執行程式保留核對與針對性手機回歸，不把 300 場記為清理後版本的同一批驗收，也不沿用下方原始 48 題歷史紀錄充數。

臨時公開驗收介面已自正常站點移除，包含 #qa 設定頁、指定種子表單、驗收橫幅、題目／結果 JSON 與測試動作。舊驗收網址只移除五個已退役參數並回一般首頁，不載入或清除任何驗收命名空間。一般進度、三版原有儲存／遷移與唯讀封存保持原規則。固定被測版及其私有驗收資料用於內部重播，不在正常頁面顯示偵錯資料。

短版是啟發式自適應選題，未經 IRT 校準、受測者常模或外部效度研究。10 題的六向度資訊有限；20／48 題增加作答情境，不構成某個準確率或短長版等值的證據。報告、插畫與卦序配對是文化解讀，無臨床用途。

## 原始 48 題版本的自動化紀錄

執行：`node --test tests/core.test.cjs tests/content.test.cjs tests/bank.test.cjs`

結果：**24 項通過、0 失敗、0 略過**。

- 10 萬 JSONL 逐行與瀏覽器題庫配方一致、文字正規化後全部唯一。
- 保留 3,370 原始評量項目的 ID、原文、授權與計分鍵。
- 288 母題、277 近義群、來源與輸入／輸出 SHA256 一致。
- 64 型分流可達；每道題的同意方向支持 32 型，每型有 50,000 道同向題可檢索。
- 每場六維各 8 題、每維正反各 4 題；同家族／近義群互斥，固定種子可重現，續答不換題。
- 缺答不當 0、正反向、−16～＋16、全中立補題、補題不改原分、修改後清除失效補題。
- 64 報告均有必要欄位及 600～900 中文字；配卦唯一且覆蓋 1～64。
- 卦象上下、爻線、乾坤屯既濟未濟獨立對照通過。
- 所有執行資產均在本機，下載元件雜湊與 MIT 全文完整。

## 原始 48 題版本的實際瀏覽器操作

使用 Codex in-app browser，在 loopback 靜態伺服器上驗收。預覽伺服器經中央 Usage Guard 登錄，僅監聽 127.0.0.1，並有合作停止檔。

- 在窄螢幕與 1280×900 桌面檢查首頁、問卷與結果排版；修正 SurveyJS 3.2.2 選項容器的版本差異。
- 漏答按下一題仍留在原題並顯示提示。
- 中立作答可前進；返回仍顯示中立選中，進度正確。
- 第 13 題重新載入後題文與題序完全相同、仍為 12 題已答。
- 實際逐題完成 48 題全中立問卷，再完成 6 道釐清題；產生 ESTJ・沉著自主／大壯，六維原分皆保留 0，顯示全中立與兩端接近說明。
- 結果重載可續讀；圖鑑顯示 64 張卡，搜尋「中孚」只剩指定原型。
- 分享卡成功下載 900×1200 PNG，已開圖檢查排版與中文，沒有答案或分數。
- 複製的圖鑑連結為 `#atlas/61`，不含答案與分數。
- 重新抽題會開確認框並生成新題組；接著再次開清除框按 Esc，原題與已選答案保留。
- 鍵盤執行「跳至主要內容」後問卷與路由保留。
- 題庫工作台顯示 3,370／288／100,000；篩選情緒反應＋INFJ敏銳協作顯示 8,333 題，逐題可展開公開父題、改寫註記與方向。
- 瀏覽器未出現程式 console error／warning；產品程式未使用 fetch、XHR、sendBeacon 或將答案寫入 URL。

## 邊界

大量情境變體經格式、唯一性、來源與抽樣語義適配檢查，未逐題經外部心理測量專家審查。IPIP、TIPI 與 Mini-Markers 原始項目不因收錄或改寫就成為本產品的 MBTI／64 型效度證據。

上述 2026-10-23 瀏覽器紀錄完成時，第一版只部署私人存取。後續公開站與模式更新的發布狀態應以各次部署驗證紀錄為準；這份歷史紀錄不代表本次更新已上線。託管平台必要的登入與存取機制不屬於問卷答案收集。


## 公開介面清理的私有候選驗證

本節記錄套用前的候選檢查。候選僅包含 app.js、modes.css 與兩份說明，尚未套用至網站、尚未重新發布。套用前須完成全部 300 場實際公開介面驗收，保留帶入口被測版的私有站點副本與原始證據，再執行下列手機回歸。不能用清理後的檔案取代被測版來重播這批矩陣。

### 保留範圍

只移除驗收 UI 與入口。核心、Full、Short、舊版唯讀模組、Sessions、題庫、配卦及插畫不修改。公開 app 不再呼叫 createNamespace，沒有指定種子的外部入口。退役連結在讀一般進度前先清掉驗收參數並回首頁，驗收空間的任何鍵均不讀寫。一般分享仍移除舊驗收參數，不帶答案或分數。

46 個既有頂層函式的 LF 正規化來源 SHA256 完全相同。另 8 個與驗收 UI 相鄰的函式，扣除驗收分支後的正常路徑來源 SHA256 相同。一般 click handler 扣掉三個測試動作後完全相同，鍵盤 handler 與最後載入檢查完全相同。這些來源比對不是真人效度證據。

### 已執行的記憶體檢查

候選 JavaScript 通過 node --check。以實際資料、引擎與 Sessions，在隔離的記憶體 DOM 中比對 17 組正常路徑，全部通過。

- 首頁、一般入口、資深入口、圖鑑報告、方法、關於與來源頁的 HTML 及儲存狀態相同。
- 10、20、48 題各完成一場全中立及一場有方向的五點作答，原版正常路徑與候選的最終 HTML／存檔一致。全中立分別完成 16／26／54 題並保留 64 候選，有方向者直接已定。
- 四組退役網址回一般首頁、保留無關參數，沒有讀寫驗收儲存、沒有清除一般儲存、沒有顯示驗收 JSON 或入口。
- 分享連結仍只到原型圖鑑，不帶測試參數。
- modes.css 只刪除 qa 類別規則，保留其餘模式比較及回應提示樣式。

上述是記憶體行為比對，不是實際手機瀏覽器操作，也不取代公開清理版套用後的針對性回歸。

### 套用後仍須執行

正常手機 390 CSS 像素下檢查三版入口與問卷。確認有效中立、漏答、返回修改、重新整理續答、全中立未定、已定結果、舊封存、分享與重設取消。舊驗收網址應安全回首頁且一般進度保持，頁面及原始碼不再包含驗收表單、測試按鈕或可見 JSON。發布後另比對網站實際雜湊，將最終清理版的 commit／部署識別寫入交付紀錄。300 場被測 commit 與最終清理版 commit 分開標示。

### 來源與保留雜湊

以下機器可讀資料中的函式來源採 LF 正規化後 SHA256，核心模組則為原始檔案位元組 SHA256。候選尚未發布。


```json
{
  "syntaxChecked": true,
  "comparedNormalUiCases": 17,
  "cases": [
    {
      "kind": "normal route equality",
      "route": "#home",
      "passed": true
    },
    {
      "kind": "normal route equality",
      "route": "#explore",
      "passed": true
    },
    {
      "kind": "normal route equality",
      "route": "#senior",
      "passed": true
    },
    {
      "kind": "normal route equality",
      "route": "#atlas/1",
      "passed": true
    },
    {
      "kind": "normal route equality",
      "route": "#method",
      "passed": true
    },
    {
      "kind": "normal route equality",
      "route": "#about",
      "passed": true
    },
    {
      "kind": "normal route equality",
      "route": "#sources",
      "passed": true
    },
    {
      "kind": "normal five-point completion equality",
      "mode": 10,
      "neutral": true,
      "total": 16,
      "complete": false,
      "candidateCount": 64,
      "passed": true
    },
    {
      "kind": "normal five-point completion equality",
      "mode": 10,
      "neutral": false,
      "total": 10,
      "complete": true,
      "candidateCount": 1,
      "passed": true
    },
    {
      "kind": "normal five-point completion equality",
      "mode": 20,
      "neutral": true,
      "total": 26,
      "complete": false,
      "candidateCount": 64,
      "passed": true
    },
    {
      "kind": "normal five-point completion equality",
      "mode": 20,
      "neutral": false,
      "total": 20,
      "complete": true,
      "candidateCount": 1,
      "passed": true
    },
    {
      "kind": "normal five-point completion equality",
      "mode": 48,
      "neutral": true,
      "total": 54,
      "complete": false,
      "candidateCount": 64,
      "passed": true
    },
    {
      "kind": "normal five-point completion equality",
      "mode": 48,
      "neutral": false,
      "total": 48,
      "complete": true,
      "candidateCount": 1,
      "passed": true
    },
    {
      "kind": "retired link strips to ordinary home without QA storage access",
      "url": "?qa=old&qaRun=r&qaCase=c&qaMode=48&qaSeed=123&keep=1#result/48",
      "passed": true
    },
    {
      "kind": "retired link strips to ordinary home without QA storage access",
      "url": "#qa",
      "passed": true
    },
    {
      "kind": "retired link strips to ordinary home without QA storage access",
      "url": "?keep=1#qa/path",
      "passed": true
    },
    {
      "kind": "retired link strips to ordinary home without QA storage access",
      "url": "?qaSeed=123#quiz/10",
      "passed": true
    }
  ],
  "unchangedFunctionCount": 46,
  "unchangedFunctions": [
    {
      "name": "adopt",
      "sha256": "214529ce9246de227b60f4a540ce55e0102f95b4fa806a4535ba1be6ade47822"
    },
    {
      "name": "useMode",
      "sha256": "feb2c5ae64331031f882e6876b58bd2e8d7ebb5349f54782cabb089187822c71"
    },
    {
      "name": "sessionModel",
      "sha256": "f170d4bb26e4612667c93285cd8bf519f75ee468a67d48c34454e575434f2745"
    },
    {
      "name": "sessionQuestions",
      "sha256": "b93513d288e7ea28626c1f9765e3671d9938ddb89be6326e5ac89ca4143abbca"
    },
    {
      "name": "questionAnswer",
      "sha256": "0856c060a152c05ead361446ffa89df60e72f7359512d443e2668219820993e3"
    },
    {
      "name": "scoredState",
      "sha256": "dc79496387624a834e4735c8f4317a5c98a30ffd5eace77a615e8f13ba3afbe3"
    },
    {
      "name": "answeredCount",
      "sha256": "91d72077920fa20db3b4b59a19167495895ac0d31f02022cc03c93a2a7353cca"
    },
    {
      "name": "persist",
      "sha256": "109344511f51b78e4ad1bc1011985c8755ecd43cbb28e96a971774921b989de3"
    },
    {
      "name": "toast",
      "sha256": "ccafe98545e95e68cae9478b785252679f407682afae6ba9a365f96567f86e64"
    },
    {
      "name": "getHex",
      "sha256": "641319f9fbccab9665edb532b8f589fc5b80dc9aebe98358a9acf05046d92db5"
    },
    {
      "name": "getTri",
      "sha256": "4cad9f61120ce6d521e3177cdf3a294f9079addf4a76981f592e2052df6b7dcf"
    },
    {
      "name": "guaName",
      "sha256": "900b77d2344871eda3df5c30b56d1ab6d29408c051cc6c164d8df09ca3e7c0ef"
    },
    {
      "name": "hexSvg",
      "sha256": "f8f675ddde1678570a64a4391a44e5f1290370d43c7d7d4f420c72dcbed1ead7"
    },
    {
      "name": "compass",
      "sha256": "9606a45296d661ecc2581aa053cab45b44fc768850f9ff9f272ec2bf1b16f97b"
    },
    {
      "name": "card",
      "sha256": "1a106ec9ab955b3603d90114961d6e83942a10f725b3994936e11f7b835f0339"
    },
    {
      "name": "reportVisual",
      "sha256": "c187578cc1d6383a21b6e11406d9dde8cbf93c0b882d25d44ccb2ba806b9fea4"
    },
    {
      "name": "resetView",
      "sha256": "c35207ecbe342ab1263e54f7f4184821c10912e68463a89b2790d3f194728afb"
    },
    {
      "name": "renderHome",
      "sha256": "104242c8669b267085b8d583fe48467c4123283a5adf2540b1b2a980dcf20898"
    },
    {
      "name": "archiveLabel",
      "sha256": "10a50e166034e107d1c4c0b6b08b4ab31911f21ce050b9fe5c61b4087ad1658f"
    },
    {
      "name": "modeProgress",
      "sha256": "6790bdb4211bb5b618871528d487550bd9e6e0b2bc7eb97b5db9f8ccd46b8e38"
    },
    {
      "name": "resumeList",
      "sha256": "1e346451192f0b4596ce3e797ed0eac6c9ebfd6f9c3e5405c37f5b709d18359c"
    },
    {
      "name": "modeComparison",
      "sha256": "55e81657f44321bde5006c42e82052f4c5ee37f3d207897d49cd05cf8ceb5b53"
    },
    {
      "name": "introDisclaimer",
      "sha256": "ce194ea4f775cc5665182db4bbc52ca9c7b0bfa907596bbd582c103156ebd1cc"
    },
    {
      "name": "renderExplore",
      "sha256": "a1537e076378b46c0584be4417a8519676cab1ab31fee244d42a0f4f43c48bbe"
    },
    {
      "name": "renderSenior",
      "sha256": "191747023f00fe1623b1e7a90a505fe45210b21e66a66b18616433fc45a732f6"
    },
    {
      "name": "renderIntro",
      "sha256": "0fe5046760c862fcd6f148237ea84da0049e7d0aa628d340c87be844078f6613"
    },
    {
      "name": "navigate",
      "sha256": "a47d9e69f8693a95dbf02f3ee91e856fe9d373d2d33f7c79222c0b08e6991812"
    },
    {
      "name": "startMode",
      "sha256": "44a17e2777af37a4e2446c0628ff12a29f37bc4b167cb9a53cec1df8ab024a90"
    },
    {
      "name": "showAnswerError",
      "sha256": "141633f20377d56e7518308155214950abb8d50281be3cb8d6e0873030bfaf56"
    },
    {
      "name": "renderQuiz",
      "sha256": "50e9e220a963dc7e0db68a991d22fef51701fe60a5590b549b09e893d71fb5cc"
    },
    {
      "name": "responseHint",
      "sha256": "a7867e4551db187282dc912545ca993fbd723f8a2e8a6de010881bf39e7b3d23"
    },
    {
      "name": "nextFivePointQuestion",
      "sha256": "9fd6f0af35fc40b13868f8b2ae81374af658f01f8dc7bb111c1226e1176e675d"
    },
    {
      "name": "finishExploration",
      "sha256": "af8b9fc9a58eb99f4153d9b435035bcb6f77a5cdf6bbf92835c28baf1c0f1c4a"
    },
    {
      "name": "renderAtlas",
      "sha256": "8449bdbf8828c31ffa9d080b99b119ed4b715e34741ae67fd8530e24970a2428"
    },
    {
      "name": "scorePanel",
      "sha256": "0f868b2b932b6749e7e4fd10f3e7ab5257b28d9072ae7ee4baa80bcb9e4408ae"
    },
    {
      "name": "legacyFullEvidence",
      "sha256": "3e636fc000c33868b79fcfd5600365f89db684ed873b1d5f26be5c26adb6429d"
    },
    {
      "name": "renderArchive",
      "sha256": "a2370002817875adb730b238697d276a9f289d777b601cd26e34cbfa07ada982"
    },
    {
      "name": "renderReport",
      "sha256": "01766b683ef48a75b2be6f84f5f629ff70349c924fbc1162cf2b0778f657b289"
    },
    {
      "name": "renderMethod",
      "sha256": "74b8fca25df10103ac05a237f7d988b592d7ab6c2540970017c63d7dd877966d"
    },
    {
      "name": "renderAbout",
      "sha256": "81e315395f1ff1bf78f11f2282637057ccb99396e73ddfa23f0c4846495ba272"
    },
    {
      "name": "renderSources",
      "sha256": "17cbc4a3bd398a56d2cb858ead80035e089eba1ba75def04360d6154f7fd30eb"
    },
    {
      "name": "renderBank",
      "sha256": "be9e89ea4ee6fb379cde30f3a106e08b90a12e0b93c2c98de611db2eac3432f3"
    },
    {
      "name": "renderNotFound",
      "sha256": "9898ca507384e382e24a3ffb7aecf0db91189dbb3a7e85c6cc1ce3a2629a1cc2"
    },
    {
      "name": "copyReportLink",
      "sha256": "7f20ddfa2c44a8ab4632c825c5ae5a98546a1963b6831d289e8e282872b996ff"
    },
    {
      "name": "wrappedText",
      "sha256": "80287b8c8c5cdf8d2361f5754ddde36a7b46c718c7259ff68725b48e5824934d"
    },
    {
      "name": "downloadCard",
      "sha256": "7f5e2fd04cf965c06eb96418b481b1bdc10603c457476256ef1551dd1e24cd3b"
    }
  ],
  "modifiedFunctions": [
    "updateSaveStatus",
    "page",
    "prepareForm",
    "renderFivePointQuiz",
    "renderPersonal",
    "renderUncertain",
    "route",
    "confirmReset"
  ],
  "removedFunctions": [
    "qaBanner",
    "qaMetadata",
    "qaQuestionEvidence",
    "appendQAResult",
    "renderQA",
    "startQA",
    "clearQA",
    "exitQA"
  ],
  "instrumentedAppSha256": "b6f4c812bb8fd98317b0a476d3c650ca6ae3c2dcdeafa1e5b8b6fb2639251a11",
  "candidateAppSha256": "36b4906feca46561772fe3822400cd8e201ae425cecf3b3ce54b074fa91a1463",
  "protectedHashes": {
    "core.js": "63a7d4cbd124288bb6ddf108383c177912ebd620e5e75b8736fd38ba3c83a92f",
    "full.js": "990b1a87eb2b74c152008fdc2df0598a9803d65daa917e7928fd94fbf8c2fae1",
    "short.js": "430e877377f72fde8e6292337d716255ea96d2632d86c88203e57bccbca049ee",
    "short-legacy.js": "8abb45c5ab1172e769b022c4370cee65cfad0603c5fff194a3eada3f86b32dda",
    "sessions.js": "8dcccad874c39beaf2352b0df8ec4eaaa1aee1f8f5c0cce12bdebc9d9699c9cf",
    "bank.js": "9c81b9dc114667237bd26396ee0739e32c82562ff35f943d97991deae97f5f02",
    "data/mapping.js": "36c6ab99fcf355ce2f2efc49e5b6893191d0d27a79fc2d09b399ce209f0a1aed"
  },
  "cssOnlyQaRulesRemoved": true,
  "liveFilesChanged": false,
  "normalProjections": [
    {
      "name": "updateSaveStatus",
      "sha256": "5cc8ba49374c4ce416452795e399c24689d3f1b8deb6a580f5fb4888488d877f",
      "equal": true
    },
    {
      "name": "page",
      "sha256": "c42710091a40f1b3ea5883d1c4087381e9fe7ea35b538f54a20fd7582912a0eb",
      "equal": true
    },
    {
      "name": "prepareForm",
      "sha256": "9d6efdf20f683d49acf65568327ded37947bfd4716e45079988552399c793c61",
      "equal": true
    },
    {
      "name": "renderFivePointQuiz",
      "sha256": "aecd2eb6021cf0a16a86d2e80d7f92b44beecf7100e0e3c399ed97b0f542181a",
      "equal": true
    },
    {
      "name": "renderPersonal",
      "sha256": "d949946e95785668b06928812bd399653b46aef07f23bbb6469408782ecee12e",
      "equal": true
    },
    {
      "name": "renderUncertain",
      "sha256": "791f7933d3498f0ef3580f401e0fd5b621c887a71bd8c42f17862b7b60476377",
      "equal": true
    },
    {
      "name": "route",
      "sha256": "250cfd0bab2c8b01c17823db1a164b0ae56096b22e262ff92127e86707a84dd4",
      "equal": true
    },
    {
      "name": "confirmReset",
      "sha256": "27a39b8d3f5c3cb81a7853716066154d265e6dc325ffe1c3107aab1e33aebefa",
      "equal": true
    }
  ],
  "normalClickHandlerSha256": "0e0d58904e55dfae9f1c8938d90e1f06f00e5889f57ca7f1e5267d08c356b105",
  "keyboardAndFinalBootstrapSha256": "405d6ce318dc597b2a530f12754c65ae9980508cc7533cc8e34acdfae449f965",
  "normalCssSha256": "3e78fb6f09f70b3aa342e914913b1911d71b58b5e963bd58625730642e1e1e2d",
  "sourceModesCssSha256": "0c8b143ab179020b7673ec065ca643025d3be16d233c950473445b3e959fa255"
}
```
