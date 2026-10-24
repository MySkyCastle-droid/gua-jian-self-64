# 卦見自己｜64 型人格 × 六十四卦

**授權政策：原始碼可見、非商業使用免費；適用的新原創受保護材料，商業使用須另行取得付費書面授權。** 詳見 [LICENSE](LICENSE)、[商用說明](COMMERCIAL-LICENSE.md) 與 [舊 MIT 權利保留](LICENSING-TRANSITION.md)。個人到官方網站免費自測不受影響，既有 MIT 與第三方許可保留。本版整體不是 OSI 開源。

繁體中文靜態網站。六組偏好組合成 64 型，以人工編訂的文王卦序表連接原創文化解讀。一般版預設 10 題主題，可選 20 題主題；資深版有 48 題主問卷。三個模式均使用五點作答，主題原分為 0 的向度各最多加一道題庫釐清題，合計最多 16／26／54 題。有唯一分類時顯示文化報告與對應插畫；仍有未定向度時保留分數與相容原型，答案與題序只存本機。

這是文化與自我反思產品，非官方 MBTI® 評估。原題的效度不會因翻譯、改寫、情境衍生或配卦而轉移至本產品。

## 公開網站與原始碼

- 公開測驗：https://gua-jian-self-64.pages.dev/
- GitHub：https://github.com/MySkyCastle-droid/gua-jian-self-64
- Cloudflare Pages 直接上傳 `dist/`，沒有建置步驟；不需環境變數或 API 金鑰。GitHub 與 Cloudflare 此版採分別發布，尚未連接自動部署。
- 第三方條件與 MBTI® 商標說明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 使用

- 網站入口：`dist/index.html`。完整解壓縮後可直接用瀏覽器開啟，或交給任何靜態 HTTP 伺服器。
- 私人瀏覽或 `file://` 的本機儲存可能受瀏覽器限制；無法保存時仍可作答，頁面會提示。
- 主頁有「開始探索」「六十四卦圖鑑」「探索方法」；方法頁可進入「題庫與來源分流工作台」。
- 一般版 10 題／20 題使用與 48 題主問卷相同的五點選項，依已答內容安排後續主題。完成主題後，主題原分為 0 的向度各追加一道五點釐清題；10 題版合計 10–16 題，20 題版合計 20–26 題。
- 五點值與標籤依序為 `-2`「非常不像我」、`-1`「比較不像我」、`0`「介於兩者」、`1`「比較像我」、`2`「非常像我」。0 是有效答案，未答保留空白。
- 資深版從獨立入口進入，目前免費體驗；未來收費是產品規劃，這一版沒有付款、帳號或解鎖流程。48 題六軸各 8 題主題，必要時各加一道五點釐清，合計最多 54 題；釐清分納入最終分，最終仍為 0 時保留未定。
- 新版 10 題、20 題、資深版各自保存進度。切換模式可續答原題序；重新開始只重設所選模式。舊二選一短版與舊 48 題紀錄另外封存為唯讀，頁尾「清除本機紀錄」會一併清除所有進度、封存與舊版備份。
- 分享卡是本機 Canvas 生成的 PNG，只含文章原型；原型連結使用 `#atlas/卦序`，不含答案與分數。

## 題庫數字如何解讀

公開原始來源共 **3,370 個評量項目**：IPIP 3,320 題、TIPI 10 組詞語題、Mini-Markers 40 個形容詞題。它們不是 3,370 份量表，也不是受測者資料列。

本產品另依公開題意撰寫 **288 個繁中母題條目（歸為 277 個近義群）**，再用受控情境規則建立 **100,000 道情境衍生題**。十萬是可重現的衍生題實例數，不代表十萬道從網路直接取得的獨立原題，也不代表十萬個心理構念。母題與父題的關係、改寫註記、來源限制均保留。

- `research/source-items.json`：未改寫的原始項目、來源、授權與量表鍵。
- `research/bank-seeds-a.json`、`bank-seeds-b.json`：288 個繁中母題，含父題 ID。
- `research/bank-contexts.json`：各向度的情境與條件。
- `question-bank/derived-items.jsonl`：實體輸出的十萬題，逐行 JSON，供離線檢索與後續擴充。
- `question-bank/` 的 manifest／catalog／routing-index：實際筆數、雜湊、生成規則及 64 型分流索引。
- `dist/data/bank.js`：相同有限題庫的精簡配方。網頁按 ID 還原所需題目，不必先下載十萬題全文。

每題依本案構念標註一個主要向度與正反方向。同意一題支持該向度相符的 32 型，反向作答支持另一端；64 型由整份問卷共同決定。分型檢索不會改變正式組卷的正反向平衡。

資深版每場六向度各 8 題主題、每向度正反各 4 題；同語意家族及同近義群最多一題。抽題採可重現種子，正式保存 48 個主題 ID。全部主題答完後，主題原分為 0 的向度各從題庫選一道五點釐清題；釐清與主題全程排除重複語意家族及近義群，最多 6 題。返回修改主題會保留其餘主題答案，並清除失效的釐清答案與重算所需釐清題。

一般版也使用同一個可追溯題庫，短版引擎 v2 改用五點作答。前六題覆蓋六個向度；10 題主題依種子輪替選兩軸，各追加一組正反向追問；20 題主題先讓六軸各回答三題，再對主題原分絕對值較小的一軸追加最後兩題。追問方向依該組開始時的作答傾向安排，並排除重複語意；0 分的方向由種子穩定選定，不因此加入分數或指定人格端點。相同種子與作答歷程可重現相同題序，修改較早答案會重新安排後續題序與答案。

主題原分為 0 的向度各加一道來自相同題庫的五點釐清題，每軸最多一次。報告分開顯示主題原分、釐清分與最終分；釐清分納入最終分，各軸以實際主題及釐清總題數 n 計算 `maxAbs = 2 * n`，範圍為 −2n 至＋2n。最終分仍為 0 就保留未定，不選定任一端，也不硬配單一 64 型；相容候選原型依文王卦序列出，沒有排名、機率或信心估計。全部選中立時六軸均未定，仍可完成探索並閱讀全部候選。這是產品的分流與呈現規則，不是經校準的 IRT／電腦適性測驗。

10 題在六向度上的資訊有限，20 題可多看一些情境，48 題提供更完整的作答範圍；不能把題數直接換算為準確率、信賴區間或專業診斷。接近兩端或資料較少的向度會附上限制提示。沒有受測者校準樣本、常模或外部效度研究，因此不宣稱任何版本比較準、達到某個正確率，或短版等同長版。

## 資料與程式

`dist/` 是完整可部署站點，全部執行資產本機化，沒有 API key、帳號、模型推論、資料上傳或分析追蹤。

- `data/questions.js`：六軸定義與舊版問卷資料；新版引擎直接使用題庫題目，不改寫全域主問卷。
- `core.js`：唯讀舊版 48 題計分，版本與規則不變。舊二選一補題不改原始連續分數，只供舊版封存報告使用。
- `bank.js`：十萬題 ID、篩選、組卷與續答驗證。
- `short.js`：v2 五點短版計分、10／20 題主題與每軸最多一道釐清、規則選題及續答重播驗證。`finished` 表示主題與所需釐清均已答完，`complete` 另要求六軸最終分均不為 0。
- `full.js`：新版 48 題五點計分、各軸 8 題主題與每個零分軸一道題庫釐清、主題答案空洞與種子續答驗證。與短版共用主題／釐清／最終分及 `finished`／`complete` 的定義。
- `short-legacy.js`：v1 二選一短版的唯讀模組，只提供 `restore`、`questions`、`score`，保留當時題序、−1／＋1 答案與結果，不能接續作答或改分。
- `sessions.js`：v5 各模式獨立進度、三模式舊紀錄唯讀封存、v4／v3／v2 遷移，以及供私有驗收副本使用的隔離儲存工具；公開介面不啟用驗收空間。
- `data/mapping.js`：64 型的固定人工配卦表。
- `data/hexagrams.js`：上游卦象資料，爻陣列由下至上，圖形繪製時反轉；文王卦序不是二進位數字加一。
- `data/reports-a.js`、`reports-b.js`：64 篇固定原創文化報告，逐篇核對古文短引。
- `app.js`：正常探索路由、五點問卷 UI、本機儲存、圖鑑、題庫工作台與分享。

本機儲存鍵為 `guajian-self.session.v5`，以獨立的 10／20／48 模式紀錄保存題庫／計分版本、已答內容及題目 ID。短版內層仍只有 `mode`、`seed`、`version`、`bankVersion`、`questionIds`、`answers` 六欄，主題與釐清答案連續保存，最多 16／26 筆。新版 48 題內層另存固定主題 ID、主題答案物件、所需釐清 ID 及釐清答案物件，未答與有效的 0 明確區別。

首次升級依序讀取 v4、v3、v2，保留原始備份；較新備份只要存在就不回退讀取更舊資料。v4 的五點短版進度與既有二選一短版封存原樣保留，v3 的有效二選一短版進入 `archives[10]`／`archives[20]`。有效舊 48 題依原規則驗證後完整封存到 `archives[48]`：已完成者保留舊報告，新版 48 題槽保持空白；未完成者另外匯入原主題 ID、五點答案與題目位置，保留中間未答與後段答案。舊二選一釐清只留在封存，不轉成新版五點強度，新版釐清答案重新開始。v5 一旦存在就優先使用，局部損壞只重設受影響的紀錄。單一模式重新開始保留其他模式與封存；全部清除會移除所有封存及 v2／v3／v4 備份，並留下空白 v5 重設標記，避免重新匯入舊答案。資料不會帶進分享連結。

一般版入口維持 `#explore`，資深版維持 `#senior`；問卷與結果使用包含模式的路由。三模式封存使用 `#archive/10`、`#archive/20`、`#archive/48`，各自的 `/answers` 可閱讀答案明細。

公開版已撤除臨時驗收入口、指定種子表單、測試按鈕及題目／結果 JSON。舊的 ?qa、qaRun、qaCase、qaMode、qaSeed 連結會移除這些參數並回到一般首頁，#qa 亦回首頁。正常進度只使用一般儲存，不讀取、匯入或清除驗收空間；原先驗收資料仍留在原瀏覽器。一般版、資深版、舊版唯讀封存與分享功能維持原行為。

## 重建與測試

公開 GitHub 來源包將四個較大檔案以 `.gz` 無損保存。下載該來源包後先執行 `python scripts/prepare-source.py`，再執行 `python scripts/prepare-source.py --verify`；`source-archive-manifest.json` 記錄四檔壓縮前後的大小與 SHA256。這些檔案與還原腳本在模式更新中原樣保留。完整網站 ZIP 已含還原後的資產，入口為 ZIP 根目錄的 `index.html`，可直接部署；網站執行時不解壓、不下載外站資產。

Python 需要 `openpyxl`（公開原題 collector 解析原始量表鍵）；本次使用 Codex 隨附 Python。靜態網站本身無 Python／Node 執行依賴。

```text
python scripts/build-question-bank.py
node --test tests/core.test.cjs tests/content.test.cjs tests/bank.test.cjs tests/artwork.test.cjs tests/short.test.cjs tests/full.test.cjs tests/sessions.test.cjs
python scripts/package-portable.py --output <專案外的絕對路徑.zip>
```

公開儲存庫保留整理後的原始題目與來源網址，排除第三方完整 HTML／XLSX 快照、Sites 私人部署設定及本機快取。第一次重抓來源需連網執行 collector，抓取完成後才可使用 `--offline`。網站與十萬情境題的離線重建不依賴這些原始網頁快照。

原始 collector 的線上更新請見 `research/README.md`。供應商固定 SurveyJS 3.2.2，上游卦象 commit 與下載 SHA256 記錄於 `vendor-manifest.json`；重抓腳本為 `scripts/fetch-vendor.ps1`。

在目前這部電腦開始、恢復任何專案工作前，先執行：

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File <守門器目錄>\scripts\Guard-Preflight.ps1 -ProjectId 15
```

只有 exit 0 才繼續；allowed=false／exit75立即停止。長時間工作使用 `python -m guard.guard_run --project-id 15 --cwd <此專案> --stop-file <此專案內的停止檔> -- <命令>` 登錄。停止檔與守門器鎖不應自行刪除。`scripts/preview_server.py` 會合作回應守門器給定的停止檔。

模式版本的本機發行工具為 `scripts/package-mode-release.py --source-directory <此專案> --public-source <已整理的公開來源目錄> --output-directory <新的交付目錄> --run-id <本次識別>`。它只讀來源，建立完整網站 ZIP、公開來源 ZIP 與逐檔 SHA256／CRC 驗證清單；不重包原始 PNG、不改寫先前交付檔。`scripts/verify-mode-deployment.py --directory dist --url <公開HTTPS根網址> --output <新的驗證JSON> --run-id <本次識別>` 會以最多 3 個並行 GET、20 秒 timeout、一次重試比對所有本機網站檔案。兩者均須經中央守門器登錄；可選 `--cutoff <帶時區ISO時間>`，沒有固定歷史截止時間。它們不發布 GitHub 或 Cloudflare。

## 授權與來源

本版依法有權授權的原創部分採根目錄條件式公開授權：非商業免費，商業使用須另行付費書面授權。已依 MIT 發布的舊版及相同內容仍保有 MIT 權利；更換文件不能追溯鎖回。第三方授權不被根目錄授權取代：

- SurveyJS Form Library：MIT，`dist/licenses/SurveyJS-MIT.txt`。
- strobus/i-ching 靜態資料：MIT，`dist/licenses/i-ching-MIT.txt`。
- IPIP：官方 public domain；來源與原始許可證據在 `research/`。
- TIPI：作者任何用途許可；Mini-Markers：作者 public domain。原始項目分開留存。
- 古文來源：《周易》維基文庫逐卦頁，報告各有直接連結；現代白話、人格配對與建議均原創。

Qwen3 及其他 Hugging Face 人格資料只列研究備選，沒有下載權重或參與正式計分。沒有納入授權不明、限制改作、受測者隱私資料或非商業限定的候選題庫。

## 驗收範圍

核心測試覆蓋正反向、缺答、中立、補題、返回修改與 64 型可達性；內容測試核對 64 篇、來源欄位、字數、卦象方向、本機資產與授權雜湊；題庫測試核對十萬實體題、來源路徑、組卷平衡、去重與續答。

短版、資深版與進度測試另檢查五點輸入、10／20／48 題主題、每個零分軸一次釐清、主題／釐清／最終分、完成與唯一分類的區別、未定候選、依作答選題、六向度覆蓋、去重、可重現重播、修改答案後的後續題序或失效釐清、模式隔離、v5 保存與 v4／v3／v2 遷移、三模式唯讀封存、QA 儲存隔離及儲存失敗。目前自動化測試共 91 項通過。現有題庫、64 張插畫、來源與授權資料保持原樣。測試驗證工程規則，不是準確率證據；300 場矩陣驗收的固定被測來源為帶臨時入口的 23d58a6f94405ba15461836a33a7294fa599c5cd，完成數與差異依實際交付紀錄。公開清理版另核對程式保留範圍並執行針對性手機回歸；不能把這 300 場宣稱為清理後版本的同一批測試。

大量情境變體尚未逐題由心理測量專家審查。本產品不宣稱常模、準確率、人口稀有度、六維獨立性或臨床用途。

## 64 型插畫

每型對應一張獨立 AI 生成原圖；依人格代碼與卦序放入首頁示例、圖鑑、報告及 HTTP 網址下的分享卡。準確卦線仍由 SVG 繪製，不交給生成圖辨識。公開網站使用 WebP 編碼，原始 PNG 另包交付。

公開設計與生成來源記錄在 `art-direction/artwork-manifest.json`；網站副本為 `dist/data/artwork-sources.json`。圖像原創性與權利範圍說明見 `artwork/README.md`。本機逐張生成紀錄含路徑，因此不隨公開來源包發布。

網站已含 WebP，不需要安裝圖像工具。僅當開發者要從原始 PNG 重新編碼時，`scripts/build-artwork-assets.cjs` 需要 Node.js 與 sharp；此步驟保留圖像尺寸與構圖，並保留未修改原圖。

<!-- artwork-release:start -->
## 64 張人格插畫

64 型各有一張獨立、經人工檢查的內建 imagegen 插畫。網站直接使用 `dist/assets/personality/hexagram-01.webp` 至 `hexagram-64.webp`，不需模型、API 金鑰或額外圖片建置。圖鑑、結果頁與分享卡會使用對應圖像。

`art-direction/artwork-manifest.json` 和 `dist/data/artwork-sources.json` 保存全部 64 圖的公開提示、文化參考頁、尺寸與 SHA256；`art-direction/prompts-01-32.json`、`prompts-33-64.json` 保存設計提示。圖像使用與權利說明見 `artwork/README.md` 和 `dist/licenses/Artwork-Notes.txt`。

公開來源已含完整 WebP，完成原有 `python scripts/prepare-source.py` 來源還原步驟後即可部署 `dist/`。原始 PNG 與含本機路徑的生成檢查紀錄另行保存，不在公開儲存庫內。只有另備全部 64 張原始 PNG、各圖的本機生成檢查紀錄，並安裝 Node.js 與 `sharp` 後，才可執行 `node scripts/build-artwork-assets.cjs` 重新編碼。這個指令保留原圖尺寸、不裁切，並重新驗證原圖雜湊；一般部署不需要執行它。
<!-- artwork-release:end -->

本次新授權發布請使用 `scripts/package-mode-release.py`；舊的固定檔數 `package-public-art-source.py` 與原圖專用 `package-art-release.py` 未支援本次新授權文件，不應用於本版發布。
