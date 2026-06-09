執行今日台灣財經新聞蒐集與 ETF 分析，完整流程如下：

## Step 1 — 蒐集新聞

執行：
```bash
pnpm collect-news
```

這會抓取 RSS 財經新聞並存到 `data/news/YYYY-MM-DD.json`（日期為今天）。

## Step 2 — 讀取新聞

讀取剛存好的 `data/news/` 目錄下今天日期的 JSON 檔案，取得新聞列表。

## Step 3 — 分析

根據新聞標題與內容，以繁體中文分析台灣科技股 ETF（如 00662、QQQ）的買進時機，產生以下結構的 JSON：

```json
{
  "id": "<randomUUID>",
  "date": "<YYYY-MM-DD 今天>",
  "sentimentScore": <0到10的數字，10最正面>,
  "signal": "<strong-buy|buy|hold|avoid|strong-avoid>",
  "summary": "<100字內繁中市場趨勢摘要>",
  "risks": ["<風險1>", "<風險2>", "<風險3>"],
  "topHeadlines": [
    {
      "title": "<新聞標題>",
      "summary": "<50字內繁中內容摘要>",
      "marketImpact": "<對科技ETF的影響：正面/負面/中性，並說明原因>"
    }
  ],
  "newsCount": <分析的新聞數量>,
  "createdAt": "<ISO-8601 timestamp，使用台灣時間 +08:00，例如 2026-06-09T15:30:00.000+08:00>"
}
```

topHeadlines 選取最重要的 5 則新聞，每則需包含：
- title: 原始標題
- summary: 50字內說明新聞內容
- marketImpact: 說明此新聞對科技股ETF（00662/QQQ）的潛在影響，標明「正面」「負面」或「中性」並給出理由

評分標準：
- sentimentScore 7-10 → signal: buy 或 strong-buy
- sentimentScore 4-6 → signal: hold
- sentimentScore 0-3 → signal: avoid 或 strong-avoid

## Step 4 — 儲存結果

將 Step 3 產出的 JSON 寫入：`data/reports/<YYYY-MM-DD>.json`

寫入後確認檔案內容正確，並告訴我分析結果（訊號、分數、摘要）。
