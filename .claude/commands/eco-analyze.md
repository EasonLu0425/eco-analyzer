執行今日台灣財經新聞蒐集與 ETF 分析，完整流程如下：

## Step 0 — 更新價格資料

執行：
```bash
pnpm fetch-prices
```

這會對 00662.TW、QQQ、^TWII 進行增量更新（首次執行抓取近一年；之後只補最新一天）。
若 `data/prices/` 目錄尚不存在或無資料，正常繼續，後續步驟以「無價格資料」處理。

## Step 1 — 蒐集新聞

執行：
```bash
pnpm collect-news
```

這會抓取 RSS 財經新聞並存到 `data/news/YYYY-MM-DD.json`（日期為今天）。

## Step 2 — 讀取新聞

讀取 `data/news/` 目錄下今天日期的 JSON 檔案，取得新聞列表。

## Step 2.5 — 讀取價格趨勢與歷史情緒

### 讀取價格資料

讀取以下三個檔案（若存在）：
- `data/prices/00662.TW.json`
- `data/prices/QQQ.json`
- `data/prices/^TWII.json`

每個檔案為 `PriceRecord[]`，格式：`{date, open, high, low, close, volume}`，按日期升序排列。

對每個 ticker，計算：
- **currentClose**: 最後一筆 close
- **change30d**: `(currentClose - records[length-31].close) / records[length-31].close * 100`（若記錄不足 31 筆則標示 N/A）
- **change90d**: `(currentClose - records[length-91].close) / records[length-91].close * 100`（不足 91 筆則 N/A）
- **high52w**: 最後 365 筆的 high 最大值
- **low52w**: 最後 365 筆的 low 最小值

### 讀取近 6 個月歷史情緒

讀取 `data/reports/` 目錄下所有 JSON 檔，取最近 180 天的報告，提取 `date`、`sentimentScore`、`signal` 欄位，形成時序列表（最舊→最新）。

## Step 3 — 綜合分析

結合以下三項資訊，以繁體中文分析台灣科技股 ETF（00662、QQQ）的買進時機：

1. **今日新聞**：標題與描述
2. **價格趨勢**（若有）：30日/90日漲跌幅、52週高低點位置
3. **歷史情緒趨勢**（若有）：近期 sentimentScore 走勢，判斷是否從低點回升或持續走弱

分析重點：
- 目前價格相對 52 週高低點的位置（超買/超賣）
- 30日/90日趨勢方向（動能強弱）
- 新聞情緒與價格走勢是否一致或背離
- 歷史情緒是否出現轉折信號

產生以下結構的 JSON：

```json
{
  "id": "<randomUUID>",
  "date": "<YYYY-MM-DD 今天>",
  "sentimentScore": <0到10的數字，10最正面>,
  "signal": "<strong-buy|buy|hold|avoid|strong-avoid>",
  "summary": "<120字內繁中摘要，需同時反映新聞情緒與價格趨勢>",
  "risks": ["<風險1>", "<風險2>", "<風險3>"],
  "topHeadlines": [
    {
      "title": "<新聞標題>",
      "summary": "<50字內繁中內容摘要>",
      "marketImpact": "<對科技ETF的影響：正面/負面/中性，並說明原因>"
    }
  ],
  "newsCount": <分析的新聞數量>,
  "createdAt": "<ISO-8601 timestamp，使用台灣時間 +08:00，例如 2026-06-09T15:30:00.000+08:00>",
  "priceTrends": [
    {
      "ticker": "<00662.TW|QQQ|^TWII>",
      "currentClose": <最新收盤價>,
      "change30d": <近30日漲跌幅%，無資料則 null>,
      "change90d": <近90日漲跌幅%，無資料則 null>,
      "high52w": <52週高點，無資料則 null>,
      "low52w": <52週低點，無資料則 null>
    }
  ]
}
```

若無任何價格資料，`priceTrends` 設為空陣列 `[]`。

topHeadlines 選取最重要的 5 則新聞，每則需包含：
- title: 原始標題
- summary: 50字內說明新聞內容
- marketImpact: 說明此新聞對科技股ETF（00662/QQQ）的潛在影響，標明「正面」「負面」或「中性」並給出理由

評分標準（新聞 + 價格綜合判斷）：
- 新聞正面且價格動能向上 → sentimentScore 偏高（8-10）→ strong-buy / buy
- 新聞正面但價格已接近 52 週高點 → sentimentScore 中上（6-8）→ buy / hold
- 新聞負面且價格動能向下 → sentimentScore 偏低（0-3）→ avoid / strong-avoid
- 新聞負面但價格已接近 52 週低點（超賣）→ sentimentScore 中下（3-5）→ hold / avoid
- 新聞中性 → sentimentScore 4-6 → hold

## Step 4 — 儲存結果

將 Step 3 產出的 JSON 寫入：`data/reports/<YYYY-MM-DD>.json`

寫入後確認檔案內容正確，並告訴我分析結果（訊號、分數、摘要，以及各 ticker 的價格趨勢摘要）。
