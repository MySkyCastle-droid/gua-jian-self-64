# 卦見自己｜64 型人格 × 六十四卦

繁體中文靜態網站。六組偏好組合成 64 型，以人工編訂的文王卦序表連接原創文化解讀。48 題主問卷取自大型、可追溯的情境題庫，完全同分時最多追加 6 題；答案與抽到的題目只存本機。

這是文化與自我反思產品，非官方 MBTI® 評估。原題的效度不會因翻譯、改寫、情境衍生或配卦而轉移至本產品。

## 公開網站與原始碼

- 公開測驗：https://gua-jian-self-64.pages.dev/
- GitHub：https://github.com/MySkyCastle-droid/gua-jian-self-64
- Cloudflare Pages 直接上傳交付的完整網站 ZIP，沒有建置步驟；不需環境變數或 API 金鑰。GitHub 與 Cloudflare 此版採分別發布，尚未連接自動部署。從此 GitHub 原始碼部署時，先執行下方來源準備步驟，再使用 `dist/`。
- 第三方條件與 MBTI® 商標說明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 使用

- 網站入口：`dist/index.html`。GitHub 原始碼下載後先執行 `python scripts/prepare-source.py`；完整網站 ZIP 已含還原後的資產，可直接用瀏覽器開啟，或交給任何靜態 HTTP 伺服器。
- 私人瀏覽或 `file://` 的本機儲存可能受瀏覽器限制；無法保存時仍可作答，頁面會提示。
- 主頁有「開始探索」「六十四卦圖鑑」「探索方法」；方法頁可進入「題庫與來源分流工作台」。
- 重新開始會重抽 48 題；續答會使用原本 48 個題目 ID。
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

每場六向度各 8 題、每向度正反各 4 題；同語意家族及同近義群最多一題。抽題採可重現種子，正式保存 48 個題目 ID。這是工程組卷規則，不是經校準的 IRT／電腦適性測驗。

## 資料與程式

執行來源準備後，`dist/` 是完整可部署站點，全部執行資產本機化，沒有 API key、帳號、模型推論、資料上傳或分析追蹤。

- `data/questions.js`：六軸定義、主問卷結構與釐清題；正式測驗開始時由題庫組卷替換主問卷。
- `core.js`：只對當前 48 題計分。缺答不是 0；補題不改原始連續分數。
- `bank.js`：十萬題 ID、篩選、組卷與續答驗證。
- `data/mapping.js`：64 型的固定人工配卦表。
- `data/hexagrams.js`：上游卦象資料，爻陣列由下至上，圖形繪製時反轉；文王卦序不是二進位數字加一。
- `data/reports-a.js`、`reports-b.js`：64 篇固定原創文化報告，逐篇核對古文短引。
- `app.js`：路由、SurveyJS 問卷 UI、本機儲存、圖鑑、題庫工作台與分享。

本機儲存鍵為 `guajian-self.session.v2`，含題庫／計分版本。版本不相容時提示重新開始；資料不會帶進分享連結。

## 重建與測試

此公開儲存庫將四個較大的來源／供應商檔案以 `.gz` 無損保存，避免傳輸單一大型檔案。第一步使用 Python 3.9+ 標準函式庫還原；`source-archive-manifest.json` 列出壓縮前後大小及 SHA256。準備程序只處理固定的四個路徑，驗證完整雜湊後才寫入，且不覆蓋內容不同的既有檔案；重複執行安全。還原檔案被 `.gitignore` 排除，原始 `.gz` 保留追蹤。

原題 collector 另外需要 `openpyxl` 以解析上游原始量表鍵；準備來源及建立衍生題不需要它。靜態網站本身無 Python／Node 執行依賴。Cloudflare 網站 ZIP 已包含完整還原檔案，不受這項來源封裝影響。

```text
python scripts/prepare-source.py
python scripts/prepare-source.py --verify
python scripts/build-question-bank.py
node --test tests/core.test.cjs tests/content.test.cjs tests/bank.test.cjs
python scripts/package-portable.py --output <專案外的絕對路徑.zip>
```

若日後改用 Cloudflare Pages Git 整合，建置命令可設 `python scripts/prepare-source.py`、輸出目錄設 `dist`；網站執行時不會解壓，也不會向其他站點下載資產。

公開儲存庫保留整理後的原始題目與來源網址，排除第三方完整 HTML／XLSX 快照、Sites 私人部署設定及本機快取。第一次重抓來源需連網執行 collector，抓取完成後才可使用 `--offline`。網站與十萬情境題的離線重建不依賴這些原始網頁快照。

原始 collector 的線上更新請見 `research/README.md`。供應商固定 SurveyJS 3.2.2，上游卦象 commit 與下載 SHA256 記錄於 `vendor-manifest.json`；重抓腳本為 `scripts/fetch-vendor.ps1`。

在目前這部電腦開始、恢復任何專案工作前，先執行：

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File C:\HOME\CODEX\10\codex_usage_guard\scripts\Guard-Preflight.ps1 -ProjectId 15
```

只有 exit 0 才繼續；allowed=false／exit75立即停止。長時間工作使用 `python -m guard.guard_run --project-id 15 --cwd <此專案> --stop-file <此專案內的停止檔> -- <命令>` 登錄。停止檔與守門器鎖不應自行刪除。`scripts/preview_server.py` 會合作回應守門器給定的停止檔。

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

大量情境變體尚未逐題由心理測量專家審查。本產品不宣稱常模、準確率、人口稀有度、六維獨立性或臨床用途。
