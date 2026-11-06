# 每週深度報告產生器

執行步驟，產生上週（或指定週）的 `WeeklyReport` 並存檔。

## Step 0 — 確認日期範圍

計算上週的 Monday（weekStart）與 Sunday（weekEnd），格式 `YYYY-MM-DD`。
若使用者提供參數（如 `2026-06-01`），以該日所在週為準。

## Step 1 — 讀取日報資料

從 `data/reports/` 讀取 weekStart～weekEnd 日期範圍內的所有 JSON 檔。
例如：`data/reports/2026-06-03.json` 到 `data/reports/2026-06-07.json`

若無任何日報，顯示：「該週無日報資料，請先執行 /eco-analyze」並停止。

## Step 2 — 讀取價格資料

從 `data/prices/0050.TW.json`、`data/prices/00692.TW.json`、`data/prices/00878.TW.json`、`data/prices/^TWII.json`
取出 weekStart～weekEnd 內的價格記錄（依 `date` 篩選）。

## Step 3 — 聚合分析

使用 `lib/report-aggregator.ts` 的邏輯：

- `avgSentimentScore`：所有日報 sentimentScore 的平均（四捨五入 2 位）
- `dominantSignal`：出現最多的 signal（同頻取較看多者）
- `tradingDays`：期間內有價格資料的交易日數（`countTradingDays(weekStart, weekEnd)` from `lib/price-store.ts`，
  以 0050/00692/00878/^TWII 任一有價格的日期聯集計算；不含週末、休市日，也不看日報數量）
- `pricePerformance`：每個 ticker 的週漲跌幅、週高低點
- `topRisks`：所有日報 risks 去重後取前 5 條
- `keyThemes`：從 summary 中萃取 3～5 個關鍵主題詞（如「AI算力」、「Fed升息」）

## Step 4 — AI 深度洞察（繁體中文）

根據已聚合的資料，產生：

```
weeklyInsight: 200字內的本週市場洞察，包含主要驅動力與技術面觀察
vsLastWeek: 與上週比較的一句話總結（如有上週資料，否則省略）
```

## Step 5 — 組裝並儲存

產生符合 `WeeklyReport` 型別的 JSON，儲存至：
`data/weekly/YYYY-WXX.json`（如 `2026-W24.json`，依 ISO 週數）

**同時寫入 SQLite**（儀表板與排程 gate `scripts/check-missing-weekly.ts` 都讀 DB，漏寫會導致排程重複執行）：
`weekly_reports(id, week_start, data, created_at)`，`INSERT OR REPLACE`，`data` 為整份 JSON 字串
（可用 `lib/report-store.ts` 的 `saveWeeklyReport`）。

```json
{
  "id": "<UUID>",
  "weekStart": "YYYY-MM-DD",
  "weekEnd": "YYYY-MM-DD",
  "avgSentimentScore": 7.2,
  "dominantSignal": "buy",
  "tradingDays": 5,
  "pricePerformance": [
    { "ticker": "0050.TW", "startClose": 190.0, "endClose": 195.5, "changePct": 2.89, "high": 197.0, "low": 188.0 }
  ],
  "keyThemes": ["AI算力", "Fed升息", "台股反彈"],
  "topRisks": ["利率風險", "出口管制", "超買風險"],
  "weeklyInsight": "本週台股在AI題材帶動下強勁反彈...",
  "vsLastWeek": "情緒分數較上週提升 1.5 分，訊號由 hold 升至 buy",
  "createdAt": "2026-06-09T16:30:00.000+08:00"
}
```

## Step 6 — 回報結果

以繁體中文輸出：
- 本週訊號與情緒分數
- 三檔 ETF 週漲跌幅
- 主要洞察摘要
- 已存檔路徑
