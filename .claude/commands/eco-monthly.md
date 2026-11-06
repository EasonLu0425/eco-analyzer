# 每月深度報告產生器

執行步驟，產生上個月（或指定月份）的 `MonthlyReport` 並存檔。

## Step 0 — 確認月份

預設為上個月，格式 `YYYY-MM`。
若使用者提供參數（如 `2026-05`），以該月份為準。
推算 monthStart（`YYYY-MM-01`）與 monthEnd（該月最後一天）。

## Step 1 — 讀取日報資料

從 `data/reports/` 讀取該月份所有 JSON 檔（`YYYY-MM-*.json`）。

若無任何日報，顯示：「該月無日報資料」並停止。

## Step 2 — 讀取週報資料

從 `data/weekly/` 讀取該月份內的所有週報 JSON 檔，用於萃取 keyEvents 與比較。

## Step 3 — 讀取價格資料

從 `data/prices/0050.TW.json`、`data/prices/00692.TW.json`、`data/prices/00878.TW.json`、`data/prices/^TWII.json`
取出月份範圍內的價格記錄（依 `date` 篩選）。

## Step 4 — 聚合分析

- `avgSentimentScore`：所有日報 sentimentScore 平均（四捨五入 2 位）
- `dominantSignal`：出現最多的 signal
- `sentimentTrend`：按時間序列比較前半月與後半月平均，差距 > 0.5 → improving/declining，否則 stable
- `tradingDays`：期間內有價格資料的交易日數（`countTradingDays(monthStart, monthEnd)` from `lib/price-store.ts`，
  以 0050/00692/00878/^TWII 任一有價格的日期聯集計算；不含週末、休市日，也不看日報數量）
- `pricePerformance`：每個 ticker 的月漲跌幅、月高低點
- `topRisks`：所有日報 risks 去重後取前 5 條
- `keyEvents`：從週報 weeklyInsight 中萃取 3～5 個本月重大事件（一句話描述）
- `sectorRotation`：從日報 summary 中推斷資金流向（如「外資轉進半導體」、「債券資金流出」），最多 3 條

## Step 5 — AI 月度洞察（繁體中文）

根據聚合資料產生：

```
monthlyInsight: 300字內的月度市場分析，包含趨勢轉折點與驅動因素
investmentOutlook: 下個月的投資展望，包含具體的 ETF 操作建議（200字內）
```

## Step 6 — 組裝並儲存

產生符合 `MonthlyReport` 型別的 JSON，儲存至：
`data/monthly/YYYY-MM.json`（如 `data/monthly/2026-05.json`）

**同時寫入 SQLite**（排程 gate `scripts/check-missing-monthly.ts` 讀 DB，漏寫會導致重複執行）：
`monthly_reports(id, month, data, created_at)`，`INSERT OR REPLACE`，`data` 為整份 JSON 字串
（可用 `lib/report-store.ts` 的 `saveMonthlyReport`）。

```json
{
  "id": "<UUID>",
  "month": "2026-05",
  "tradingDays": 20,
  "avgSentimentScore": 6.8,
  "dominantSignal": "buy",
  "sentimentTrend": "improving",
  "pricePerformance": [
    { "ticker": "0050.TW", "startClose": 185.0, "endClose": 196.0, "changePct": 5.95, "high": 198.0, "low": 183.0 }
  ],
  "keyEvents": ["Fed 暫停升息帶動科技股反彈", "台積電法說上調全年營收展望", "AI 伺服器需求超出預期"],
  "sectorRotation": ["外資加碼半導體 ETF", "資金由債券轉向科技成長股"],
  "topRisks": ["美國出口管制", "Fed 鷹派轉向", "地緣政治風險"],
  "monthlyInsight": "5 月台股在 AI 需求驅動下...",
  "investmentOutlook": "展望 6 月，建議逢回分批佈局 0050、00692...",
  "createdAt": "2026-06-01T08:00:00.000+08:00"
}
```

## Step 7 — 回報結果

以繁體中文輸出：
- 月度訊號與情緒趨勢
- 三檔 ETF 月漲跌幅
- 月度洞察摘要
- 下月投資展望
- 已存檔路徑
