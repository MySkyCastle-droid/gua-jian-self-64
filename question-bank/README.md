# 卦見自己：可追溯情境題庫 v2.1.0

## direct-v1 題句與抽題更新（2026-10-27）

新版重新撰寫288條核心行為句，刪除「你對相關背景已有一些了解」等通用背景。每題只描述一件可回想的行為或感受，以五點回答。100,000筆歷史情境變體及3,370項來源存檔保留；它們不是十萬個不同核心題意，不能把新單句庫說成十萬條新寫題句。

新版同卷含補充題，最多各用一次母題家族、近義群與實際開場分句。開場鍵取自題文本身第一個逗號／句號之前的片語，經正規化核對，不使用題號當句型標籤；這不宣稱54題各有互斥的語法類型。新48題配對有容量檢查及200,000候選搜尋上限；無法滿足條件就明確拒絕，不悄悄重複。

`research/question-copy-a.json`與`question-copy-b.json`保存新文案，`python scripts/build-question-copy.py`重建`dist/data/question-copy.js`；`question-copy.js`提供純展示與題庫目錄。一般新場明確使用`GuaShort.create(mode,seed,{wording:'direct-v1'})`或`GuaFull.create(seed,{wording:'direct-v1'})`。Short以2.1.0、Full以formOrigin=direct-v1保留文字路徑，v5存檔欄位不增加。未帶options的API、舊2.0短版及原48題仍走原題文／題序；已有作答不暗中換題，重新抽題才啟用新版。

題目措辭參考[16Personalities繁中測驗](https://www.16personalities.com/tw/性格測試)、[Truity TypeFinder](https://www.truity.com/test/type-finder-personality-test-new)與[OpenPsychometrics OJTS](https://openpsychometrics.org/tests/OJTS/1.php)的直接短句結構，全部另行原創。沒有移植競品題文、量尺或效度；[OJTS開發頁](https://openpsychometrics.org/tests/OJTS/development/)標示CC BY-NC-SA4.0，其題目未納入本商用產品。


完整本機交付包含**實際寫出的 100,000 道情境衍生題**，以及可在瀏覽器重建完全相同題目的精簡配方。公開 GitHub 儲存庫不追蹤 65.6 MB 的生成全文；請先執行 `python scripts/build-question-bank.py` 產出 JSONL，再執行題庫測試。這些情境組合不是十萬道從網路蒐集的原題、不是十萬個獨立心理構念，也未逐題獲得心理測量效度。

| 層級 | 實際數量 | 說明 |
|---|---:|---|
| 公開原始評量項目 | 3,370 | IPIP 3,320、TIPI 10 組詞語題、Mini-Markers 40 個形容詞題；完整來源與授權見研究資料 |
| 繁中語意母題家族 | 288 | 本案重新編寫；六向度各 48 題，每向度正反向各 24 題，保留公開父題 ID 與改寫說明 |
| 組卷近義群組 | 277 | 4 組已標記的近義母題共享群組，其餘等於自身家族；每場同一群最多一道 |
| 情境衍生題 | 100,000 | 母題與明示場景／中性條件的有限組合；與母題分開計數 |
| 每次正式問卷 | 48 | 六向度各 8 題、正反向各 4 題、家族與近義群組均不重複；必要時另加原有同分釐清題 |

## 檔案

- `original-items.jsonl`：3,370 個真實原始項目，逐筆保留英文、原始 ID、來源、授權及量表計分鍵。臨床來源或關聯項目保留於研究存檔，但不得直接作為網站父題。
- `derived-items.jsonl`：100,000 行實際情境題，穩定編號 `QB000001` 至 `QB100000`。每行包含完整文字、向度、方向、家族、近義群組 `semanticCluster`、情境 ID、母題 ID、父題 ID 與改寫說明。
- `catalog.json`：288 個母題、實際用到的父題目錄、場景、條件及 12 個區段的精簡資料。
- `routing-index.json`：64 型各自支持方向的區段索引。這是「同意該題時支持該型的一個向度」，每型恰對應 50,000 題，不代表單題就能決定人格。
- `manifest.json`：來源／母題／衍生數量、去重數量、輸入及輸出檔案 SHA256、檔案大小與版本。
- `../dist/data/bank.js`：網站載入的約 178 KB 配方；網站不載入完整 65.6 MB 衍生存檔。
- `../dist/bank.js`：瀏覽、分流、可重現組卷及續答驗證 API。

## 穩定組合規則

12 個區段依 `energy`、`information`、`decision`、`organization`、`emotion`、`coordination` 排序，每軸先正向再反向。區段內母題按 ID 排序，共 24 個；每軸 29 個場景與 12 個中性條件形成 348 個情境。

```text
localIndex = contextIndex * 24 + seedIndex
contextIndex = scenarioIndex * 12 + constraintIndex
text = 情境：{scenario}，{constraint}。\n{seed.text}
```

前四區段各採 8,334 題，其餘八區段各採 8,333 題，合計 100,000。每區段理論容量 8,352，超過配額的尾端項目不屬於正式題庫。瀏覽器與 JSONL 使用相同 ID 及文字。修改母題或組合規則須重新建置並更新版本，不能在使用者續答時暗中換題。

## 使用 API

```javascript
GuaBank.stats(); // { sourceCount: 3370, seedCount: 288, count: 100000, semanticClusterCount: ... }
const form = GuaBank.createForm(12345); // 同一32位元無號種子得到相同48題
GuaBank.activate(form); // 驗證並將標準題目設成GuaData.questions
GuaBank.restoreForm(form.map(q => q.id)); // 題序、題文及家族都保留；非法問卷拋出錯誤
GuaBank.query({ axis: 'energy', typeKey: '', offset: 0, limit: 12 });
GuaBank.supportedTypes(form[0]); // 同意此題支持的一端，共32個type keys
```

`query`每頁上限 1,000 筆；篩選分型不改變正式組卷的正反向平衡。近義母題以 `semanticCluster` 分組，未特別分群時等於自身 `family`；組卷以配對演算法選滿各區段四題，同一份問卷的 48 個近義群組必須不同，即使題目方向相反也不能重複。`restoreForm` 同樣驗證這項規則。`activate`只接受能依 ID 還原的完整平衡問卷，並重新取得正式題文，避免錯誤物件改動計分方向。

## 重建與檢查

先執行專案 15 用量預檢並取得允許，再從中央守門器目錄登錄：

```powershell
python -m guard.guard_run --project-id 15 --cwd <專案目錄> --stop-file <專案目錄>\question-bank\build.stop -- python scripts\build-question-bank.py
```

如需指定 Python，兩處均使用實際 Python 執行檔的絕對路徑。建置腳本不連網，會讀取研究資料、檢查來源與重複、實際寫出全部題目，並定期檢查 `question-bank/build.stop`（或 `GUA_BANK_STOP_FILE`／`--stop-file` 指定位置）。發現停止標記即以 75 結束，保留已完成輸出與未完成的 `.partial`，不移除任何停止標記。

```powershell
node --test tests\core.test.cjs tests\content.test.cjs tests\bank.test.cjs
```

題庫測試逐行比對 100,000 題與瀏覽器配方，檢查全部正規化題文唯一、父題可追溯、原題存檔、64 型分流、組卷平衡、家族與近義群組不重複、續答還原及檔案 SHA256。

## 本版原創材料與原始來源的授權邊界

本版有權授權的新原創具體表達，依根目錄 LICENSE 採非商業免費、商用須另行付費書面授權。已依 MIT 發布的相同內容仍可依 MIT 使用；IPIP、TIPI、Mini-Markers 等原始項目仍依各自地位或許可，不被本案新條款私有化。參見 COMMERCIAL-LICENSE.md、LICENSING-TRANSITION.md 與 THIRD_PARTY_NOTICES.md。
