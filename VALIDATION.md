## i18n-v2 十一語展示更新（2026-10-28）

本輪擴充顯示語系至十一種，新增韓文、印地文、泰文、印尼文、德文、法文、西班牙文。計分、題庫、人格配卦、圖片與作答保存格式均保持原樣。語系切換不寫入答題欄位，並使用完整的本地化句子模板處理動態數字。

`tests/i18n-expanded.test.cjs` 新增語言包、288 條直接題、64 篇現代文章欄位、五點選項、動態題數、開放面向與首頁卦象說明的檢查，並以固定種子完成三版各 64 型及全中立的 195 個軟體流程，對照原始繁中引擎的題序、分數、分類與還原後紀錄。這是軟體規則測試，與公開瀏覽器實際操作分開計數，不代表真人效度研究。

本輪通過數、公開手機尺寸操作、語系切換續答及發布後檔案雜湊，依實際執行後的交付紀錄補列。以下前版數字維持其歷史範圍，不冒充新語言測試結果。

本機多語與匿名累計統計的最終聚焦回歸共 24／24 項通過，0 失敗、0 略過，檔案在執行期間無變動。其中包含固定種子三版 195 個全型及全中立軟體流程、5,088 次作答，逐一對照原始繁中題序、分數、分類及還原紀錄；不與後續公開瀏覽器案例相加作為真人數。獨立 SQLite 檢查另有 9 項通過，實際執行 Worker SQL 與 schema，並以 8 執行緒送出 100 組重試事件，確認 10 個識別碼的到訪、60 秒與完成里程碑各只增加一次。這些是測試資料庫數字，未加入公開流量。

打包前另完成最新完整工程回歸：16 個測試檔共 157／157 項通過，0 失敗、0 略過。完整回歸在獨立私人驗證副本執行；舊有題庫與已退役供應商的 5 份大型驗證輸入只放在該副本，沒有加入公開網站或原始碼。原有計分、題庫、配卦及插畫等 82 個受保護檔案與原版雜湊完全相同。

本機手機尺寸預覽另完成 6 個介面流程，涵蓋三版各一個已定與一個全中立案例，共 174 次作答、66 次結果語言核對及 6 次中途重新整理；全中立分別在 16／26／54 題結束。這 6 案不是正式公開網站的 195 場驗收，也不增加真人樣本數。打包階段尚未完成本版正式公開網站全型驗收，部署後的實際紀錄由交付報告另行保存。

## i18n-v1 四語展示更新（2026-10-28）

本輪新增简体中文、English、日本語，繁體中文原始題文及六軸規則保持不變。翻譯屬展示層，沒有把翻譯項目當成新原題，也不宣稱跨語言心理測量等值。

| 核對範圍 | 實際紀錄 |
|---|---|
| 內容覆蓋 | 三種新增語言均覆蓋 288 條新版行為題與 64 篇文章的 704 個現代解讀欄位；古文 64 段保留原文。其餘介面、六個面向與圖片說明另行核對。 |
| 完整工程回歸 | 本輪較早的語言包版本執行 14 個公開測試檔，145／145 通過、0 失敗、0 略過。必要的原始檔與大容量題庫驗證資料只在私人驗證副本加入，沒有放入網站或公開原始碼包。 |
| 最終展示與中立回歸 | OpenCC 詞組轉換及動態介面完成後，重新執行兩個多語測試檔，共 13／13 通過、0 失敗、0 略過；此數字不與前次 145 重複相加。 |
| 規則不變 | 82 個原有計分、題庫、配卦、原始文章與插畫等受保護檔案，逐一與前版 SHA-256 核對一致。 |
| 可重現與中立 | 60 組配對引擎流程比較語言載入前後的題序、分數與分類；三版全中立分別於 16／26／54 題完成，六軸保持開放並保留 64 個候選。 |
| 簡中品質 | 使用 OpenCC 1.4.2 `tw2sp.json` 離線建置，檢查「图鉴、之后、介于两者、计划、信息」與卦名「乾」；另檢查無 NUL、替代字元或非預期韓文字元。 |
| 測試固定資料相容 | 圖片權利頁測試僅為新增語言載入初始化補上展示模組 mock，原有權利、信箱與圖片匯出限制斷言不變。 |

程式測試沒有重新執行歷史 300 場公開手機矩陣，不是分類準確率或真人分布證據。實際瀏覽器的語言切換、手機尺寸版面、續答與發布後逐檔雜湊，依本輪交付紀錄分開保存，不用先前畫面或舊部署充數。

語言偏好使用 `gj-language-v1`，不更動 `guajian-self.session.v5` 或首頁視覺種子。`PUBLICI18N.md` 說明網址、舊紀錄原文、古文保留、離線 OpenCC 來源及 Apache-2.0 權利例外。既有圖片商用須先付費取得書面許可，舊 MIT 與其他第三方權利繼續保留。

以下保留前版歷史紀錄及各自驗證範圍。

## TWOBU 4% 圖片與授權更新（2026-10-28）

使用者已核准 A 款：64 張公開插畫均採四角 TWOBU、圖寬 4%（50px）、距邊 31px。第一張與核准樣張逐位元組相同，原始 PNG、來源 WebP、Logo 均未修改。新版移除所有圖片結果卡匯出程式與按鈕，保留不含答案的原型頁連結；作答頁不再重複顯示返回修改的工程說明。

本輪私人驗收包含三版各已定／全中立共六個完整 DOM 流程、續答、回看、獨立計分，以及版權頁、來源頁、64 張圖鑑檢查。九次 axe 結構檢查未回報 violation；排除 JSDOM 不支援的色彩對比，且不等於 WCAG 認證。新圖片另核對 256 個角落、檔案雜湊與原圖未變。這些紀錄不冒稱重新執行 300 場公開手機測試；前版及初次測試環境錯誤紀錄均保留。

計分、題庫、配卦與 v5 存檔不變。完整發行與公開網站逐檔核對紀錄保存在本輪交付包。圖片商用須先取得付費書面授權，詳見 [IMAGE-LICENSE.md](IMAGE-LICENSE.md)。

以下為較早版本的驗收紀錄，功能以目前版本為準。

# 驗收紀錄

原始 48 題版本驗收日期：2026-10-23（Asia/Taipei）。網站為原創文化探索；這份記錄驗證程式與內容一致性，不宣稱心理測量效度。下列既有操作紀錄只對當時的 48 題版本有效。

## reader-v1 展示改版（2026-10-27，Asia/Taipei）

本次僅改文章與介面展示：64 篇保留原標題、增加日常語言副標，以生活例子說明優勢與代價，每篇保留三個可操作的小練習。報告先讀生活解讀，再由原生 `details` 展開卦文短引、白話文化背景、配對理由與畫面線索；圖鑑及分享 PNG 包含副標，保留既有圖片、類型與卦象。

結果頁與無障礙標籤不顯示原始分數、百分比或算式，仍保留實際作答題數、模式與傾向條。六個面向分別說明方向、接近中間、兩邊回答並存、單題觀察有限及補充情境依賴。全中立不指定唯一類型或卦象，部分面向保持開放時仍保留原相容候選，依文王卦序排列。舊版唯讀紀錄沿用當時分類，沒有重新判定。方法頁保留技術規則。

`reader-v1` 僅是展示版本。計分／選題引擎、題庫、64 張插畫、配卦映射、v5 存檔欄位及遷移、來源與授權均不變，也未下載模型。

| 驗證範圍 | 截至本節更新的狀態 | 限制 |
| --- | --- | --- |
| 新增 `tests/result-copy.test.cjs` | 10 項通過、0 失敗、0 略過 | VM 載入真實引擎，驗證顯示與無障礙文案、各限制提示、舊分類保留及無資料修改 |
| 既有七個測試檔 | 既有91項與新10項合併重跑，101通過、0失敗、0略過 | 執行約14.23秒；工程規則與展示檢查 |
| 300 場矩陣 | 300／300凍結離線重播通過，含獨立加總核對 |  原始報告保持原樣；不是 300 場公開手機操作，也不代表 reader-v1 的公開部署驗證 |
| 九類私有 DOM／axe 結構檢查 | 已通過，未回報 violations | 不包含 JSDOM 無法支援的色彩對比檢查 |
| 公開手機九場回歸 | 獨立Cloudflare公開預覽九場通過，共276題、九次續答與返回 | 390×844瀏覽器尺寸模擬，非實體手機；另補測375×812。三版PNG均實際下載與檢視；1–5鍵盤與文化展開焦點通過，正文15px，輔助字色已加深 |
| 公開部署與資產核對 | Cloudflare預覽99／99網站檔案雜湊相同 | 正式站與GitHub發布紀錄另存交付包；預覽與正式站採相同網站檔案，不把九場記為重新完成300場 |

私有 QA 使用 axe-core 4.14.0（MPL-2.0）與 jsdom 30.1.3（MIT）；兩者只在私有驗收工具中使用，不加入公開網站執行資產。結構檢查沒有回報 violations，不等同完整無障礙驗收；JSDOM 不支援本次色彩對比檢查，必須另在實際瀏覽器人工確認。此紀錄不宣稱 WCAG 認證。

包含展示模組的完整測試命令如下；合併結果101項通過：

```text
node --test tests/core.test.cjs tests/content.test.cjs tests/bank.test.cjs tests/artwork.test.cjs tests/short.test.cjs tests/full.test.cjs tests/sessions.test.cjs tests/result-copy.test.cjs
```

## 新版五點三模式與 v5 進度更新的驗收範圍

一般版預設 10 題主題，可選 20 題主題，資深版為 48 題主題，三者均使用五點選項：`-2`「非常不像我」、`-1`「比較不像我」、`0`「介於兩者」、`1`「比較像我」、`2`「非常像我」。0 是有效中立答案，未答保留空白；只允許這五個整數。短版後續主題依先前作答與各向度資訊分布調整。48 題主題六軸各 8 題、每軸正反各 4 題，固定種子可重現。三個模式都在主題答完後，為主題原分為 0 的向度各最多追加一道來自題庫的五點釐清題，合計上限為 16／26／54 題。

三模式引擎分別保留主題原分、釐清分與最終分，最終分包含釐清分；更新前報告曾逐項顯示，reader-v1 改用自然語言與傾向條，結果頁不再顯示這些數值。各軸依實際主題及釐清總題數 n 計算 `maxAbs = 2 * n`，範圍為 −2n 至＋2n；48 題主題每軸 n = 8，若追加釐清則 n = 9。主題與所需釐清都答完即為 `finished`；只有六軸最終分均非 0 才是 `complete`。仍為 0 的軸保留未定，呈現與已知傾向相容的候選原型，依文王卦序排列，沒有排名、機率或信心估計，不硬配單一 64 型。全部選中立仍能完成探索，六軸均未定，保留全部 64 個候選。

資深版入口維持 `#senior`，目前免費體驗，新版改由 `full.js` 處理 48 題主題與最多 6 道五點釐清。修改主題保留其餘主題答案，清除失效釐清並重算所需題目，正常測驗不改寫全域主問卷。`core.js` 僅保留原規則供舊 48 題封存唯讀報告使用。一般版入口維持 `#explore`。題庫、64 張插畫、來源與授權資料不因本次模式更新改寫，未來收費僅為產品規劃。

進度驗收涵蓋三個模式分開保存、切換與重新載入續答、所選模式獨立重設，以及新的 `guajian-self.session.v5` 儲存鍵。v4 五點短版進度與既有封存原樣保留；v3 有效二選一短版放入唯讀 `archives[10]`／`archives[20]`，保留原題序、−1／＋1 答案與當時結果。`short-legacy.js` 只提供 `restore`、`questions`、`score`。有效舊 48 題紀錄按原規則驗證後完整放入 `archives[48]`；已完成者只保留舊報告，新版 48 題槽空白；未完成者另將原主題 ID、有效五點答案與位置匯入新版，保留未答空洞與後段答案。舊二選一釐清保留在封存，不轉換為五點強度；新版釐清答案為空。封存均不能修改或接續作答，路由為 `#archive/10`、`#archive/20`、`#archive/48` 及各自的 `/answers`。

備份依 v4、v3、v2 順序遷移，原始備份不改寫；較新備份存在但損壞時不回退讀更舊版本，v5 已存在時不重複匯入。局部損壞保留其他模式與有效封存。單一模式重設不刪封存；全部清除包括三模式封存及 v2／v3／v4 備份，並保存空白 v5 標記防止舊紀錄重新匯入。儲存無法讀寫時回報提示，保留可用的記憶體進度。完成但未分類的五點紀錄依 `finished` 保持結果階段。

自動化驗收另涵蓋六向度覆蓋、正反方向、主題與釐清全程語意去重、短版作答驅動選題、種子與歷程重播、返回修改後重算後續題序或所需釐清、0 與缺答區分、非法值、48 題未答空洞、全中立未定結果、損壞存檔隔離及儲存失敗。

更新前的既有驗證命令包含七個測試檔：

```text
node --test tests/core.test.cjs tests/content.test.cjs tests/bank.test.cjs tests/artwork.test.cjs tests/short.test.cjs tests/full.test.cjs tests/sessions.test.cjs
```

既有自動化驗收紀錄為 **91 項通過、0 失敗、0 略過**：既有核心／內容／題庫／插畫 26 項、五點短版與舊版唯讀模組 19 項、新版 48 題引擎 11 項、進度與 QA 儲存 35 項。這些結果驗證工程規則，不是分類準確率證據。300 場矩陣的固定被測來源為帶臨時驗收介面的 23d58a6f94405ba15461836a33a7294fa599c5cd，屬凍結離線重播。各場次完成數與差異依實際交付 JSON 為準，原報告不改寫。公開版本另執行程式保留核對與針對性手機回歸，不把 300 場記為更新後版本的同一批公開瀏覽器驗收，也不沿用下方原始 48 題歷史紀錄充數。

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


## 公開介面清理的私有候選驗證（歷史紀錄）

本節保留當時套用前的候選檢查，不代表 reader-v1 的狀態。當時候選僅包含 app.js、modes.css 與兩份說明；下列雜湊與 JSON 只對該歷史候選有效。300 場資料保留帶入口被測版的私有站點副本與原始證據，屬固定來源的凍結離線重播，不能描述為 300 場實際公開手機操作，也不能用清理後的檔案取代被測版。reader-v1 的公開手機及部署驗收狀態以上方新節為準。

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

## direct-v1 題庫與抽題驗收（2026-10-27）

新版288條核心題句已逐條自審與交叉編審，全部移除通用背景。真實首分句288個唯一；三版新卷（含補充）限制母題家族、近義群與同開場各最多一次。這是可核對的開場片語限制，不宣稱互斥的語法類型。

既有101項與新9項網站測試均通過；工作副本另含原有手機層11項，合計121／121通過、0失敗、0略過（16.24秒）。原300場凍結離線重播完全一致；新版282組引擎案例通過，含三版各64型可達、每版20種全中立與10種混合作答，獨立逐軸加總及候選集合核對一致。此批不是公開手機操作或真人心理測量研究。

六場完整JSDOM介面流程（每版已定及全中立）均通過，實際題文、5選項、開場去重及結果檢查正常；axe結構0自動violations，JSDOM色彩檢查停用。公開手機流程與Cloudflare重新部署結果另存本輪交付紀錄，不能以舊版紀錄替代。

舊進度保留原題文，不自動換成新版措辭。新短版2.1.0與Full formOrigin=direct-v1均使用原v5保存結構。原始10萬筆情境資料、來源與授權、計分、配卦、64篇報告與插畫保留。


## hero-v1 首頁展示驗收範圍

新增首頁 seed 選取規則：5 款版型 × 64 卦，共 320 組純文化展示，不是測驗結果，且不讀人格答案。每個一般新分頁訪次以 crypto 取得 32 位元 seed；sessionStorage 僅寫入 `gj-home-visual-v1` 的 `{version:1,seed}`，同一訪次回首頁或刷新保持固定，儲存不可用時保留於頁面記憶體。瀏覽器複製分頁若複製 sessionStorage，則可能保留原 seed。

新增 hero 測試涵蓋 uint32 邊界、相同種子重現、320 組可達、損壞或阻擋儲存、上下卦與六爻一致、缺少版型明確失敗及 renderer 轉義責任。既有題庫、人格引擎、插畫與授權沿用已驗證 twobu-4pct-v1 的相同位元組；本節保留既有歷史驗收紀錄，最終測試數與真實瀏覽器驗收以本輪交付報告為準，不將舊 300 場矩陣宣稱為新首頁的公開手機驗收。
