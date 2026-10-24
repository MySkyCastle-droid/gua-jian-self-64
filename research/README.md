# 公開人格原題蒐集紀錄

本資料夾是研究與來源稽核資料，不是網站會直接施測的題庫。`source-items.json` 保留 **3,370 道英文原始評量項目**：IPIP 3,320 道、TIPI 10 組詞語題、Mini-Markers 40 個形容詞題。這些是不同原始措辭，不代表 3,370 個獨立心理構念。同一句被不同量表引用、多個原始編號、翻譯與情境改寫，均不增加原題計數。

公開 GitHub 來源包不包含本機 `raw/` 的完整第三方 HTML／XLSX 快照。下列快照路徑與 `sources.json` 的雜湊是本機蒐集稽核紀錄，公開讀者應依所列來源網址核查。整理後的 `source-items.json`、母題與情境資料仍完整提供，可離線重建十萬衍生題；重新蒐集上游資料需先連網取得快取，之後才可使用 collector 的 `--offline` 模式。第三方條件見 [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)。

## 已下載與實際計數

- [IPIP 官方完整題池](https://ipip.ori.org/AlphabeticalItemList.htm)：3,320 列，正規化去重後 3,320 道，包含 3,389 個原始編號參照。
- [IPIP 使用許可](https://ipip.ori.org/newPermission.htm)：官方明示 public domain，可作商業及非商業使用；HTML 證據保存於 `raw/ipip-permission.html`。
- [官方逐題量表分配說明](https://ipip.ori.org/ItemAssignmentTable.htm)及其 Tedone XLSX：1,559 道原題成功精確連結到 3,407 條量表計分鍵。原始的 `instrument`、`label`、正負 `key`、`alpha` 與來源網址均保存；另 359 條措辭無法精確匹配，保留在 `unmatched-scale-keys.json`，沒有擅自猜配。
- [Gosling 作者官網 TIPI](https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/ten-item-personality-inventory-tipi/)：10 組詞語題，作者在[許可頁](https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/)明示任何人任何用途可使用。保留十題 Big Five 正負鍵，每組兩個詞仍只算一道題；編號固定為 `tipi-01` 至 `tipi-10`。
- [Saucier 作者官網 Mini-Markers](https://pages.uoregon.edu/gsaucier/gsau41oldversion.htm)：40 個形容詞評量項目，作者在[公開領域工具頁](https://pages.uoregon.edu/gsaucier/gsau4a.html)明示 public-domain、免費使用不需詢問。保留原有 Big Five 正負鍵；編號為 `minimarkers-<詞小寫>`。
- 740 道 IPIP 題因 T 編號的 CAT 人格疾患來源或臨床量表關聯被標記排除；其餘 2,630 道只是「待概念、措辭與繁中改寫審查的候選」。這不是臨床內容已全部排除的人工審核結果，所有原題目前 `eligibleForRuntime` 均為 `false`。
- 真正公開原題距 5,000 道尚缺 1,630 道，距 10,000 道尚缺 6,630 道。經授權創作的繁中情境可另列衍生題數，必須保留原題關係，不能宣稱是新蒐集的獨立原題。

每筆原題欄位：`id`、`originalIds`、`originalIdAnnotations`、`text`、`language`、`source`、`sourceId`、`license`、`licenseSource`、`scaleKeys`、`normalizedText`、`wordingVariants`、`review`。原量表的正負鍵只對該量表有效，並不自動成為本專案六個向度的有效計分鍵。

## 已查核但未灌入的其他來源

- [SAPA Master Item List](https://www.sapa-project.org/research/masteritemlist.html)介紹約 6,000 題，但官方同頁明示 CSV 自 2018 年 1 月起暫時下線。約 2,500 題本來就是 IPIP，其餘混有職業興趣、臨床、健康等構念，不能把頁面標示的總數直接加到 IPIP。
- [OEJTS/OJTS 開發題池](https://openpsychometrics.org/tests/OJTS/development/)的附錄 B 使用 **CC BY-NC-SA 4.0**，帶非商業限制，因此未納入本次要求的 public-domain／MIT／Apache 來源集合。
- [AMBI](https://openpsychometrics.org/tests/AMBI/)的 181 題來自 IPIP，屬既有題池的子集，未重複增加原題數。
- [GitHub NeuroQuestAi/ipip-neo-data](https://github.com/NeuroQuestAi/ipip-neo-data)與 [Hugging Face IPIP120-SCORES](https://huggingface.co/datasets/ecorbari/IPIP120-SCORES)／[IPIP300-SCORES](https://huggingface.co/datasets/ecorbari/IPIP300-SCORES)主要提供受測者紀錄和分數。數十萬資料列不是數十萬道題目；本專案未下載受測者紀錄。
- [Basic Interest Markers 作者現行頁](https://labs.wsu.edu/caw/scales/)及 [RIASEC Markers 作者現行頁](https://jrounds.weebly.com/riasec-markers-scalesitems.html)都明示著作權及非商業使用許可，雖然其舊論文標題稱為 public-domain，現行條款有衝突，因此未匯入原題或作衍生改寫。
- [O*NET 職涯探索工具授權](https://www.onetcenter.org/license_tools.html)與其資料庫授權不同。原樣重製採 BY-ND，改寫須遵循另外的 Tools Developer License；本次未作該整合，也沒有誤標為無條件公開領域。

## 重跑方式

下載工作需先通過專案 15 的用量預檢，再透過中央守門器登錄執行：

```powershell
python -m guard.guard_run --project-id 15 --cwd <專案目錄> --stop-file <專案目錄>\research\collect.stop -- python scripts\collect-public-items.py
```

從 `<守門器目錄>` 執行上述命令；若 PATH 的 `python` 是 Windows Store stub，應將兩個 Python 命令都替換成可用執行檔的絕對路徑。腳本會讀取已保存的 raw 檔案作為快取，`--refresh` 才重新抓取，`--offline` 完全不連網。每個原始檔案的 SHA256、大小與網址記錄於 `sources.json`；腳本偵測到 `research/collect.stop` 時以 75 結束，絕不刪除停止標記。

蒐集腳本只改本資料夾，不修改網站題庫、計分或現有測試。新增來源時，既有 `ipip-*` 編號與原文均穩定保留。
