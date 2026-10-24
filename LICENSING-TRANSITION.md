# 授權轉換與既有權利保留

政策版本：1.0；發行日期：2026-10-25（Asia/Taipei）。本政策隨本次包含新 LICENSE 的正式提交提供；實際提交識別可在本文件的 GitHub 歷史及本次發布紀錄核對。新條件只依本文件記載的適用範圍生效，不以日期取代舊版權利。

## 轉換的實際意義

後續有權授權的新原創受保護材料，改以「非商業免費、商業使用須另行取得付費書面授權」的 source-available 方式提供。含商業使用限制的本版整體不稱為 MIT 或 OSI 開源。依 OSI 定義，公開原始碼本身不足以構成開源，且不能排除商業使用領域。[OSI Open Source Definition，第 1、6 條](https://opensource.org/osd)。

本次轉換**不追溯撤銷 MIT、不刪除舊 MIT 通知，也不表示過去公開的程式突然不能商用**。新商用條件須與已授出的舊許可、上游權利、第三方內容及不受著作權保護的元素分開判斷。

## 可辨識的舊 MIT 版本

| 紀錄 | 授權及保留方式 |
| --- | --- |
| 正式公開清理版 `e1655d80e49981ce37a436cbc0a8591aead422fb` | 當時根目錄 LICENSE 為 MIT，含原創貢獻與第三方範圍聲明；其完整原文保存在 LICENSE-MIT-LEGACY.txt。 |
| 帶臨時驗收入口的 `23d58a6f94405ba15461836a33a7294fa599c5cd` | 300 場矩陣 UI 驗收的固定被測來源；歷史版本授權依該版隨附文件保留。 |
| 本次條件式公開發行 | 更新授權、說明與來源頁；不改上述歷史版本、計分、題庫、插畫、300 場證據或凍結分析。 |

舊版 MIT 原文：[固定 commit 的 LICENSE](https://github.com/MySkyCastle-droid/gua-jian-self-64/blob/e1655d80e49981ce37a436cbc0a8591aead422fb/LICENSE)。本版的 `LICENSE-MIT-LEGACY.txt` 與該 commit 的 LICENSE 逐位元相同，SHA256：

`2018c4d20f0911b0e5a6b0519cb405dd50878030c191a5b710e004049df3adec`

原文含 MIT 全文、`Copyright (c) 2026 卦見自己 contributors`，以及原有第三方範圍說明；未加字、未截短、未將其改稱非商業授權。

## 舊 MIT 使用者保留什麼

任何人依法取得上述舊 MIT 版本或其合法散布的副本，仍可依其條件使用、重製、修改、合併、發布、散布、再授權及銷售。取得副本的時間不必早於轉換日；必須保留 MIT 要求的著作權與許可通知，並遵守各第三方條件。MIT 原文載明這些權利與保留通知的條件。[OSI MIT 原文](https://opensource.org/license/mit)。

新版內可辨識、已受原 MIT 許可涵蓋的相同內容，也不會因換一份根授權、換檔名、重新壓縮、換網址或包裝進新版本而喪失原有許可。使用者可依合法取得的 MIT 內容行使權利。本專案不以新文件向該等已獲准的商用追收授權費。

**如果一個後續版本只改授權文字，而程式、題庫、報告或插畫與舊 MIT 版本相同，就不能據此宣稱所有舊模組已被全面鎖回，或所有使用者從此必須付費。** 商用收費範圍須落在有權另行授權、尚未另有可用 MIT 許可的新受保護創作，或雙方另行約定的更新、支援與服務；不能對僅依舊 MIT 使用者憑空加價。

MIT 允許較大作品或修改版本採用附加條件，但原 MIT 部分仍須保留原通知；這與移除所有既有 MIT 權利不同。GitHub 的授權轉換指南也區分新版條款、既有許可相容性及各著作權人權限。[GitHub Open Source Guides：Changing the license](https://opensource.guide/legal/#what-if-i-want-to-change-the-license-of-my-project)。

## 第三方、公有領域與概念例外

| 類別 | 新授權不改變的邊界 |
| --- | --- |
| SurveyJS Form Library 3.2.2 | 保留 Devsoft Baltic OÜ 的 MIT；不得改稱本案獨占元件或對單獨依 MIT 使用者收取本案授權費。 |
| strobus/i-ching 靜態資料 | 保留 P. Strobus 的 MIT 及來源提交；卦象上游資料不因包裝為 JavaScript 而改變原許可。 |
| IPIP、Mini-Markers 原始項目 | 依上游 public-domain 聲明使用；收錄不使其私有化。 |
| TIPI 原始英文項目 | 依作者任何用途的公開許可；不改稱本案獨占、MIT 或 CC0。 |
| 古代《周易》原文與抽象卦義 | 不對公有領域古文、抽象思想、事實、一般方法或獨立實作概念收本案授權費；本案新的具體現代文案、編排與表達另行判斷。 |
| AI 生成插畫與設計 | 保留原有可著作性、非獨占及可能近似他作的限制；只對依法能授予的部分提供許可，不以檔案存在即推定完整排他權。 |
| 商標與第三方品牌 | 權利仍屬各權利人；不宣稱本案品牌已註冊，也不承諾提供 MBTI® 或其他第三方商標權。 |

逐項來源以 `THIRD_PARTY_NOTICES.md`、`dist/licenses/`、`vendor-manifest.json`、`research/` 與 `artwork/README.md` 為準。原始項目、翻譯／改寫、情境衍生、選擇編排及程式包裝的權利應分層辨識，不能把整個資料夾都視為本案新獨占創作。

本授權也不排除合理使用等法定權利。GitHub 公開儲存庫依其平台條款仍可查看及站內 fork；不能把根授權解讀成全面禁止這些平台內功能。站內 fork 亦不等於自動取得所有站外商用權。[GitHub Terms of Service，D.5](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#5-license-grant-to-other-users)。

## 授權權限與貢獻者

儲存庫管理權不等於所有貢獻的著作權。沿用 `卦見自己 contributors` 署名，不虛構法定公司、權利讓與、商標註冊或完整權利鏈。新商用協議須由實際有權授權的權利人簽訂；沒有權限的既有貢獻，仍依其原有效授權與通知處理，不以新文件推定其權利已移轉。

GitHub 投稿預設依投稿當時的儲存庫授權，但這不等於著作權讓與或對未來任意條款預先同意。[GitHub Terms of Service，D.6](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#6-contributions-under-repository-license)。未來貢獻若需要不同商用再授權權限，應另行清楚取得，不從過往 MIT 提交推定。

## 本次正式發行的同步範圍

本次發行同步 README、第三方聲明、插畫說明、題庫與研究範圍說明、網站來源頁及發布完整性檢查，保留各上游授權與舊 MIT 原文。題目、計分、資料及圖像內容保持不變，300 場驗收來源與凍結統計亦不變。發布紀錄另存實際新提交與 Cloudflare 部署識別。

個人到官方網站免費自測、閱讀現有免費文化報告與保存個人結果，依新授權仍不觸發商用授權；新政策不等於新增付款頁、既有報告鎖定或可即刻付款取權。商業用途依 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)另行洽詢，目前尚未定價。

本文件記錄本案選定的授權政策與保留邊界，不宣稱 OSI 或 GitHub 已核可本自訂條款，也不對第三方權利、特定司法管轄區的可執行性或固定賠償額作保證。
