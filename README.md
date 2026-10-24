# 卦見自己｜64 型人格 × 六十四卦

繁體中文靜態網站。六組偏好組合成 64 型，以人工編訂的文王卦序表連接原創文化解讀。一般版預設 10 題，可選 20 題；資深版保留 48 題主問卷，完全同分時最多追加 6 題。各版本都有完整文化報告與對應插畫，答案與題序只存本機。

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
- 一般版 10 題／20 題使用固定題數的二選一流程，依已答內容選擇後續較需釐清的向度；不加同分補題，也不在中途自動改變選定題數。
- 資深版從獨立入口進入，目前免費體驗；未來收費是產品規劃，這一版沒有付款、帳號或解鎖流程。48 題保留五點作答與必要時最多 6 題釐清。
- 10 題、20 題、資深版各自保存進度。切換模式可續答原題序；重新開始只重設所選模式。
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

資深版每場六向度各 8 題、每向度正反各 4 題；同語意家族及同近義群最多一題。抽題採可重現種子，正式保存 48 個題目 ID。

一般版也使用同一個可追溯題庫，但改為二選一：選擇較接近自己的描述後，規則依已答偏好、各向度資訊不足的程度及去重限制選下一題。10／20 題固定完成後產生暫定的 64 型文化解讀；相同作答歷程可重現相同題序，續答沿用已保存的題目 ID。這是啟發式自適應選題，不是經校準的 IRT／電腦適性測驗。

10 題在六向度上的資訊有限，20 題可多看一些情境，48 題提供更完整的作答範圍；不能把題數直接換算為準確率、信賴區間或專業診斷。接近兩端或資料較少的向度會附上限制提示。沒有受測者校準樣本、常模或外部效度研究，因此不宣稱任何版本比較準、達到某個正確率，或短版等同長版。

## 資料與程式

`dist/` 是完整可部署站點，全部執行資產本機化，沒有 API key、帳號、模型推論、資料上傳或分析追蹤。

- `data/questions.js`：六軸定義、主問卷結構與釐清題；正式測驗開始時由題庫組卷替換主問卷。
- `core.js`：只對當前 48 題計分。缺答不是 0；補題不改原始連續分數。
- `bank.js`：十萬題 ID、篩選、組卷與續答驗證。
- `short.js`：固定 10／20 題的二選一計分、規則選題與續答重播驗證。
- `sessions.js`：各模式的獨立本機進度，以及舊版 48 題紀錄的遷移。
- `data/mapping.js`：64 型的固定人工配卦表。
- `data/hexagrams.js`：上游卦象資料，爻陣列由下至上，圖形繪製時反轉；文王卦序不是二進位數字加一。
- `data/reports-a.js`、`reports-b.js`：64 篇固定原創文化報告，逐篇核對古文短引。
- `app.js`：路由、SurveyJS 問卷 UI、本機儲存、圖鑑、題庫工作台與分享。

本機儲存鍵為 `guajian-self.session.v3`，以獨立的 10／20／48 模式紀錄保存題庫／計分版本、已答內容及題目 ID。原有 `guajian-self.session.v2` 的有效 48 題進度只遷移至資深版；不會當成 10／20 題的答案。損壞或版本不相容的紀錄不沿用；頁面提示重新開始。資料不會帶進分享連結。一般版入口為 `#explore`，資深版入口為 `#senior`；問卷與結果使用包含模式的路由。

## 重建與測試

公開 GitHub 來源包將四個較大檔案以 `.gz` 無損保存。下載該來源包後先執行 `python scripts/prepare-source.py`，再執行 `python scripts/prepare-source.py --verify`；`source-archive-manifest.json` 記錄四檔壓縮前後的大小與 SHA256。這些檔案與還原腳本在模式更新中原樣保留。完整網站 ZIP 已含還原後的資產，入口為 ZIP 根目錄的 `index.html`，可直接部署；網站執行時不解壓、不下載外站資產。

Python 需要 `openpyxl`（公開原題 collector 解析原始量表鍵）；本次使用 Codex 隨附 Python。靜態網站本身無 Python／Node 執行依賴。

```text
python scripts/build-question-bank.py
node --test tests/core.test.cjs tests/content.test.cjs tests/bank.test.cjs tests/artwork.test.cjs tests/short.test.cjs tests/sessions.test.cjs
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

原創程式與文案採根目錄 MIT。第三方授權不被根目錄授權取代：

- SurveyJS Form Library：MIT，`dist/licenses/SurveyJS-MIT.txt`。
- strobus/i-ching 靜態資料：MIT，`dist/licenses/i-ching-MIT.txt`。
- IPIP：官方 public domain；來源與原始許可證據在 `research/`。
- TIPI：作者任何用途許可；Mini-Markers：作者 public domain。原始項目分開留存。
- 古文來源：《周易》維基文庫逐卦頁，報告各有直接連結；現代白話、人格配對與建議均原創。

Qwen3 及其他 Hugging Face 人格資料只列研究備選，沒有下載權重或參與正式計分。沒有納入授權不明、限制改作、受測者隱私資料或非商業限定的候選題庫。

## 驗收範圍

核心測試覆蓋正反向、缺答、中立、補題、返回修改與 64 型可達性；內容測試核對 64 篇、來源欄位、字數、卦象方向、本機資產與授權雜湊；題庫測試核對十萬實體題、來源路徑、組卷平衡、去重與續答。

短版與進度測試另檢查固定題數、二選一輸入、依作答選題、六向度覆蓋、去重、可重現重播、修改答案後的後續題序、模式隔離及 v2 遷移。測試驗證工程規則，不是準確率證據。

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
